import {Package} from './package';
import {v4} from 'uuid';
import {AppConfig} from './app-config';
import {User} from './user';

export class Reference {
    constructor(public steamId: string | null, public readonly discordId: string, public readonly p: Package) {
    }

    asString() {
        return `${this.steamId || this.discordId}#${this.p.id}`
    }
}

export interface PaymentOrder {
    created: Date;
    id: string;
    transactionId?: string;
    approvalLink?: string;
}

export enum OrderStatus {
    CREATED = 0, PAID = 1
}

export interface OrderPayment {
    id: string;
    transactionId?: string,
}

export class Order {
    constructor(
        public readonly id: string,
        public readonly created: Date,
        public readonly reference: Reference,
        public readonly customMessage: string | null,
        public redeemedAt: Date | null,
        public status: OrderStatus,
        public payment: OrderPayment
    ) {
    }

    public static create(created: Date, payment: OrderPayment, reference: Reference, customMessage: string | null = null): Order {
        return new Order(v4(), created, reference, customMessage, null, OrderStatus.CREATED, payment);
    }

    public pay(transactionId: string) {
        this.payment.transactionId = transactionId;
        this.status = OrderStatus.PAID;
    }

    public asLink(config: AppConfig): URL {
        return new URL(`/donate/${this.id}`, config.app.publicUrl);
    }
}

export class SubscriptionPlan {
    constructor(
        public readonly id: string,
        public readonly basePackage: Package,
        public readonly payment: {
            productId: string,
            planId: string,
        }
    ) {
    }

    public static create(basePackage: Package, productId: string, planId: string): SubscriptionPlan {
        return new SubscriptionPlan(v4(), basePackage, {productId: productId, planId: planId});
    }
}

export class Subscription {
    constructor(
        public readonly id: string,
        public readonly planId: string,
        public readonly payment: {
            id?: string,
        },
        public readonly user: {
            steamId: string,
            discordId: string,
        },
        public state: 'PENDING' | 'ACTIVE' | 'CANCELLED',
    ) {
    }

    public cancel(): void {
        this.state = 'CANCELLED';
    }

    public agreeBilling(paymentId: string): void {
        this.payment.id = paymentId;
    }

    public pay(transactionId: string, p: Package): Order {
        const order = Order.create(new Date(), {
            id: this.payment.id,
            transactionId: transactionId,
        }, new Reference(this.user.steamId, this.user.discordId, p));
        order.pay(transactionId);

        this.state = 'ACTIVE';
        return order;
    }

    public asLink(config: AppConfig): URL {
        return new URL(`/subscriptions/${this.id}`, config.app.publicUrl);
    }

    public abortLink(config: AppConfig): URL {
        if (this.state !== 'PENDING') {
            throw new SubscriptionNotPending();
        }
        return new URL(`/subscriptions/${this.id}/abort`, config.app.publicUrl);
    }

    public isActive(): boolean {
        return ['PENDING', 'ACTIVE'].includes(this.state);
    }

    public static create(plan: SubscriptionPlan, user: User): Subscription {
        return new Subscription(v4(), plan.id, {}, {
            steamId: user.steam.id,
            discordId: user.discord.id
        }, 'PENDING');
    }
}

export class SubscriptionNotFound extends Error {
    constructor() {
        super('SubscriptionNotFound');
        Object.setPrototypeOf(this, SubscriptionNotFound.prototype);
    }
}

export class SubscriptionNotPending extends Error {
    constructor() {
        super('SubscriptionNotPending');
        Object.setPrototypeOf(this, SubscriptionNotPending.prototype);
    }
}

export interface PaymentCapture {
    orderId: string;
    transactionId: string;
}

export interface CreatePaymentOrderRequest {
    forPackage: Package;
    steamId: string;
    discordId: string;
    returnUrl: {
        success: URL,
        cancel: URL,
    };
}

export interface CapturePaymentRequest {
    orderId: string;
}

export interface PendingSubscription {
    id: string;
    approvalLink: string;
}

export interface SaleCompleted {
    amount: {
        total: string;
        currency: string;
    };
    custom: string;
    billing_agreement_id: string;
    id: string;
    state: string;
}

export interface SubscriptionCancelled {
    id: string;
}

export interface Payment {
    createPaymentOrder(request: CreatePaymentOrderRequest): Promise<PaymentOrder>;

    capturePayment(request: CapturePaymentRequest): Promise<PaymentCapture>;

    persistSubscription(p: Package, plan?: SubscriptionPlan): Promise<SubscriptionPlan>;

    subscribe(sub: Subscription, plan: SubscriptionPlan, user: User): Promise<PendingSubscription>;

    cancelSubscription(subscription: Subscription): Promise<void>;
}

export class OrderNotFound extends Error {
    constructor() {
        super('OrderNotFound');
        Object.setPrototypeOf(this, OrderNotFound.prototype);
    }
}

export class SteamIdMismatch extends Error {
    constructor(public readonly expected: string, public readonly fromUser: string) {
        super('SteamIdMismatch');
        Object.setPrototypeOf(this, SteamIdMismatch.prototype);
    }
}
