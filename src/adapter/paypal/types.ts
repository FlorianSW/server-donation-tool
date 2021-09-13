import {JsonRequest} from './client';
import querystring from 'querystring';
import {SaleCompleted, SubscriptionCancelled} from '../../domain/payment';
import {WebhookTypes} from 'discord.js';

/**
 * https://developer.paypal.com/docs/api/orders/v2/#definition-purchase_unit
 */
export interface PurchaseUnit {
    reference_id: string;
    custom_id: string;
    payments: {
        captures: Capture[]
    }
}

/**
 * https://developer.paypal.com/docs/api/orders/v2/#definition-capture
 */
export interface Capture {
    status: string;
    id: string;
}

/**
 * https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */
export interface CaptureOrderResponse {
    id: string;
    purchase_units: PurchaseUnit[],
}

export interface Order {
    id: string,
    status: string,
    create_time?: string,
    update_time: string,
    purchase_units: PurchaseUnit[]
}

/**
 * https://developer.paypal.com/docs/api/webhooks/v1/#webhooks-events_get
 */
export class GetWebhookEvent extends JsonRequest {
    constructor(eventId: string) {
        super('/v1/notifications/webhooks-events/{event_id}?'.replace('{event_id}', querystring.escape(eventId)), 'GET');
    }
}

export interface WebhookEventResponse {
    resource: SaleCompleted | SubscriptionCancelled;
}

export interface CancelSubscriptionBody {
    reason: string;
}

export interface EventType {
    name: string;
}

export interface CreateWebhookBody {
    url: string;
    event_types: EventType[],
}

export interface Webhook {
    id: string;
    url: string;
    event_types: EventType[];
}

/**
 * https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_post
 */
export class CreateWebhookRequest extends JsonRequest<CreateWebhookBody> {
    body: null | CreateWebhookBody;

    constructor() {
        super('/v1/notifications/webhooks?', 'POST');
    }

    requestBody(request: CreateWebhookBody) {
        this.body = request;
        return this;
    }
}

/**
 * https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_update
 */
export class UpdateWebhookRequest extends JsonRequest<PatchOperation[]> {
    body: null | PatchOperation[];

    constructor(id: string) {
        super('/v1/notifications/webhooks/{webhook_id}?'.replace('{webhook_id}', querystring.escape(id)), 'PATCH');
    }

    requestBody(url: string) {
        this.body = [{
            op: 'replace',
            path: '/url',
            value: url,
        }] as PatchOperation[];
        return this;
    }
}

/**
 * https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_get
 */
export class GetWebhookRequest extends JsonRequest {
    constructor(id: string) {
        super('/v1/notifications/webhooks/{webhook_id}?'.replace('{webhook_id}', querystring.escape(id)), 'GET');
    }
}

/**
 * https://developer.paypal.com/docs/api/subscriptions/v1/#subscriptions_cancel
 */
export class CancelSubscriptionRequest extends JsonRequest<CancelSubscriptionBody> {
    body: null | CancelSubscriptionBody;

    constructor(subscriptionId: string) {
        super('/v1/billing/subscriptions/{subscription_id}/cancel?'.replace('{subscription_id}', querystring.escape(subscriptionId)), 'POST');
    }

    reason(reason: string) {
        this.body = {
            reason: reason,
        };
        return this;
    }
}

export enum PlanState {
    CREATED = 'CREATED', ACTIVE = 'ACTIVE', INACTIVE = 'INACTIVE'
}

/**
 * https://developer.paypal.com/docs/api/subscriptions/v1/#definition-billing_cycle
 */
export interface BillingCycle {
    pricing_scheme: {
        fixed_price: {
            currency_code: string;
            value: string;
        }
    };
    frequency: {
        interval_unit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
        interval_count: number;
    };
    tenure_type: 'TRIAL' | 'REGULAR';
    sequence: number;
    total_cycles: number;
}

/**
 * https://developer.paypal.com/docs/api/subscriptions/v1/#definition-payment_preferences
 */
export interface PaymentPreferences {
    auto_bill_outstanding: boolean;
    payment_failure_threshold: number;
}

export interface CreatePlanBody {
    product_id: string;
    name: string;
    status: Exclude<PlanState, 'INACTIVE'>;
    description: string;
    billing_cycles: BillingCycle[];
    payment_preferences: PaymentPreferences;
    quantity_supported: boolean;
}

/**
 * https://developer.paypal.com/docs/api/subscriptions/v1/#plans_create
 */
export class CreatePlanRequest extends JsonRequest<CreatePlanBody> {
    body: CreatePlanBody;

    constructor() {
        super('/v1/billing/plans?', 'POST');
    }

    requestBody(plan: CreatePlanBody) {
        this.body = plan;
        return this;
    }
}

interface PatchOperation {
    op: 'add' | 'remove' | 'replace';
    path: string;
    value?: string;
}

export type ProductType = 'DIGITAL' | 'SERVICE' | 'PHYSICAL';
export type ProductCategory = 'ONLINE_GAMING';

export interface UpdateProduct {
    name: string;
    description: string;
    category: ProductCategory;
    image_url?: string;
    home_url?: string;
}

export interface Product {
    id: string;
    name: string;
    description: string;
    type: ProductType;
    category: 'ONLINE_GAMING';
    image_url?: string;
    home_url: string;
    create_time?: string;
    update_time?: string;
}

/**
 * https://developer.paypal.com/docs/api/catalog-products/v1/#products_patch
 */
export class UpdateProductRequest extends JsonRequest<PatchOperation[]> {
    body: null | PatchOperation[];

    constructor(productId: string) {
        super('/v1/catalogs/products/{product_id}?'.replace('{product_id}', querystring.escape(productId)), 'PATCH');
    }

    requestBody(original: Product, product: UpdateProduct) {
        const ops: PatchOperation[] = [];
        for (let entry of Object.entries(product) as [string, string][]) {
            const oldValue = this.getProperty(original, entry[0] as keyof Product);
            if (entry[1] !== undefined) {
                if (oldValue === undefined) {
                    ops.push({op: 'add', path: `/${entry[0]}`, value: entry[1]});
                } else {
                    ops.push({op: 'replace', path: `/${entry[0]}`, value: entry[1]});
                }
            } else if (oldValue !== undefined) {
                ops.push({op: 'remove', path: `/${entry[0]}`});
            }
        }
        this.body = ops;
        return this;
    }

    private getProperty<T, K extends keyof T>(o: T, propertyName: K): T[K] {
        return o[propertyName];
    }
}

export interface UpdatePlan {
    name: string;
    description: string;
}

export interface Plan {
    id: string;
    product_id: string;
    name: string;
    description: string;
    status: PlanState;
    billing_cycles: BillingCycle[];
    payment_preferences: PaymentPreferences;
    create_time: string;
    update_time: string;
}

/**
 * https://developer.paypal.com/docs/api/subscriptions/v1/#plans_patch
 */
export class UpdatePlanRequest extends JsonRequest<PatchOperation[]> {
    body: null | PatchOperation[];

    constructor(id: string) {
        super('/v1/billing/plans/{id}?'.replace('{id}', querystring.escape(id)), 'PATCH');
    }

    requestBody(original: Plan, product: UpdatePlan) {
        const ops: PatchOperation[] = [];
        for (let entry of Object.entries(product) as [string, string][]) {
            const oldValue = this.getProperty(original, entry[0] as keyof Plan);
            if (entry[1] !== undefined) {
                if (oldValue === undefined) {
                    ops.push({op: 'add', path: `/${entry[0]}`, value: entry[1]});
                } else {
                    ops.push({op: 'replace', path: `/${entry[0]}`, value: entry[1]});
                }
            } else if (oldValue !== undefined) {
                ops.push({op: 'remove', path: `/${entry[0]}`});
            }
        }
        this.body = ops;
        return this;
    }

    private getProperty<T, K extends keyof T>(o: T, propertyName: K): T[K] {
        return o[propertyName];
    }
}

/**
 * https://developer.paypal.com/docs/api/subscriptions/v1/#definition-update_pricing_scheme_request
 */
export interface UpdatePricingPlan {
    pricing_schemes: {
        billing_cycle_sequence: number,
        pricing_scheme: {
            fixed_price: {
                value: string,
                currency_code: string,
            },
        },
    }[],
}

/**
 * https://developer.paypal.com/docs/api/subscriptions/v1/#plans_update-pricing-schemes
 */
export class UpdatePricingPlanRequest extends JsonRequest<UpdatePricingPlan> {
    body: null | UpdatePricingPlan;

    constructor(id: string) {
        super('/v1/billing/plans/{id}/update-pricing-schemes?'.replace('{id}', querystring.escape(id)), 'POST');
    }

    requestBody(r: UpdatePricingPlan) {
        this.body = r;
        return this;
    }
}

/**
 * https://developer.paypal.com/docs/api/catalog-products/v1/#products_get
 */
export class GetProductRequest extends JsonRequest {
    constructor(productId: string) {
        super('/v1/catalogs/products/{product_id}?'.replace('{product_id}', querystring.escape(productId)), 'GET');
    }
}

/**
 * https://developer.paypal.com/docs/api/subscriptions/v1/#plans_get
 */
export class GetPlanRequest extends JsonRequest {
    constructor(planId: string) {
        super('/v1/billing/plans/{plan_id}?'.replace('{plan_id}', querystring.escape(planId)), 'GET');
    }
}

export interface HATEOASLink {
    href: string;
    rel: string;
    method: string;
}

export interface PayPalSubscription {
    status: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
    id: string;
    plan_id: string;
    subscriber: {
        name: {
            given_name: string;
            surname: string;
            email_address: string;
            payer_id: string;
        };
    };
    links: HATEOASLink[]
}

export interface CreateSubscriptionBody {
    plan_id: string;
    application_context: {
        brand_name: string;
        shipping_preference: 'NO_SHIPPING';
        user_action: 'SUBSCRIBE_NOW';
        return_url: string;
        cancel_url: string;
    };
    custom_id: string;
}

/**
 * https://developer.paypal.com/docs/api/subscriptions/v1/#subscriptions_create
 */
export class CreateSubscriptionRequest extends JsonRequest<CreateSubscriptionBody> {
    path: string;
    verb: string;
    body: null | CreateSubscriptionBody;

    constructor() {
        super('/v1/billing/subscriptions?', 'POST');
    }

    requestBody(s: CreateSubscriptionBody) {
        this.body = s;
        return this;
    }
}

/**
 * https://developer.paypal.com/docs/api/catalog-products/v1/#products_create
 */
export class CreateProductRequest extends JsonRequest<Product> {
    body: null | Product;

    constructor() {
        super('/v1/catalogs/products?', 'POST');
    }

    requestBody(product: Product) {
        this.body = product;
        return this;
    }
}
