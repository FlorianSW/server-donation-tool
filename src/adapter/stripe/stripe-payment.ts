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
import {AppConfig} from "../../domain/app-config";

function unitAmount(v: string): number {
    return Math.round(parseFloat(v) * 100)
}

@singleton()
export class StripePayment implements Payment, SubscriptionPaymentProvider {
    public static readonly NAME = 'stripe';

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
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

    private async findTaxRate(vat?: VATRate): Promise<Stripe.TaxRate | undefined> {
        let rate: Stripe.TaxRate;
        if (vat) {
            const rates = await this.client.taxRates.list({
                active: true,
            });
            rate = rates.data.find((r) => r.country === vat.countryCode);
            if (!rate) {
                rate = await this.client.taxRates.create({
                    active: true,
                    display_name: vat.displayName,
                    country: vat.countryCode,
                    description: 'Added by Server Donation Tool',
                    inclusive: false,
                    percentage: vat.rate,
                    tax_type: 'vat',
                });
            }
        }
        return rate;
    }

    async createPaymentOrder(request: CreatePaymentOrderRequest & DeferredPaymentOrderRequest): Promise<PaymentOrder & DeferredPaymentOrder> {
        const rate = await this.findTaxRate(request.vat);

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

    async cancelSubscription(sub: Subscription): Promise<void> {
        let subId = sub.payment.id;
        if (sub.payment.id.startsWith('cs_')) {
            const session = await this.client.checkout.sessions.retrieve(sub.payment.id);
            subId = session.subscription as string;
        }
        await this.client.subscriptions.cancel(subId, {
            cancellation_details: {
                comment: 'Cancelled in Server Donation Tool',
            },
        });
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

    async subscribe(sub: Subscription, plan: SubscriptionPlan, user: User, vat?: VATRate): Promise<PendingSubscription> {
        const rate = await this.findTaxRate(vat);

        const result = await this.client.checkout.sessions.create({
            success_url: sub.asLink(this.config).toString(),
            cancel_url: sub.abortLink(this.config).toString(),
            mode: "subscription",
            line_items: [{
                quantity: 1,
                price: plan.payment.planId,
                tax_rates: rate ? [rate.id] : [],
            }],
        });
        return {
            id: result.id,
            approvalLink: result.url,
        };
    }

    async subscriptionDetails(sub: Subscription): Promise<SubscriptionPayment | undefined> {
        let subId = sub.payment.id;
        let updatePayment: SubscriptionPayment['updatePayment'];
        if (sub.payment.id.startsWith('cs_')) {
            const session = await this.client.checkout.sessions.retrieve(sub.payment.id);
            subId = session.subscription as string;
            updatePayment = {
                id: subId,
            };
        }
        const s = await this.client.subscriptions.retrieve(subId);
        let status: SubscriptionPayment['state'];
        switch (s.status) {
            case 'incomplete':
                status = 'APPROVAL_PENDING';
                break;
            case 'active':
                status = 'ACTIVE';
                break;
            case 'past_due':
                status = 'APPROVED';
                break;
            default:
                status = 'CANCELLED'
        }
        return {
            state: status,
            approvalLink: undefined,
            updatePayment: updatePayment,
        };
    }
}
