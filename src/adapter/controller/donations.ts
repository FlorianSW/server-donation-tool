import {requireAuthentication} from '../../auth';
import {Request, Response, Router} from 'express';
import {TranslateParams} from '../../translations';
import {RedeemError} from '../../domain/package';
import {AppConfig} from '../../domain/app-config';
import {Order, OrderNotCompleted, Payment, SteamIdMismatch} from '../../domain/payment';
import {Logger} from 'winston';
import {Notifier} from '../../domain/notifier';

export class DonationController {
    public readonly router: Router = Router();

    constructor(private readonly config: AppConfig, private readonly payment: Payment, private readonly notifier: Notifier, private readonly logger: Logger) {
        this.router.post('/donations', requireAuthentication, this.createOrder.bind(this));
        this.router.get('/donations/:orderId', requireAuthentication, this.captureOrder.bind(this));

        this.router.get('/donate', requireAuthentication, this.prepareDonation.bind(this));
        this.router.get('/donate/:orderId', requireAuthentication, this.prepareRedeem.bind(this));
        this.router.get('/donate/:orderId/redeem', requireAuthentication, this.redeem.bind(this));
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
        res.render('index', {
            step: 'DONATE',
            user: req.user,
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
            redeemStatus: 'PENDING',
        });
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
                    this.notifier.onFailedRedeemPerk(req.user, order, e).then();
                } else {
                    throw e;
                }
            }
        }

        this.notifier.onSuccessfulRedeem(req.user, order).then();
        res.render('index', {
            user: req.user,
            step: 'REDEEM',
            redeemStatus: 'COMPLETE',
            results: result,
            errors: errors,
        });
    }

    private async createOrder(req: Request, res: Response) {
        const selectedPackage = this.config.packages.find((p) => req.session.selectedPackageId === p.id);

        const order = await this.payment.createPaymentOrder({
            forPackage: selectedPackage,
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
            this.notifier.onSuccessfulPayment(req.user, order).then();
        });
    }
}
