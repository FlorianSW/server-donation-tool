import {
    CapturePaymentRequest,
    CreatePaymentOrderRequest,
    DeferredPaymentOrder,
    DeferredPaymentOrderRequest,
    OrderNotFound,
    OrderStatus,
    Payment,
    PaymentCapture,
    PaymentOrder,
    PaymentProvider
} from '../../domain/payment';
import {inject, singleton} from 'tsyringe';
import Stripe from 'stripe';

@singleton()
export class StripePayment implements Payment {
    public static readonly NAME = 'stripe';

    constructor(
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
            branding: {
                logo: 'stripe.svg',
                name: StripePayment.NAME,
            },
            deferredDonation: true,
        };
    }

    capturePayment(request: CapturePaymentRequest): Promise<PaymentCapture> {
        throw Error('not supported');
    }

    async createPaymentOrder(request: CreatePaymentOrderRequest & DeferredPaymentOrderRequest): Promise<PaymentOrder & DeferredPaymentOrder> {
        let rate: Stripe.TaxRate;
        if (request.vat) {
            const rates = await this.client.taxRates.list({
                active: true,
            });
            rate = rates.data.find((r) => r.country === request.vat.countryCode);
            if (!rate) {
                rate = await this.client.taxRates.create({
                    active: true,
                    display_name: request.vat.displayName,
                    country: request.vat.countryCode,
                    description: 'Added by Server Donation Tool',
                    inclusive: false,
                    percentage: request.vat.rate,
                    tax_type: 'vat',
                });
            }
        }

        const sess = await this.client.checkout.sessions.create({
            mode: 'payment',
            line_items: [{
                quantity: 1,
                price_data: {
                    currency: request.forPackage.price.currency,
                    product_data: {
                        name: request.forPackage.payment?.name || request.forPackage.name,
                    },
                    unit_amount: parseFloat(request.forPackage.price.amount) * 100,
                    tax_behavior: 'exclusive',
                },
                tax_rates: rate ? [rate.id] : [],
            }],
            submit_type: 'donate',
            cancel_url: request.cancelUrl.toString(),
            success_url: request.successUrl.toString(),
        });

        return {
            id: sess.payment_intent as string,
            transactionId: '',
            created: new Date(),
            paymentUrl: sess.url,
            metadata: {
                provider: StripePayment.NAME,
            },
        };
    }
}
