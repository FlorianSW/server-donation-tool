import {
    CapturePaymentRequest,
    CreatePaymentOrderRequest,
    Order,
    OrderNotCompleted,
    Payment,
    PaymentCapture,
    Reference,
    SteamIdMismatch
} from '../domain/payment';
import {AppConfig} from '../domain/app-config';
import {User} from '../domain/user';
import {inject, singleton} from 'tsyringe';

const paypal = require('@paypal/checkout-server-sdk');

export enum Environment {
    PRODUCTION = 'production', SANDBOX = 'sandbox'
}

interface OrderResult {
    result: {
        id: string,
        status: string,
        create_time?: string,
        update_time: string,
        purchase_units: {
            custom_id: string,
            payments?: {
                captures: {
                    id: string
                }[]
            }
        }[]
    }
}

@singleton()
export class PaypalPayment implements Payment {
    private readonly client: any;

    constructor(@inject('AppConfig') private readonly config: AppConfig) {
        this.client = paypalClient(config);
    }

    async capturePayment(request: CapturePaymentRequest): Promise<PaymentCapture> {
        const r = new paypal.orders.OrdersCaptureRequest(request.orderId);
        r.requestBody({});

        const capture = await this.client.execute(r);
        return capture.result;
    }

    async orderDetails(orderId: string, forUser: User): Promise<Order> {
        const request = new paypal.orders.OrdersGetRequest(orderId);

        const order: OrderResult = await this.client.execute(request);

        const id = Reference.fromString(order.result.purchase_units[0].custom_id, forUser.discord.id, this.config.packages);

        if (!id || order.result.status !== 'COMPLETED') {
            throw new OrderNotCompleted();
        }

        const userSteamId = forUser.steam.id;
        if (id && id.steamId !== userSteamId) {
            throw new SteamIdMismatch(id.steamId, forUser.steam.id);
        }

        return {
            id: order.result.id,
            created: new Date(order.result.create_time || order.result.update_time),
            transactionId: order.result.purchase_units[0]?.payments?.captures[0]?.id,
            reference: id,
        };
    }

    async createPaymentOrder(request: CreatePaymentOrderRequest): Promise<Order> {
        const r = new paypal.orders.OrdersCreateRequest();
        r.prefer('return=representation');
        r.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                custom_id: new Reference(request.steamId, request.discordId, request.forPackage).asString(),
                description: request.forPackage.name,
                amount: {
                    currency_code: request.forPackage.price.currency,
                    value: request.forPackage.price.amount
                }
            }]
        });

        const order: OrderResult = await this.client.execute(r);
        return {
            id: order.result.id,
            created: new Date(order.result.create_time),
            transactionId: order.result.purchase_units[0]?.payments?.captures[0]?.id,
            reference: Reference.fromString(order.result.purchase_units[0].custom_id, request.discordId, this.config.packages),
        };
    }
}

/**
 *
 * Returns PayPal HTTP client instance with environment that has access
 * credentials context. Use this instance to invoke PayPal APIs, provided the
 * credentials have access.
 */
function paypalClient(config: AppConfig) {
    return new paypal.core.PayPalHttpClient(environment(config));
}

/**
 *
 * Set up and return PayPal JavaScript SDK environment with PayPal access credentials.
 * This sample uses SandboxEnvironment. In production, use LiveEnvironment.
 *
 */
function environment(config: AppConfig) {
    if (config.paypal.environment === Environment.PRODUCTION) {
        return new paypal.core.LiveEnvironment(config.paypal.clientId, config.paypal.clientSecret);
    } else {
        return new paypal.core.SandboxEnvironment(config.paypal.clientId, config.paypal.clientSecret);
    }
}
