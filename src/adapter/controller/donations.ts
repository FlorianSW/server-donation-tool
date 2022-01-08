import {requireAuthentication} from '../../auth';
import {Request, Response, Router} from 'express';
import {translate} from '../../translations';
import {DonationType, Package, RedeemTarget} from '../../domain/package';
import {AppConfig} from '../../domain/app-config';
import {Order, OrderNotFound, OrderStatus, Payment, Reference, SteamIdMismatch} from '../../domain/payment';
import {Logger} from 'winston';
import {SessionData} from 'express-session';
import csrf from 'csurf';
import {EventSource} from '../../domain/events';
import {inject, injectAll, singleton} from 'tsyringe';
import {OrderRepository} from '../../domain/repositories';
import {Subscriptions} from '../../service/subscriptions';
import {RedeemPackage} from '../../service/redeem-package';

@singleton()
export class DonationController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('availablePackages') private readonly packages: Package[],
        @injectAll('Payment') private readonly payments: Payment[],
        @inject('OrderRepository') private readonly repo: OrderRepository,
        @inject('Subscriptions') private readonly subscriptions: Subscriptions,
        @inject('RedeemPackage') private readonly redeemPackage: RedeemPackage,
        @inject('EventSource') private readonly events: EventSource,
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

    private async fetchOrderDetails(req: Request, res: Response): Promise<Order> {
        const order = await this.repo.find(req.params.orderId);
        if (!order) {
            res.status(404).render('error', {
                status: '404',
                supportInfo: translate('ERROR_ORDER_NOT_FOUND', {params: {orderId: req.params.orderId}}),
            });
            throw new OrderNotFound();
        }

        if (order.status !== OrderStatus.PAID) {
            const provider = this.payments.find((p) => p.provider().branding.name === order.payment.provider);
            if (!provider) {
                throw new Error('non-paid order with an unknown payment provider');
            }
            const info = await provider.details(order.payment.id);
            if (info.status === OrderStatus.PAID) {
                order.pay(info.transactionId);
                await this.repo.save(order);
            }
        }

        req.session.lastOrder = {
            id: order.id,
            transactionId: order.payment.transactionId,
        };

        if (order.reference.steamId !== null && order.reference.steamId !== req.user.steam.id) {
            res.render('payment_steam_mismatch', {
                userSteamId: req.user.steam.id,
            });
            throw new SteamIdMismatch(order.reference.steamId, req.user.steam.id);
        } else {
            return order;
        }
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
            return;
        } else if (selectedPayment.donation) {
            res.render('steps/donate', {
                csrfToken: req.csrfToken(),
                user: req.user,
                currency: req.session.selectedPackage.price.currency,
                customMessage: customMessage || '',
                selectedPackage: {
                    name: selectedPackage.name,
                    price: req.session.selectedPackage.price,
                    forAccount: req.session.selectedPackage.forAccount,
                    perks: selectedPackage.perks,
                    subscription: selectedPackage.subscription,
                    type: req.session.selectedPackage.type,
                },
                selectedMethod: {
                    template: selectedPayment.donation.template,
                    data: selectedPayment.donation.publicRenderData,
                },
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

    private async prepareDonation(req: Request, res: Response) {
        const selectedPackage = this.selectedPackage(req.session);
        if (!selectedPackage) {
            res.redirect('/');
            return;
        }
        let template = 'steps/donate';
        if (req.session.selectedPackage.type === DonationType.Subscription) {
            template = 'steps/subscribe';
        }

        res.render(template, {
            csrfToken: req.csrfToken(),
            user: req.user,
            currency: req.session.selectedPackage.price.currency,
            selectedPackage: {
                name: selectedPackage.name,
                price: req.session.selectedPackage.price,
                forAccount: req.session.selectedPackage.forAccount,
                perks: selectedPackage.perks,
                subscription: selectedPackage.subscription,
                type: req.session.selectedPackage.type,
            },
            needsFurtherSelection: selectedPackage.perks.some((p) => p.subjects() !== null),
            paymentMethods: this.payments.map((p) => p.provider().branding),
        });
    }

    private async prepareRedeem(req: Request, res: Response) {
        const order = await this.fetchOrderDetails(req, res);

        if (!order.reference) {
            res.sendStatus(400);
            return;
        }

        if (order.status !== OrderStatus.PAID) {
            res.render('steps/wait_for_payment');
        } else {
            res.render('steps/redeem', {
                user: req.user,
                order: order,
                canShare: order.reference.discordId === req.user.discord.id,
                shareLink: new URL(`/donate/${order.id}`, this.config.app.publicUrl).toString(),
                redeemLink: `/donate/${order.id}/redeem`,
                isUnclaimed: order.reference.steamId === null,
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

        const result = await this.subscriptions.subscribe(selectedPackage, req.session.selectedPackage.perkDetails, req.user);
        res.redirect(result.approvalLink);
    }

    private async redirectToPrepareRedeem(req: Request, res: Response) {
        res.redirect(`/donate/${req.params.orderId}`);
    }

    private async redeem(req: Request, res: Response) {
        const order = await this.fetchOrderDetails(req, res);
        if (order.status !== OrderStatus.PAID) {
            await this.redirectToPrepareRedeem(req, res);
            return;
        }
        if (!order.reference) {
            res.sendStatus(400);
            return;
        }
        if (order.status !== OrderStatus.PAID) {
            return this.redirectToPrepareRedeem(req, res);
        }

        const perks = [];
        for (let perk of order.reference.p.perks) {
            if (req.body[perk.id()]) {
                perks.push(perk);
            }
        }
        const result = await this.redeemPackage.redeem(order, RedeemTarget.fromUser(req.user), perks);
        res.render('steps/redeem_success', {
            user: req.user,
            results: result.success,
            errors: result.errors,
        });
    }

    private selectedPackage(session: Partial<SessionData>): Package {
        if (!session.selectedPackage) {
            return;
        }
        return this.packages.find((p) => session.selectedPackage.id === p.id);
    }

    private async deferredDonation(req: Request, res: Response, customMessage: string) {
        const p = {
            ...this.selectedPackage(req.session),
            price: {
                ...this.selectedPackage(req.session).price,
                ...req.session.selectedPackage.price
            }
        };
        const steamId = req.session.selectedPackage.forAccount;
        const payment = this.payments.find((provider) => provider.provider().branding.name === req.body.method);
        if (!payment) {
            res.status(400).send();
            return;
        }

        const order = Order.createDeferred(new Date(), new Reference(steamId, req.user.discord.id, p), customMessage);
        const paymentOrder = await payment.createPaymentOrder({
            candidateOrderId: order.id,
            successUrl: new URL('/donate/' + order.id + '?provider=' + payment.provider().branding.name, this.config.app.publicUrl),
            cancelUrl: new URL('/donate/' + order.id + '/cancel?&provider=' + payment.provider().branding.name, this.config.app.publicUrl),
            forPackage: p,
            steamId: steamId,
            discordId: req.user.discord.id,
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

        const p = {
            ...this.selectedPackage(req.session),
            price: {
                ...this.selectedPackage(req.session).price,
                ...req.session.selectedPackage.price
            }
        };
        const steamId = req.session.selectedPackage.forAccount;
        const payment = this.payments.find((provider) => provider.provider().branding.name === req.body.provider);
        if (!payment) {
            res.status(400).send();
            return;
        }
        const paymentOrder = await payment.createPaymentOrder({
            forPackage: p,
            steamId: steamId,
            discordId: req.user.discord.id,
        });

        const order = Order.create(paymentOrder.created, {
            id: paymentOrder.id,
            transactionId: paymentOrder.transactionId,
            provider: payment.provider().branding.name,
        }, new Reference(steamId, req.user.discord.id, p), customMessage);
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
        const order = (await this.repo.findByPaymentOrder(req.params.orderId))[0];
        const payment = this.payments.find((provider) => provider.provider().branding.name === req.body.provider);
        if (!payment) {
            res.status(400).send();
            return;
        }
        const capture = await payment.capturePayment({
            orderId: order.payment.id,
        });
        req.session.lastOrder = {
            id: order.id,
            transactionId: capture.transactionId,
        };

        order.pay(capture.transactionId);
        await this.repo.save(order);

        res.status(200).json({
            orderId: order.id,
        });

        setTimeout(async () => {
            this.events.emit('successfulPayment', RedeemTarget.fromUser(req.user), order);
        });
    }

    private async dropOrder(req: Request, res: Response) {
        const order = (await this.repo.findByPaymentOrder(req.params.orderId))[0];
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
