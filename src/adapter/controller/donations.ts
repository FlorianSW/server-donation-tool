import {requireAuthentication} from '../../auth';
import {Request, Response, Router} from 'express';
import {translate} from '../../translations';
import {DonationType, Hints, Package, Perk, RedeemTarget} from '../../domain/package';
import {AppConfig} from '../../domain/app-config';
import {GameIdMismatch, Order, OrderNotFound, OrderStatus, Payment, Reference} from '../../domain/payment';
import {Logger} from 'winston';
import {SessionData} from 'express-session';
import csrf from 'csurf';
import {EventSource} from '../../domain/events';
import {inject, injectAll, singleton} from 'tsyringe';
import {OrderRepository} from '../../domain/repositories';
import {Subscriptions} from '../../service/subscriptions';
import {RedeemPackage} from '../../service/redeem-package';
import {toGameId, User} from '../../domain/user';
import {VATRate, VATs} from '../../domain/vat';
import {UserData} from '../../service/user-data';

@singleton()
export class DonationController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('availablePackages') private readonly packages: Package[],
        @inject('VATs') private readonly vats: VATs,
        @injectAll('Payment') private readonly payments: Payment[],
        @inject('OrderRepository') private readonly repo: OrderRepository,
        @inject('Subscriptions') private readonly subscriptions: Subscriptions,
        @inject('RedeemPackage') private readonly redeemPackage: RedeemPackage,
        @inject('EventSource') private readonly events: EventSource,
        @inject(UserData) private readonly data: UserData,
        @inject('Logger') private readonly logger: Logger,
    ) {
        const csrfProtection = csrf();
        this.router.post('/api/donations', requireAuthentication, csrfProtection, this.createOrder.bind(this));
        this.router.post('/api/donations/:orderId', requireAuthentication, csrfProtection, this.captureOrder.bind(this));
        this.router.delete('/api/donations/:orderId', requireAuthentication, csrfProtection, this.dropOrder.bind(this));

        this.router.post('/subscribe', requireAuthentication, csrfProtection, this.subscribe.bind(this));

        this.router.get('/donate', requireAuthentication, csrfProtection, this.prepareDonation.bind(this));
        this.router.post('/donate', requireAuthentication, csrfProtection, this.donate.bind(this));
        this.router.get('/donate/:orderId', requireAuthentication, csrfProtection, this.prepareRedeem.bind(this));
        this.router.get('/donate/:orderId/cancel', requireAuthentication, csrfProtection, this.cancelOrder.bind(this));
        this.router.post('/donate/:orderId/redeem', requireAuthentication, csrfProtection, this.redeem.bind(this));
        this.router.get('/donate/:orderId/redeem', requireAuthentication, this.redirectToPrepareRedeem.bind(this));
    }

    private async fetchOrderDetails(req: Request): Promise<Order> {
        const order = await this.repo.find(req.params.orderId);
        if (!order) {
            throw new OrderNotFound();
        }

        if (order.status === OrderStatus.CREATED) {
            const provider = this.payments.find((p) => p.provider().branding.name === order.payment.provider);
            if (!provider) {
                throw new Error('non-paid order with an unknown payment provider');
            }
            const info = await provider.details(order.payment.id);
            if (info.status === OrderStatus.PAID) {
                await this.markOrderPaid(req.user, order, info.transactionId);
            }
        }

        req.session.lastOrder = {
            id: order.id,
            transactionId: order.payment.transactionId,
        };

        const owned = toGameId(req.user);
        const allAccountsOwned = Array.from(new Set(order.reference.p.perks.flatMap((p) => p.requiresLogins())))
            // discord ID is always set to the one who bought the donation
            .filter((l) => l !== 'discord')
            .every((l) => !order.reference.gameId[l] || owned[l] === order.reference.gameId[l]);

        if (!allAccountsOwned) {
            throw new GameIdMismatch(order.reference.gameId, owned);
        } else {
            return order;
        }
    }

    private async markOrderPaid(user: User, order: Order, transactionId: string): Promise<Order> {
        order.pay(transactionId);
        await this.repo.save(order);
        setTimeout(async () => {
            this.events.emit('successfulPayment', RedeemTarget.fromUser(user), order);
        });
        return order;
    }

    private async donate(req: Request, res: Response) {
        const selectedPackage = this.selectedPackage(req.session);
        if (!selectedPackage) {
            res.redirect('/');
            return;
        }

        const selectedPayment = this.payments.map((p) => p.provider()).find((p) => p.branding.name === req.body.method);
        if (!selectedPayment) {
            res.redirect('/donate');
            return;
        }

        const rates = await this.vats.countries(selectedPackage.price);
        if (rates.length !== 0) {
            const selectedCountry = req.body['vat-country'];
            if (!selectedCountry) {
                res.redirect('/donate');
                return;
            }
            if (selectedCountry === 'other') {
                req.session.vat = undefined;
            } else {
                req.session.vat = await this.vats.forCountry(selectedPackage.price, selectedCountry);
            }
        }

        if (!this.populatePerkDetails(selectedPackage, req)) {
            res.redirect('/donate');
            return;
        }

        let customMessage = req.body.customMessage;
        if (customMessage && customMessage.length > 255) {
            res.sendStatus(400).write(JSON.stringify({
                error: 'custom message can not exceed 255 characters'
            }));
            return;
        }
        if (!customMessage) {
            customMessage = null;
        }

        if (selectedPayment.deferredDonation) {
            await this.deferredDonation(req, res, customMessage);
        } else if (selectedPayment.donation) {
            res.render('steps/donate', {
                csrfToken: req.csrfToken(),
                currency: req.session.selectedPackage.price.currency,
                customMessage: customMessage || '',
                gift: !!req.body.gift,
                selectedPackage: {
                    name: selectedPackage.name,
                    price: req.session.selectedPackage.price,
                    perks: selectedPackage.perks,
                    subscription: selectedPackage.subscription,
                    type: req.session.selectedPackage.type,
                },
                selectedMethod: {
                    template: selectedPayment.donation.template,
                    data: selectedPayment.donation.publicRenderData,
                },
                appliedVat: req.session.vat?.amount(req.session.selectedPackage.price),
            });
        } else {
            res.status(400).write('payment method can not be rendered');
        }
    }

    private populatePerkDetails(p: Package, req: Request): boolean {
        for (let perk of p.perks) {
            if (perk.subjects() === null) {
                continue;
            }
            const subject = req.body[perk.id()];
            if (!subject) {
                this.logger.debug('attempted to pay a donation package without selecting perk details for ' + perk.id());
                return false;
            }
            if (!Array.from(perk.subjects().keys()).some((s) => s === subject)) {
                this.logger.debug('attempted to select a non-existing subject ' + subject + ' for ' + perk.id());
                return false;
            }
            req.session.selectedPackage.perkDetails[perk.id()] = subject;
        }
        return true;
    }

    private hasMissingConnection(perks: Perk[], req: Request, res: Response): boolean {
        const requiredLogins = new Set(perks.flatMap((p) => p.requiresLogins()));
        for (let l of requiredLogins) {
            if (!req.user[l]) {
                req.session.afterLoginTarget = {
                    path: req.path,
                    method: req.method,
                    body: req.body,
                };
                res.render('missing_account_connection', {
                    login: l,
                });
                return true;
            }
        }
        return false;
    }

    private async prepareDonation(req: Request, res: Response) {
        const selectedPackage = this.selectedPackage(req.session);
        if (!selectedPackage) {
            res.redirect('/');
            return;
        }

        if (this.hasMissingConnection(selectedPackage.perks, req, res)) {
            return;
        }

        req.user = await this.data.onRefresh(req.user);
        if (req.user.subscribedPackages[selectedPackage.id] !== undefined && req.session.selectedPackage.type === DonationType.Subscription) {
            res.redirect('/');
            return;
        }
        const rates = await this.vats.countries(selectedPackage.price);
        let template = 'steps/donate';
        if (req.session.selectedPackage.type === DonationType.Subscription) {
            template = 'steps/subscribe';
        }

        const hints: (readonly [string, Hints])[] = await Promise.all(selectedPackage.perks.map(async (p) => {
            const hints = await p.interfaceHints(req.user);
            return [p.id(), hints];
        }));
        const perkHints = new Map(hints);
        res.render(template, {
            csrfToken: req.csrfToken(),
            currency: req.session.selectedPackage.price.currency,
            selectedPackage: {
                name: selectedPackage.name,
                price: req.session.selectedPackage.price,
                perks: selectedPackage.perks,
                subscription: selectedPackage.subscription,
                type: req.session.selectedPackage.type,
            },
            vatRates: rates,
            needsFurtherSelection: selectedPackage.perks.some((p) => p.subjects() !== null),
            interfaceHints: perkHints,
            paymentMethods: this.payments.map((p) => p.provider().branding),
        });
    }

    private async prepareRedeem(req: Request, res: Response) {
        let order: Order;
        try {
            order = await this.fetchOrderDetails(req);
        } catch (e) {
            if (e instanceof GameIdMismatch) {
                res.render('payment_gameid_mismatch', {
                    gameId: toGameId(req.user),
                });
            } else if (e instanceof OrderNotFound) {
                res.status(404).render('error', {
                    status: '404',
                    supportInfo: translate('ERROR_ORDER_NOT_FOUND', {params: {orderId: req.params.orderId}}),
                });
            } else {
                this.logger.error(e);
                res.status(500).json({message: e.toString()});
            }
            return;
        }

        if (!order.reference) {
            res.sendStatus(400);
            return;
        }

        if (order.status === OrderStatus.CREATED) {
            res.render('steps/wait_for_payment');
            return;
        } else if (order.status === OrderStatus.REFUNDED) {
            res.render('steps/order_refunded', {
                order: order,
            });
            return;
        }

        if (this.hasMissingConnection(order.reference.p.perks, req, res)) {
            return;
        }

        if (order.isUnclaimed() && req.query.redeem) {
            for (let perk of order.reference.p.perks) {
                req.body[perk.id()] = 'checked';
            }
            return this.redeem(req, res)
        } else {
            res.render('steps/redeem', {
                order: order,
                canShare: order.reference.gameId.discord === req.user.discord.id,
                shareLink: new URL(`/donate/${order.id}`, this.config.app.publicUrl).toString(),
                redeemLink: `/donate/${order.id}/redeem`,
                isUnclaimed: order.isUnclaimed(),
                perks: order.reference.p.perks,
                csrfToken: req.csrfToken(),
                redeemStatus: 'PENDING',
                hasPerks: order.reference.p.perks.length !== 0,
                errors: []
            });
        }
    }

    private async subscribe(req: Request, res: Response) {
        const selectedPackage = this.selectedPackage(req.session);
        if (!selectedPackage || !selectedPackage.subscription) {
            res.redirect('/');
            return;
        }
        if (!this.populatePerkDetails(selectedPackage, req)) {
            res.redirect('/');
            return;
        }
        const rates = await this.vats.countries(selectedPackage.price);
        if (rates.length !== 0) {
            const selectedCountry = req.body['vat-country'];
            if (!selectedCountry) {
                res.redirect('/');
                return;
            }
            if (selectedCountry === 'other') {
                req.session.vat = undefined;
            } else {
                req.session.vat = await this.vats.forCountry(selectedPackage.price, selectedCountry);
            }
        }

        const result = await this.subscriptions.subscribe(selectedPackage, req.session.selectedPackage.perkDetails, req.user, req.session.vat);
        res.redirect(result.approvalLink);
    }

    private async redirectToPrepareRedeem(req: Request, res: Response) {
        res.redirect(`/donate/${req.params.orderId}`);
    }

    private async redeem(req: Request, res: Response) {
        let order: Order;
        try {
            order = await this.fetchOrderDetails(req);
        } catch (e) {
            if (e instanceof GameIdMismatch) {
                res.render('payment_gameid_mismatch', {
                    gameId: toGameId(req.user),
                });
            } else if (e instanceof OrderNotFound) {
                res.status(404).render('error', {
                    status: '404',
                    supportInfo: translate('ERROR_ORDER_NOT_FOUND', {params: {orderId: req.params.orderId}}),
                });
            } else {
                res.sendStatus(500).json({message: e.toString()});
            }
            return;
        }
        if (order.status !== OrderStatus.PAID) {
            return this.redirectToPrepareRedeem(req, res);
        }
        if (!order.reference) {
            res.sendStatus(400);
            return;
        }

        const perks = [];
        for (let perk of order.reference.p.perks) {
            if (req.body[perk.id()]) {
                perks.push(perk);
            }
        }
        if (this.hasMissingConnection(perks, req, res)) {
            return;
        }
        const result = await this.redeemPackage.redeem(order, RedeemTarget.fromUser(req.user), perks);
        res.render('steps/redeem_success', {
            results: result.success,
            errors: result.errors,
        });
    }

    private selectedPackage(session: Partial<SessionData>): Package {
        if (!session.selectedPackage) {
            return;
        }
        const p = this.packages.find((p) => session.selectedPackage.id === p.id);
        if (p == null) {
            return null;
        }
        return {
            ...p,
            price: {
                ...p.price,
                ...session.selectedPackage.price
            }
        }
    }

    private async deferredDonation(req: Request, res: Response, customMessage: string) {
        const p = this.selectedPackage(req.session);
        const payment = this.payments.find((provider) => provider.provider().branding.name === req.body.method);
        if (!payment) {
            res.status(400).send();
            return;
        }

        const order = Order.createDeferred(new Date(), new Reference({discord: req.user.discord.id}, p), customMessage, req.session.vat);
        let query = '?provider=' + payment.provider().branding.name;
        if (req.body.gift === undefined) {
            query += '&redeem=true';
        }
        const paymentOrder = await payment.createPaymentOrder({
            candidateOrderId: order.id,
            successUrl: new URL('/donate/' + order.id + query, this.config.app.publicUrl),
            cancelUrl: new URL('/donate/' + order.id + '/cancel?&provider=' + payment.provider().branding.name, this.config.app.publicUrl),
            forPackage: p,
            discordId: req.user.discord.id,
            vat: VATRate.fromValueObject(req.session.vat),
        });
        order.paymentIntent({
            id: paymentOrder.id,
            transactionId: paymentOrder.transactionId,
            provider: payment.provider().branding.name,
        });
        order.pushPerkDetails(req.session.selectedPackage.perkDetails);

        if ('paymentUrl' in paymentOrder) {
            await this.repo.save(order);
            res.redirect(paymentOrder.paymentUrl);
        } else {
            throw new Error('deferred payment provider did not return deferred payment');
        }
    }

    private async createOrder(req: Request, res: Response) {
        let customMessage = req.body.customMessage;
        if (customMessage && customMessage.length > 255) {
            res.sendStatus(400).write(JSON.stringify({
                error: 'custom message an not exceed 255 characters'
            }));
            return;
        }
        if (!customMessage) {
            customMessage = null;
        }

        const p = this.selectedPackage(req.session);
        const payment = this.payments.find((provider) => provider.provider().branding.name === req.body.provider);
        if (!payment) {
            res.status(400).send();
            return;
        }
        const paymentOrder = await payment.createPaymentOrder({
            forPackage: p,
            discordId: req.user.discord.id,
            vat: VATRate.fromValueObject(req.session.vat),
        });

        const order = Order.create(paymentOrder.created, {
            id: paymentOrder.id,
            transactionId: paymentOrder.transactionId,
            provider: payment.provider().branding.name,
        }, new Reference({discord: req.user.discord.id}, p), customMessage, req.session.vat);
        order.pushPerkDetails(req.session.selectedPackage.perkDetails);
        await this.repo.save(order);

        res.status(200).json({
            orderId: order.payment.id,
            metadata: {
                returnUrl: new URL('/donate/' + order.id, this.config.app.publicUrl).toString(),
                ...paymentOrder.metadata
            },
        });
    }

    private async captureOrder(req: Request, res: Response) {
        const orders = await this.repo.findByPaymentOrder(req.params.orderId);
        if (orders.length === 0) {
            res.status(404);
            return
        }
        let order = orders[0];
        const payment = this.payments.find((provider) => provider.provider().branding.name === req.body.provider);
        if (!payment) {
            res.status(400).send({
                error: 'the requested payment provider does not exist: ' + req.body.provider,
            });
            return;
        }
        try {
            const capture = await payment.capturePayment({
                orderId: order.payment.id,
            });
            req.session.lastOrder = {
                id: order.id,
                transactionId: capture.transactionId,
            };

            order = await this.markOrderPaid(req.user, order, capture.transactionId);

            res.status(200).json({
                orderId: order.id,
            });
        } catch (e) {
            res.status(400).send({
                error: 'the payment could not be captured: ' + e.message,
            });
        }
    }

    private async dropOrder(req: Request, res: Response) {
        const orders = await this.repo.findByPaymentOrder(req.params.orderId);
        if (orders.length === 0) {
            res.status(404);
            return
        }
        const order = orders[0];
        if (order.status !== OrderStatus.CREATED) {
            res.status(403);
        } else {
            await this.repo.delete(order);
            res.status(204).json();
        }
    }

    private async cancelOrder(req: Request, res: Response) {
        const order = await this.repo.find(req.params.orderId);
        if (!order || order.status !== OrderStatus.CREATED) {
            res.status(404);
        } else {
            await this.repo.delete(order);
            res.redirect('/donate');
        }
    }
}
