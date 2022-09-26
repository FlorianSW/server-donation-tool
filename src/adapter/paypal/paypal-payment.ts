import {
    CapturePaymentRequest,
    CreatePaymentOrderRequest,
    DeferredPaymentOrder,
    DeferredPaymentOrderRequest,
    OrderStatus,
    Payment,
    PaymentCapture,
    PaymentOrder,
    PaymentProvider,
    PendingSubscription,
    Reference,
    Subscription,
    SubscriptionPayment,
    SubscriptionPaymentProvider,
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
    GetSubscriptionRequest,
    Order,
    PayPalSubscription,
    Plan,
    PlanState,
    Product,
    UpdatePlanRequest,
    UpdatePricingPlanRequest,
    UpdateProductRequest
} from './types';
import {VATRate} from '../../domain/vat';

const paypal = require('@paypal/checkout-server-sdk');

export enum Environment {
    PRODUCTION = 'production', SANDBOX = 'sandbox'
}

@singleton()
export class PaypalPayment implements Payment, SubscriptionPaymentProvider {
    public static readonly NAME = 'paypal';

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('PayPalClient') private readonly client: PayPalClient,
    ) {
    }

    async details(paymentOrderId: string): Promise<PaymentOrder> {
        const r = new paypal.orders.OrdersGetRequest(paymentOrderId);

        let order = await this.client.execute<Order>(r);
        if (order.result.status === 'APPROVED') {
            await this.capturePayment({
                orderId: paymentOrderId,
            });
            order = await this.client.execute<Order>(r);
        }
        return {
            created: new Date(order.result.create_time),
            id: order.result.id,
            transactionId: order.result.purchase_units[0]?.payments?.captures[0]?.id,
            status: order.result.status === 'COMPLETED' ? OrderStatus.PAID : OrderStatus.CREATED,
        };
    }

    provider(): PaymentProvider {
        return {
            branding: {
                logo: 'paypal.svg',
                name: PaypalPayment.NAME,
            },
            donation: {
                template: 'payments/paypal/index.ejs',
                publicRenderData: {
                    clientId: this.config.paypal.clientId,
                },
            },
        };
    }

    async capturePayment(request: CapturePaymentRequest): Promise<PaymentCapture> {
        const r = new paypal.orders.OrdersCaptureRequest(request.orderId);

        const capture = await this.client.execute<CaptureOrderResponse>(r);
        return {
            transactionId: capture.result.purchase_units[0]?.payments?.captures[0]?.id,
        };
    }

    async createPaymentOrder(request: CreatePaymentOrderRequest | CreatePaymentOrderRequest & DeferredPaymentOrderRequest): Promise<PaymentOrder | PaymentOrder & DeferredPaymentOrder> {
        const communityTitle = this.config.app.community?.title || translate('PAYPAL_DEFAULT_COMMUNITY_NAME');
        const r = new paypal.orders.OrdersCreateRequest();
        r.prefer('return=representation');
        let amount = request.forPackage.price.amount;
        if (request.vat) {
            amount = (parseFloat(request.forPackage.price.amount) + parseFloat(request.vat.amount(request.forPackage.price))).toFixed(2);
        }
        const body: { [key: string]: any } = {
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
                    value: amount,
                    breakdown: {
                        item_total: {
                            currency_code: request.forPackage.price.currency,
                            value: request.forPackage.price.amount
                        },
                        tax_total: request.vat ? {
                            value: request.vat.amount(request.forPackage.price),
                            currency_code: request.forPackage.price.currency,
                        } : undefined,
                    },
                },
                items: [{
                    name: request.forPackage.payment?.name || request.forPackage.name,
                    category: 'DONATION',
                    unit_amount: {
                        currency_code: request.forPackage.price.currency,
                        value: request.forPackage.price.amount
                    },
                    quantity: 1,
                    tax: request.vat ? {
                        value: request.vat.amount(request.forPackage.price),
                        currency_code: request.forPackage.price.currency,
                    } : undefined,
                }],
            }],
        };
        if ('successUrl' in request) {
            body.application_context.return_url = request.successUrl;
            body.application_context.cancel_url = request.cancelUrl;
        }
        r.requestBody(body);

        const order = await this.client.execute<Order>(r);
        const result: PaymentOrder = {
            created: new Date(order.result.create_time),
            id: order.result.id,
            transactionId: order.result.purchase_units[0]?.payments?.captures[0]?.id,
        };
        if ('successUrl' in request) {
            return {
                ...result,
                paymentUrl: order.result.links.find((l) => l.rel === 'approve').href,
            }
        } else {
            return result;
        }
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

    async subscribe(sub: Subscription, plan: SubscriptionPlan, user: User, vat?: VATRate): Promise<PendingSubscription> {
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
            plan: vat ? {
                taxes: {
                    inclusive: false,
                    percentage: vat.rate.toString(),
                },
            } : undefined,
        });
        const result = await this.client.execute<PayPalSubscription>(r);

        return {
            id: result.result.id,
            approvalLink: result.result.links.find((l) => l.rel === 'approve').href,
        };
    }

    async subscriptionDetails(sub: Subscription): Promise<SubscriptionPayment | undefined> {
        const r = new GetSubscriptionRequest(sub.payment.id);
        let result;
        try {
            result = await this.client.execute<PayPalSubscription>(r);
        } catch (e) {
            if (e.statusCode === 404) {
                return undefined;
            }
            throw e;
        }

        let status: SubscriptionPayment['state'];
        switch (result.result.status) {
            case 'APPROVAL_PENDING':
                status = 'APPROVAL_PENDING';
                break;
            case 'ACTIVE':
                status = 'ACTIVE';
                break;
            case 'APPROVED':
                status = 'APPROVED';
                break;
            default:
                status = 'CANCELLED'
        }
        return {
            state: status,
            approvalLink: result.result.links.find((l) => l.rel === 'approve')?.href,
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
            name: translate('PAYPAL_SUBSCRIPTION_MONTHLY_NAME', {params: {package: p.name}}),
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

        try {
            return await this.client.execute(r);
        } catch (e) {
            if (e.statusCode === 404) {
                return {
                    statusCode: 404,
                } as Response<null>;
            }
            throw e;
        }
    }

    private async plan(id: string): Promise<Response<Plan>> {
        const r = new GetPlanRequest(id);

        try {
            return await this.client.execute(r);
        } catch (e) {
            if (e.statusCode === 404) {
                return {
                    statusCode: 404,
                } as Response<null>;
            }
            throw e;
        }
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

export class FakePayment implements Payment, SubscriptionPaymentProvider {
    public static readonly NAME = 'fake';

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

    subscriptionDetails(sub: Subscription): Promise<SubscriptionPayment> {
        return Promise.resolve({
            state: 'ACTIVE',
            approvalLink: undefined,
        });
    }

    provider(): PaymentProvider {
        return {
            branding: {
                name: FakePayment.NAME,
            },
        };
    }

    details(paymentOrderId: string): Promise<PaymentOrder> {
        throw new Error('not supported');
    }
}
