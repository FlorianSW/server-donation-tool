import {requireAuthentication} from '../auth';
import {paypalClient} from './sdk';
import {Request, Response, Router} from 'express';
import {CFToolsClient, DuplicateResourceCreation, SteamId64} from 'cftools-sdk';

const paypal = require('@paypal/checkout-server-sdk');

export class DonationController {
    public readonly router: Router = Router();

    constructor(private cftools: CFToolsClient) {
        this.router.post('/donations', requireAuthentication, this.createOrder.bind(this));
        this.router.get('/:orderId', requireAuthentication, this.afterDonation.bind(this));
        this.router.get('/:orderId/redeem', requireAuthentication, this.redeem.bind(this));
        this.router.get('/donations/:orderId', requireAuthentication, this.getOrderDetails.bind(this));
    }

    private async fetchOrderDetails(req: Request, res: Response): Promise<any> {
        const request = new paypal.orders.OrdersGetRequest(req.params.orderId);

        const order = await paypalClient().execute(request);

        const intendedSteamId = order.result.purchase_units[0].custom_id;
        // @ts-ignore
        const userSteamId = req.user.steam.id;
        if (intendedSteamId !== userSteamId) {
            res.render('payment_steam_mismatch', {
                paymentSteamId: intendedSteamId,
                userSteamId: userSteamId,
            });
            throw Error('steamIdMismatch');
        }
        if (order.result.status !== 'COMPLETED') {
            res.render('index', {
                user: req.user,
                paymentStatus: 'INCOMPLETE',
                redeemStatus: 'UNSTARTED',
            });
            throw new Error('orderNotCompleted');
        }

        return order;
    }

    private async afterDonation(req: Request, res: Response) {
        try {
            await this.fetchOrderDetails(req, res);

            res.render('index', {
                user: req.user,
                paymentStatus: 'COMPLETE',
                redeemStatus: 'UNSTARTED',
            });
        } catch (err) {
            console.error(err);
            return res.send(500);
        }
    }

    private async redeem(req: Request, res: Response) {
        try {
            const order = await this.fetchOrderDetails(req, res);
            const startTime = new Date(order.result.create_time);
            const expiration = new Date(startTime.valueOf());
            expiration.setDate(startTime.getDate() + 30);

            try {
                await this.cftools.putPriorityQueue({
                    id: SteamId64.of(order.result.purchase_units[0].custom_id),
                    expires: expiration,
                    comment: 'Created by CFTools Server Donation bot'
                });
            } catch (e) {
                if (e instanceof DuplicateResourceCreation) {
                    res.redirect('/');
                    return;
                }
                throw e;
            }

            res.render('index', {
                user: req.user,
                paymentStatus: 'COMPLETE',
                redeemStatus: 'COMPLETE',
                priorityUntil: expiration,
            });
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
