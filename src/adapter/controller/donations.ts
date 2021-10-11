import {requireAuthentication} from '../../auth';
import {Request, Response, Router} from 'express';
import {translate} from '../../translations';
import {DonationType, Package, RedeemTarget} from '../../domain/package';
import {AppConfig} from '../../domain/app-config';
import {Order, OrderNotFound, Payment, Reference, SteamIdMismatch} from '../../domain/payment';
import {Logger} from 'winston';
import {SessionData} from 'express-session';
import csrf from 'csurf';
import {EventSource} from '../../domain/events';
import {inject, singleton} from 'tsyringe';
import {OrderRepository} from '../../domain/repositories';
import {Subscriptions} from '../../service/subscriptions';
import {RedeemPackage} from '../../service/redeem-package';

@singleton()
export class DonationController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('availablePackages') private readonly packages: Package[],
        @inject('Payment') private readonly payment: Payment,
        @inject('OrderRepository') private readonly repo: OrderRepository,
        @inject('Subscriptions') private readonly subscriptions: Subscriptions,
        @inject('RedeemPackage') private readonly redeemPackage: RedeemPackage,
        @inject('EventSource') private readonly events: EventSource,
        @inject('Logger') private readonly logger: Logger
    ) {
        const csrfProtection = csrf();
        this.router.post('/api/donations', requireAuthentication, csrfProtection, this.createOrder.bind(this));
        this.router.post('/api/donations/:orderId', requireAuthentication, csrfProtection, this.captureOrder.bind(this));

        this.router.get('/donate', requireAuthentication, csrfProtection, this.prepareDonation.bind(this));
        this.router.post('/donate', requireAuthentication, csrfProtection, this.subscribe.bind(this));
        this.router.get('/donate/:orderId', requireAuthentication, csrfProtection, this.prepareRedeem.bind(this));
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
            paypalClientId: this.config.paypal.clientId,
        })
    }

    private async prepareRedeem(req: Request, res: Response) {
        const order = await this.fetchOrderDetails(req, res);

        if (!order.reference) {
            res.sendStatus(400);
            return;
        }

        res.render('steps/redeem', {
            user: req.user,
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

    private async subscribe(req: Request, res: Response) {
        const selectedPackage = this.selectedPackage(req.session);
        if (!selectedPackage || !selectedPackage.subscription) {
            res.redirect('/');
            return;
        }

        const result = await this.subscriptions.subscribe(selectedPackage, req.user);
        res.redirect(result.approvalLink);
    }

    private async redirectToPrepareRedeem(req: Request, res: Response) {
        res.redirect(`/donate/${req.params.orderId}`);
    }

    private async redeem(req: Request, res: Response) {
        let order = await this.fetchOrderDetails(req, res);
        if (!order.reference) {
            res.sendStatus(400);
            return;
        }

        const result = await this.redeemPackage.redeem(order, RedeemTarget.fromUser(req.user));
        res.render('steps/redeem', {
            user: req.user,
            isUnclaimed: false,
            canShare: false,
            redeemStatus: 'COMPLETE',
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
        const paymentOrder = await this.payment.createPaymentOrder({
            forPackage: p,
            steamId: steamId,
            discordId: req.user.discord.id,
        });

        const order = Order.create(paymentOrder.created, {
            id: paymentOrder.id,
            transactionId: paymentOrder.transactionId,
        }, new Reference(steamId, req.user.discord.id, p), customMessage);
        await this.repo.save(order);

        res.status(200).json({
            orderId: order.payment.id
        });
    }

    private async captureOrder(req: Request, res: Response) {
        const order = (await this.repo.findByPaymentOrder(req.params.orderId))[0];
        const capture = await this.payment.capturePayment({
            orderId: order.payment.id,
        });
        req.session.lastOrder = {
            id: capture.orderId,
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
}
