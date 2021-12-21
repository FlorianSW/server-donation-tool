import {
    CapturePaymentRequest,
    CreatePaymentOrderRequest,
    OrderNotFound,
    OrderStatus,
    Payment,
    PaymentCapture,
    PaymentOrder, PaymentProvider
} from '../../domain/payment';
import {Package} from '../../domain/package';
import {inject, singleton} from 'tsyringe';
import {AppConfig} from '../../domain/app-config';
import Stripe from 'stripe';

@singleton()
export class StripePayment implements Payment {
    public static readonly NAME = 'stripe';

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('packages') private readonly packages: Package[],
        @inject('StripeClient') private readonly client: Stripe,
    ) {
    }

    async details(paymentOrderId: string): Promise<PaymentOrder> {
        const info = await this.client.paymentIntents.retrieve(paymentOrderId);
        if (info.lastResponse.statusCode === 404) {
            throw new OrderNotFound();
        }
        return {
            transactionId: paymentOrderId,
            id: paymentOrderId,
            created: new Date(info.created),
            status: info.status === 'succeeded' ? OrderStatus.PAID : OrderStatus.CREATED,
        };
    }

    provider(): PaymentProvider {
        return {
            name: StripePayment.NAME,
            template: 'payments/stripe/index.ejs',
            publicRenderData: {
                publishableKey: this.config.stripe.publishableKey,
            },
        };
    }

    capturePayment(request: CapturePaymentRequest): Promise<PaymentCapture> {
        throw Error('not supported');
    }

    async createPaymentOrder(request: CreatePaymentOrderRequest): Promise<PaymentOrder> {
        const intent = await this.client.paymentIntents.create({
            amount: parseFloat(request.forPackage.price.amount) * 100,
            currency: request.forPackage.price.currency,
            automatic_payment_methods: {
                enabled: true
            },
            description: request.forPackage.payment?.name || request.forPackage.name,
        });
        return {
            id: intent.id,
            transactionId: '',
            created: new Date(intent.created),
            metadata: {
                provider: 'stripe',
                clientSecret: intent.client_secret,
            },
        };
    }
}
