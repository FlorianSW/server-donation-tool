import {requireAuthentication} from '../../auth';
import {Request, Response, Router} from 'express';
import {TranslateParams} from '../../translations';
import {Package, RedeemError} from '../../domain/package';
import {AppConfig} from '../../domain/app-config';
import {Order, OrderStatus, Payment, Reference, SteamIdMismatch} from '../../domain/payment';
import {Logger} from 'winston';
import {SessionData} from 'express-session';
import csrf from 'csurf';
import {EventSource} from '../../domain/events';
import {inject, singleton} from 'tsyringe';
import {OrderRepository} from '../../domain/repositories';

@singleton()
export class DonationController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('availablePackages') private readonly packages: Package[],
        @inject('Payment') private readonly payment: Payment,
        @inject('OrderRepository') private readonly repo: OrderRepository,
        @inject('EventSource') private readonly events: EventSource,
        @inject('Logger') private readonly logger: Logger
    ) {
        const csrfProtection = csrf();
        this.router.post('/api/donations', requireAuthentication, csrfProtection, this.createOrder.bind(this));
        this.router.post('/api/donations/:orderId', requireAuthentication, csrfProtection, this.captureOrder.bind(this));

        this.router.get('/donate', requireAuthentication, csrfProtection, this.prepareDonation.bind(this));
        this.router.get('/donate/:orderId', requireAuthentication, csrfProtection, this.prepareRedeem.bind(this));
        this.router.post('/donate/:orderId/redeem', requireAuthentication, csrfProtection, this.redeem.bind(this));
        this.router.get('/donate/:orderId/redeem', requireAuthentication, this.redirectToPrepareRedeem.bind(this));
    }

    private async fetchOrderDetails(req: Request, res: Response): Promise<Order> {
        const order = await this.repo.find(req.params.orderId);

        req.session.lastOrder = {
            id: order.id,
            transactionId: order.payment.transactionId,
        };

        if (order.reference.steamId !== req.user.steam.id) {
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
        res.render('index', {
            step: 'DONATE',
            csrfToken: req.csrfToken(),
            user: req.user,
            selectedPackage: {
                name: selectedPackage.name,
                price: req.session.selectedPackage.price,
            },
            paypalClientId: this.config.paypal.clientId,
            paymentStatus: 'UNSTARTED',
        })
    }

    private async prepareRedeem(req: Request, res: Response) {
        const order = await this.fetchOrderDetails(req, res);

        if (!order.reference) {
            res.sendStatus(400);
            return;
        }

        res.render('index', {
            user: req.user,
            step: 'REDEEM',
            csrfToken: req.csrfToken(),
            redeemStatus: 'PENDING',
            hasPerks: this.selectedPackage(req.session).perks.length !== 0,
            errors: []
        });
    }

    private async redirectToPrepareRedeem(req: Request, res: Response) {
        res.redirect(`/donate/${req.params.orderId}`);
    }

    private async redeem(req: Request, res: Response) {
        const order = await this.fetchOrderDetails(req, res);
        if (!order.reference) {
            res.sendStatus(400);
            return;
        }

        const result: TranslateParams[] = [];
        const errors: TranslateParams[] = [];
        for (let perk of order.reference.p.perks) {
            try {
                result.push(await perk.redeem(req.user, order));
            } catch (e) {
                this.logger.error(`Could not redeem perk ${perk.type}:`, e);
                if (e instanceof RedeemError) {
                    errors.push(e.params);
                    this.events.emit('failedRedeemPerk', req.user, order, e);
                } else {
                    throw e;
                }
            }
        }

        this.events.emit('successfulRedeem', req.user, order);
        res.render('index', {
            user: req.user,
            step: 'REDEEM',
            redeemStatus: 'COMPLETE',
            results: result,
            errors: errors,
        });
    }

    private selectedPackage(session: Partial<SessionData>): Package {
        return this.packages.find((p) => session.selectedPackage.id === p.id);
    }

    private async createOrder(req: Request, res: Response) {
        const p = {
            ...this.selectedPackage(req.session),
            price: {
                ...this.selectedPackage(req.session).price,
                ...req.session.selectedPackage.price
            }
        };
        const paymentOrder = await this.payment.createPaymentOrder({
            forPackage: {
                ...this.selectedPackage(req.session),
                price: {
                    ...this.selectedPackage(req.session).price,
                    ...req.session.selectedPackage.price
                }
            },
            steamId: req.body.steamId,
            discordId: req.user.discord.id,
        });
        const order = Order.create(paymentOrder.created, {
            id: paymentOrder.id,
            transactionId: paymentOrder.transactionId,
        }, new Reference(req.body.steamId, req.user.discord.id, p));
        await this.repo.save(order);
        res.status(200).json({
            orderId: order.payment.id
        });
    }

    private async captureOrder(req: Request, res: Response) {
        const order = await this.repo.findByPaymentOrder(req.params.orderId);
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
            this.events.emit('successfulPayment', req.user, order);
        });
    }
}
