import {requireAuthentication} from '../auth';
import {paypalClient} from './sdk';
import {Request, Response, Router} from 'express';

const paypal = require('@paypal/checkout-server-sdk');

export class DonationController {
    public readonly router: Router = Router();

    constructor() {
        this.router.post('/donations', requireAuthentication, this.createOrder.bind(this));
        this.router.get('/:orderId', requireAuthentication, this.afterDonation.bind(this));
        this.router.get('/donations/:orderId', requireAuthentication, this.getOrderDetails.bind(this));
    }

    private async afterDonation(req: Request, res: Response) {
        const request = new paypal.orders.OrdersGetRequest(req.params.orderId);

        try {
            const order = await paypalClient().execute(request);

            const intendedSteamId = order.result.purchase_units[0].custom_id;
            // @ts-ignore
            if (intendedSteamId !== req.user.steam.id) {
                res.render('payment_steam_mismatch', {
                    paymentSteamId: intendedSteamId,
                    // @ts-ignore
                    userSteamId: req.user.steam.id,
                });
            } else if (order.result.status === 'COMPLETED') {
                res.render('index', {
                    user: req.user,
                    paymentStatus: 'COMPLETE',
                });
            } else {
                res.render('index', {
                    user: req.user,
                    paymentStatus: 'INCOMPLETE',
                });
            }
        } catch (err) {
            console.error(err);
            return res.send(500);
        }
    }

    private async createOrder(req: Request, res: Response) {
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                custom_id: req.body.steamId,
                amount: {
                    currency_code: 'USD',
                    value: '1.00'
                }
            }]
        });

        try {
            const order = await paypalClient().execute(request);
            res.status(200).json({
                orderId: order.result.id
            });
        } catch (err) {
            console.error(err);
            return res.send(500);
        }
    }

    private async getOrderDetails(req: Request, res: Response) {
        const orderID = req.params.orderId;

        const request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.requestBody({});

        try {
            const capture = await paypalClient().execute(request);
            res.status(200).json({
                orderId: capture.result.id,
            });
        } catch (err) {
            console.error(err);
            return res.send(500);
        }
    }
}
