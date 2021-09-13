import {
    CapturePaymentRequest,
    CreatePaymentOrderRequest,
    Payment,
    PaymentCapture,
    PaymentOrder,
    PendingSubscription,
    Reference,
    Subscription,
    SubscriptionPlan
} from '../../domain/payment';
import {AppConfig} from '../../domain/app-config';
import {inject, singleton} from 'tsyringe';
import {Package} from '../../domain/package';
import {translate} from '../../translations';
import {User} from '../../domain/user';
import {v4} from 'uuid';
import {PayPalClient, Response} from './client';
import {
    CancelSubscriptionRequest,
    CaptureOrderResponse,
    CreatePlanBody,
    CreatePlanRequest,
    CreateProductRequest,
    CreateSubscriptionRequest,
    GetPlanRequest,
    GetProductRequest,
    Order,
    PayPalSubscription,
    Plan,
    PlanState,
    Product,
    UpdatePlanRequest,
    UpdatePricingPlanRequest,
    UpdateProductRequest
} from './types';

const paypal = require('@paypal/checkout-server-sdk');

export enum Environment {
    PRODUCTION = 'production', SANDBOX = 'sandbox'
}

@singleton()
export class PaypalPayment implements Payment {
    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('packages') private readonly packages: Package[],
        @inject('PayPalClient') private readonly client: PayPalClient,
    ) {
    }

    async capturePayment(request: CapturePaymentRequest): Promise<PaymentCapture> {
        const r = new paypal.orders.OrdersCaptureRequest(request.orderId);

        const capture = await this.client.execute<CaptureOrderResponse>(r);
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

        const order = await this.client.execute<Order>(r);
        return {
            created: new Date(order.result.create_time),
            id: order.result.id,
            transactionId: order.result.purchase_units[0]?.payments?.captures[0]?.id,
        };
    }

    async persistSubscription(p: Package, sp?: SubscriptionPlan): Promise<SubscriptionPlan> {
        let product: Response<Product>;
        product = await this.product(p);
        if (product.statusCode === 200) {
            product = await this.updateProduct(product.result, p);
        } else {
            product = await this.createProduct(p);
        }

        let plan: Response<Plan>;
        if (sp?.payment.planId) {
            plan = await this.updatePlan((await this.plan(sp.payment.planId)).result, p);
            return new SubscriptionPlan(sp.id, p, {
                productId: product.result.id,
                planId: plan.result.id,
            });
        } else {
            plan = await this.createPlan(p);
            return SubscriptionPlan.create(p, product.result.id, plan.result.id);
        }
    }

    async subscribe(sub: Subscription, plan: SubscriptionPlan, user: User): Promise<PendingSubscription> {
        const communityTitle = this.config.app.community?.title || translate('PAYPAL_DEFAULT_COMMUNITY_NAME');
        const r = new CreateSubscriptionRequest();
        r.requestBody({
            plan_id: plan.payment.planId,
            custom_id: new Reference(user.steam.id, user.discord.id, plan.basePackage).asString(),
            application_context: {
                brand_name: communityTitle,
                shipping_preference: 'NO_SHIPPING',
                user_action: 'SUBSCRIBE_NOW',
                return_url: sub.asLink(this.config).toString(),
                cancel_url: sub.abortLink(this.config).toString(),
            },
        });
        const result = await this.client.execute<PayPalSubscription>(r);

        return {
            id: result.result.id,
            approvalLink: result.result.links.find((l) => l.rel === 'approve').href,
        };
    }

    async cancelSubscription(subscription: Subscription): Promise<void> {
        const r = new CancelSubscriptionRequest(subscription.payment.id);
        r.reason('Requested by user');

        await this.client.execute<Response<void>>(r);
    }

    private homeUrl(): string | undefined {
        let homeUrl = this.config.app.publicUrl.toString();
        if (homeUrl.includes('localhost')) {
            return undefined;
        }
        return homeUrl;
    }

    private async createPlan(p: Package): Promise<Response<Plan>> {
        const planRequest = new CreatePlanRequest();
        planRequest.requestBody({
            product_id: this.asProductId(p),
            payment_preferences: {
                auto_bill_outstanding: true,
                payment_failure_threshold: 1,
            },
            status: PlanState.ACTIVE,
            description: translate('PAYPAL_SUBSCRIPTION_MONTHLY_DESCRIPTION'),
            name: translate('PAYPAL_SUBSCRIPTION_MONTHLY_NAME'),
            quantity_supported: false,
            billing_cycles: [{
                frequency: {
                    interval_unit: 'MONTH',
                    interval_count: 1,
                },
                pricing_scheme: {
                    fixed_price: {
                        currency_code: p.price.currency,
                        value: p.price.amount,
                    }
                },
                sequence: 1,
                tenure_type: 'REGULAR',
                total_cycles: 0,
            }]
        } as CreatePlanBody);
        return await this.client.execute(planRequest);
    }

    private asProductId(p: Package): string {
        return `DONATE-${p.id}`;
    }

    private async product(p: Package): Promise<Response<Product>> {
        const r = new GetProductRequest(this.asProductId(p));

        return await this.client.execute<Product>(r);
    }

    private async plan(id: string): Promise<Response<Plan>> {
        const r = new GetPlanRequest(id);

        return await this.client.execute(r);
    }

    private async createProduct(p: Package): Promise<Response<Product>> {
        const productRequest = new CreateProductRequest();
        productRequest.requestBody({
            id: this.asProductId(p),
            category: 'ONLINE_GAMING',
            description: p.description,
            name: p.name,
            type: 'DIGITAL',
            home_url: this.homeUrl(),
        });

        return await this.client.execute(productRequest);
    }

    private async updateProduct(product: Product, p: Package): Promise<Response<Product>> {
        const productRequest = new UpdateProductRequest(this.asProductId(p));
        productRequest.requestBody(product, {
            category: 'ONLINE_GAMING',
            description: p.description,
            name: p.name,
            home_url: this.homeUrl(),
        });

        await this.client.execute(productRequest);
        return await this.product(p);
    }

    private async updatePlan(plan: Plan, p: Package): Promise<Response<Plan>> {
        const request = new UpdatePlanRequest(plan.id);
        request.requestBody(plan, {
            description: translate('PAYPAL_SUBSCRIPTION_MONTHLY_DESCRIPTION'),
            name: translate('PAYPAL_SUBSCRIPTION_MONTHLY_NAME', {params: {package: p.name}}),
        });
        await this.client.execute(request);

        if (parseFloat(plan.billing_cycles[0].pricing_scheme.fixed_price.value) !== parseFloat(p.price.amount)) {
            const pricing = new UpdatePricingPlanRequest(plan.id);
            pricing.requestBody({
                pricing_schemes: [{
                    billing_cycle_sequence: 1,
                    pricing_scheme: {
                        fixed_price: {
                            currency_code: p.price.currency,
                            value: p.price.amount,
                        },
                    },
                }],
            });
            await this.client.execute(pricing);
        }
        return await this.plan(plan.id);
    }
}

export class FakePayment implements Payment {
    capturePayment(request: CapturePaymentRequest): Promise<PaymentCapture> {
        return Promise.resolve({
            orderId: v4(),
            transactionId: v4(),
        });
    }

    createPaymentOrder(request: CreatePaymentOrderRequest): Promise<PaymentOrder> {
        return Promise.resolve({
            id: v4(),
            created: new Date(),
            transactionId: v4(),
        });
    }

    persistSubscription(p: Package, plan?: SubscriptionPlan): Promise<SubscriptionPlan> {
        return Promise.resolve(SubscriptionPlan.create(p, v4(), v4()));
    }

    subscribe(sub: Subscription, plan: SubscriptionPlan, user: User): Promise<PendingSubscription> {
        return Promise.resolve({
            id: v4(),
            approvalLink: 'https://example.com/approveSubscription',
        });
    }

    cancelSubscription(subscription: Subscription): Promise<void> {
        return Promise.resolve(undefined);
    }
}
