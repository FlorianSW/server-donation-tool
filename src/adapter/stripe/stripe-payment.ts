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
    PaymentProvider,
    PendingSubscription,
    Subscription,
    SubscriptionPayment,
    SubscriptionPaymentProvider,
    SubscriptionPlan
} from '../../domain/payment';
import {inject, singleton} from 'tsyringe';
import Stripe from 'stripe';
import {Package} from "../../domain/package";
import {VATRate} from "../../domain/vat";
import {User} from "../../domain/user";

function unitAmount(v: string): number {
    return Math.round(parseFloat(v) * 100)
}

@singleton()
export class StripePayment implements Payment, SubscriptionPaymentProvider {
    public static readonly NAME = 'stripe';

    constructor(
        @inject('StripeClient') private readonly client: Stripe,
    ) {
    }

    async details(paymentOrderId: string): Promise<PaymentOrder> {
        let transactionId: string;
        if (paymentOrderId.startsWith('cs_')) {
            const cs = await this.client.checkout.sessions.retrieve(paymentOrderId);
            if (cs.lastResponse.statusCode === 404) {
                throw new OrderNotFound();
            }
            transactionId = cs.payment_intent as string;
        } else {
            transactionId = paymentOrderId;
        }
        const info = await this.client.paymentIntents.retrieve(transactionId);
        if (info.lastResponse.statusCode === 404) {
            throw new OrderNotFound();
        }
        return {
            transactionId: transactionId,
            id: paymentOrderId,
            created: new Date(info.created),
            status: info.status === 'succeeded' ? OrderStatus.PAID : OrderStatus.CREATED,
        };
    }

    provider(): PaymentProvider {
        return {
            id: StripePayment.NAME,
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
                    unit_amount: unitAmount(request.forPackage.price.amount),
                    tax_behavior: 'exclusive',
                },
                tax_rates: rate ? [rate.id] : [],
            }],
            submit_type: 'donate',
            cancel_url: request.cancelUrl.toString(),
            success_url: request.successUrl.toString(),
        });

        return {
            id: sess.id as string,
            transactionId: '',
            created: new Date(),
            paymentUrl: sess.url,
            metadata: {
                provider: StripePayment.NAME,
            },
        };
    }

    cancelSubscription(subscription: Subscription): Promise<void> {
        return Promise.resolve(undefined);
    }

    async persistSubscription(p: Package, plan?: SubscriptionPlan): Promise<SubscriptionPlan> {
        let product: Stripe.Product, price: Stripe.Price;
        if (plan?.payment.planId) {
            product = await this.client.products.retrieve(plan.payment.productId);
        } else {
            product = await this.client.products.create({
                name: p.name,
                description: p.description,
                shippable: false,
            });
        }
        if (plan?.payment.planId) {
            price = await this.client.prices.retrieve(plan.payment.planId);
        } else {
            price = await this.client.prices.create({
                product: product.id,
                currency: p.price.currency,
                tax_behavior: "exclusive",
                unit_amount: unitAmount(p.price.amount),
                recurring: {
                  interval: "month",
                },
            });
        }
        if (!plan) {
            return SubscriptionPlan.create(this.provider(), p, product.id, price.id);
        } else {
            plan.payment.productId = product.id;
            plan.payment.planId = price.id;
            return plan;
        }
    }

    subscribe(sub: Subscription, plan: SubscriptionPlan, user: User, vat?: VATRate): Promise<PendingSubscription> {
        return Promise.resolve(undefined);
    }

    subscriptionDetails(sub: Subscription): Promise<SubscriptionPayment | undefined> {
        return Promise.resolve(undefined);
    }
}
