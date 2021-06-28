import {requireAuthentication} from '../auth';
import {paypalClient} from './sdk';
import {Request, Response, Router} from 'express';
import {AppConfig, Package, Perk} from '../app-config';
import {RedeemPerk} from './types';

const paypal = require('@paypal/checkout-server-sdk');

class CustomId {
    constructor(public readonly steamId: string, public readonly p: Package) {
    }

    static fromString(s: string, packages: Package[]): CustomId | undefined {
        const ids = s.split('#');
        const selectedPackage = packages.find((p) => p.id === parseInt(ids[1]));
        if (!selectedPackage) {
            return;
        }
        return new CustomId(ids[0], selectedPackage);
    }

    asString() {
        return `${this.steamId}#${this.p.id}`
    }
}

export class DonationController {
    public readonly router: Router = Router();

    constructor(private readonly redeems: RedeemPerk[], private readonly config: AppConfig) {
        this.router.post('/donations', requireAuthentication, this.createOrder.bind(this));
        this.router.get('/donations/:orderId', requireAuthentication, this.captureOrder.bind(this));

        this.router.get('/donate', requireAuthentication, this.prepareDonation.bind(this));
        this.router.get('/donate/:orderId', requireAuthentication, this.prepareRedeem.bind(this));
        this.router.get('/donate/:orderId/redeem', requireAuthentication, this.redeem.bind(this));
    }

    private async fetchOrderDetails(req: Request, res: Response): Promise<any> {
        const request = new paypal.orders.OrdersGetRequest(req.params.orderId);

        const order = await paypalClient(this.config).execute(request);

        const id = CustomId.fromString(order.result.purchase_units[0].custom_id, this.config.packages);

        if (!id || order.result.status !== 'COMPLETED') {
            res.render('index', {
                step: 'DONATE',
                user: req.user,
                paymentStatus: 'INCOMPLETE',
                redeemStatus: 'UNSTARTED',
            });
            throw new Error('orderNotCompleted');
        }

        // @ts-ignore
        const userSteamId = req.user.steam.id;
        if (id && id.steamId !== userSteamId) {
            res.render('payment_steam_mismatch', {
                paymentSteamId: id.steamId,
                userSteamId: userSteamId,
            });
            throw Error('steamIdMismatch');
        }

        return order;
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
        try {
            const order = await this.fetchOrderDetails(req, res);

            const id = CustomId.fromString(order.result.purchase_units[0].custom_id, this.config.packages);
            if (!id) {
                res.sendStatus(400);
                return;
            }

            res.render('index', {
                user: req.user,
                step: 'REDEEM',
                redeemStatus: 'PENDING',
            });
        } catch (err) {
            console.error(err);
            return res.sendStatus(500);
        }
    }

    private perkProviders(perks: Perk[]): Map<string, RedeemPerk> {
        return new Map(perks.map((p) => {
            const r = this.redeems.find((r) => r.canRedeem(p));
            if (r === undefined) {
                throw new Error('No available provider can redeem perk: ' + p.type);
            }
            return [p.type, r];
        }));
    }

    private async redeem(req: Request, res: Response) {
        try {
            const order = await this.fetchOrderDetails(req, res);
            const id = CustomId.fromString(order.result.purchase_units[0].custom_id, this.config.packages);
            if (!id) {
                res.sendStatus(400);
                return;
            }

            const provider = this.perkProviders(id.p.perks);
            const result = [];
            for (let perk of id.p.perks) {
                const r = provider.get(perk.type);
                result.push(await r.redeem(id.p, perk, {steamId: id.steamId}, order.result));
            }

            res.render('index', {
                user: req.user,
                step: 'REDEEM',
                redeemStatus: 'COMPLETE',
                results: result,
            });
        } catch (err) {
            console.error(err);
            return res.send(500);
        }
    }

    private async createOrder(req: Request, res: Response) {
        // @ts-ignore
        const selectedPackage = req.session.selectedPackage;
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                custom_id: new CustomId(req.body.steamId, selectedPackage).asString(),
                description: selectedPackage.name,
                amount: {
                    currency_code: selectedPackage.price.currency,
                    value: selectedPackage.price.amount
                }
            }]
        });

        try {
            const order = await paypalClient(this.config).execute(request);
            res.status(200).json({
                orderId: order.result.id
            });
        } catch (err) {
            console.error(err);
            return res.sendStatus(500);
        }
    }

    private async captureOrder(req: Request, res: Response) {
        const orderID = req.params.orderId;

        const request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.requestBody({});

        try {
            const capture = await paypalClient(this.config).execute(request);
            res.status(200).json({
                orderId: capture.result.id,
            });
        } catch (err) {
            console.error(err);
            return res.sendStatus(500);
        }
    }
}
