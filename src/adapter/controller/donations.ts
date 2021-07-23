import {requireAuthentication} from '../../auth';
import {Request, Response, Router} from 'express';
import {TranslateParams} from '../../translations';
import {Package, RedeemError} from '../../domain/package';
import {AppConfig} from '../../domain/app-config';
import {Order, OrderNotCompleted, Payment, SteamIdMismatch} from '../../domain/payment';
import {Logger} from 'winston';
import {SessionData} from 'express-session';
import csrf from 'csurf';
import {EventSource} from '../../domain/events';

export class DonationController {
    public readonly router: Router = Router();

    constructor(private readonly config: AppConfig, private readonly payment: Payment, private readonly events: EventSource, private readonly logger: Logger) {
        const csrfProtection = csrf();
        this.router.post('/donations', requireAuthentication, csrfProtection, this.createOrder.bind(this));
        this.router.post('/donations/:orderId', requireAuthentication, csrfProtection, this.captureOrder.bind(this));

        this.router.get('/donate', requireAuthentication, csrfProtection, this.prepareDonation.bind(this));
        this.router.get('/donate/:orderId', requireAuthentication, csrfProtection, this.prepareRedeem.bind(this));
        this.router.post('/donate/:orderId/redeem', requireAuthentication, csrfProtection, this.redeem.bind(this));
        this.router.get('/donate/:orderId/redeem', requireAuthentication, this.redirectToPrepareRedeem.bind(this));
    }

    private async fetchOrderDetails(req: Request, res: Response): Promise<Order> {
        try {
            const result = await this.payment.orderDetails(req.params.orderId, req.user);
            req.session.lastOrder = {
                id: result.id,
                transactionId: result.transactionId,
            };
            return result;
        } catch (e) {
            if (e instanceof OrderNotCompleted) {
                res.render('index', {
                    step: 'DONATE',
                    user: req.user,
                    paymentStatus: 'INCOMPLETE',
                    redeemStatus: 'UNSTARTED',
                });
            }
            if (e instanceof SteamIdMismatch) {
                res.render('payment_steam_mismatch', {
                    paymentSteamId: e.expected,
                    userSteamId: e.fromUser,
                });
            }
            throw e;
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
                this.logger.error(`Could not redeem perk ${perk.type}: `, e);
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
        return this.config.packages.find((p) => session.selectedPackage.id === p.id);
    }

    private async createOrder(req: Request, res: Response) {
        const order = await this.payment.createPaymentOrder({
            forPackage: {
                ...this.selectedPackage(req.session),
                price: {
                    ...this.selectedPackage(req.session).price,
                    ...req.session.selectedPackage.price
                }
            },
            steamId: req.body.steamId
        });
        res.status(200).json({
            orderId: order.id
        });
    }

    private async captureOrder(req: Request, res: Response) {
        const capture = await this.payment.capturePayment({
            orderId: req.params.orderId
        });
        res.status(200).json({
            orderId: capture.id,
        });

        setTimeout(async () => {
            const order = await this.fetchOrderDetails(req, res);
            this.events.emit('successfulPayment', req.user, order);
        });
    }
}
