import {
    CapturePaymentRequest,
    CreatePaymentOrderRequest,
    Payment,
    PaymentCapture,
    PaymentOrder,
    Reference
} from '../domain/payment';
import {AppConfig} from '../domain/app-config';
import {inject, singleton} from 'tsyringe';
import {Package} from '../domain/package';
import {translate} from '../translations';

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

    constructor(@inject('AppConfig') private readonly config: AppConfig, @inject('packages') private readonly packages: Package[]) {
        this.client = paypalClient(config);
    }

    async capturePayment(request: CapturePaymentRequest): Promise<PaymentCapture> {
        const r = new paypal.orders.OrdersCaptureRequest(request.orderId);
        r.requestBody({});

        const capture = await this.client.execute(r);
        return {
            orderId: capture.result.id,
            transactionId: capture.result.purchase_units[0]?.payments?.captures[0]?.id,
        };
    }

    async createPaymentOrder(request: CreatePaymentOrderRequest): Promise<PaymentOrder> {
        const communityTitle = this.config.app.community?.title || translate('PAYPAL_DEFAULT_COMMUNITY_NAME');
        const r = new paypal.orders.OrdersCreateRequest();
        r.prefer('return=representation');
        r.requestBody({
            intent: 'CAPTURE',
            application_context: {
                brand_name: communityTitle,
                shipping_preference: 'NO_SHIPPING',
                user_action: 'PAY_NOW',
            },
            purchase_units: [{
                custom_id: new Reference(request.steamId, request.discordId, request.forPackage).asString(),
                description: translate('PAYPAL_ORDER_DESCRIPTION', {
                    params: {
                        communityName: communityTitle,
                    }
                }),
                amount: {
                    currency_code: request.forPackage.price.currency,
                    value: request.forPackage.price.amount,
                    breakdown: {
                        item_total: {
                            currency_code: request.forPackage.price.currency,
                            value: request.forPackage.price.amount
                        },
                    },
                },
                items: [{
                    name: request.forPackage.name,
                    category: 'DONATION',
                    unit_amount: {
                        currency_code: request.forPackage.price.currency,
                        value: request.forPackage.price.amount
                    },
                    quantity: 1,
                }],
            }],
        });

        const order: OrderResult = await this.client.execute(r);
        return {
            created: new Date(order.result.create_time),
            id: order.result.id,
            transactionId: order.result.purchase_units[0]?.payments?.captures[0]?.id,
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
