import {DonationType, GameId, Package, PerkDetails, RedeemError} from './package';
import {v4} from 'uuid';
import {AppConfig} from './app-config';
import {User} from './user';
import {HATEOASLink} from '../adapter/paypal/types';
import {VATRate} from './vat';

export class Reference {
    constructor(
        public gameId: GameId | null,
        public readonly p: Package,
        public readonly type: DonationType,
    ) {
    }

    asString() {
        return `${this.gameId.steam || this.gameId.xbox || this.gameId.playstation || this.gameId.discord}#${this.p.id}`
    }
}

export interface PaymentOrder {
    created: Date;
    id: string;
    transactionId?: string;
    status?: OrderStatus;
    metadata?: { [key: string]: any };
}

export interface DeferredPaymentOrder {
    paymentUrl: string;
}

export enum OrderStatus {
    CREATED = 0, PAID = 1, REFUNDED = 2,
}

export interface OrderPayment {
    id: string;
    transactionId?: string,
    provider: string,
}

export class Order {
    constructor(
        public readonly id: string,
        public readonly created: Date,
        public readonly reference: Reference,
        public readonly customMessage: string | null,
        public readonly vat: VATRate,
        public firstRedeemed: Date | null,
        public lastRedeemed: Date | null,
        public status: OrderStatus,
        public payment: OrderPayment,
        public perkDetails: Map<string, string>,
        public refundedAt: Date | null,
    ) {
    }

    public static create(created: Date, payment: OrderPayment, reference: Reference, customMessage: string | null = null, vat: VATRate | undefined = undefined): Order {
        return new Order(v4(), created, reference, customMessage, vat, null, null, OrderStatus.CREATED, payment, new Map(), null);
    }

    public static createDeferred(created: Date, reference: Reference, customMessage: string | null = null, vat: VATRate | undefined = undefined): Order {
        return new Order(v4(), created, reference, customMessage, vat, null, null, OrderStatus.CREATED, null, new Map(), null);
    }

    public isUnclaimed(): boolean {
        if (this.firstRedeemed) {
            return false;
        }
        return Object.entries(this.reference.gameId).filter((e) => e[0] !== 'discord').every((a) => a[1] === null);
    }

    public paymentIntent(payment: OrderPayment) {
        if (this.payment !== null) {
            throw new Error('can not intent to pay an order with an active payment intent');
        }
        this.payment = payment;
    }

    public pay(transactionId: string) {
        if (this.payment === null) {
            throw new Error('paying an order which was not intended to be payed, yet');
        }
        this.payment.transactionId = transactionId;
        this.status = OrderStatus.PAID;
    }

    public redeem(cooldownHours: number): RedeemError | undefined {
        if (this.lastRedeemed) {
            const earliestNextRedeem = this.lastRedeemed.getTime() + cooldownHours * 60 * 60 * 1000;
            if (new Date().getTime() <= earliestNextRedeem) {
                return new RedeemError(['ERROR_ORDER_REDEEM_RATE_LIMITED', {
                    params: {
                        redeemAt: new Date(earliestNextRedeem).toLocaleString(),
                    },
                }]);
            }
        }
        if (this.status !== OrderStatus.PAID) {
            return new RedeemError(['ERROR_ORDER_REDEEM_NOT_PAID', {params: {}}]);
        }
        if (this.firstRedeemed === null) {
            this.firstRedeemed = new Date();
        }
        this.lastRedeemed = new Date();
        return undefined;
    }

    public refund() {
        this.refundedAt = new Date();
        this.status = OrderStatus.REFUNDED;
    }

    public pushPerkDetails(details: PerkDetails) {
        for (let detail of Object.entries(details)) {
            if (this.perkDetails.has(detail[0])) {
                throw new Error('can not overwrite existing perk details: ' + detail[0]);
            }
            this.perkDetails.set(detail[0], detail[1]);
        }
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
        public perkDetails: Map<string, string>,
        public vat?: VATRate,
    ) {
    }

    public static create(plan: SubscriptionPlan, user: User, vat: VATRate | undefined = undefined): Subscription {
        return new Subscription(v4(), plan.id, {}, {
            steamId: user.steam.id,
            discordId: user.discord.id
        }, 'PENDING', new Map(), vat);
    }

    public pushPerkDetails(details: PerkDetails) {
        for (let detail of Object.entries(details)) {
            if (this.perkDetails.has(detail[0])) {
                throw new Error('can not overwrite existing perk details: ' + detail[0]);
            }
            this.perkDetails.set(detail[0], detail[1]);
        }
    }

    public cancel(): void {
        this.state = 'CANCELLED';
    }

    public agreeBilling(paymentId: string): void {
        this.payment.id = paymentId;
    }

    public pay(transactionId: string, provider: string, p: Package): Order {
        const order = Order.create(new Date(), {
            id: this.payment.id,
            transactionId: transactionId,
            provider: provider,
        }, new Reference({steam: this.user.steamId, discord: this.user.discordId}, p, DonationType.Subscription), null, this.vat);
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
    transactionId: string;
}

export interface CreatePaymentOrderRequest {
    forPackage: Package;
    discordId: string;
    vat?: VATRate;
}

export interface DeferredPaymentOrderRequest {
    successUrl: URL,
    cancelUrl: URL,
    candidateOrderId: string;
}

export interface CapturePaymentRequest {
    orderId: string;
}

export interface PendingSubscription {
    id: string;
    approvalLink: string;
}

export interface SubscriptionPayment {
    state: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'CANCELLED';
    approvalLink: string | null;
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

export interface CaptureRefunded {
    id: string;
    links: HATEOASLink[];
}

export interface PaymentProvider {
    branding: {
        logo?: string;
        name: string;
    };
    donation?: {
        template: string;
        publicRenderData: { [key: string]: string };
    };
    deferredDonation?: boolean;
}

export interface Payment {
    createPaymentOrder(request: CreatePaymentOrderRequest | CreatePaymentOrderRequest & DeferredPaymentOrderRequest): Promise<PaymentOrder | PaymentOrder & DeferredPaymentOrder>;

    capturePayment(request: CapturePaymentRequest): Promise<PaymentCapture>;

    details(paymentOrderId: string): Promise<PaymentOrder>;

    provider(): PaymentProvider;
}

export interface SubscriptionPaymentProvider {
    persistSubscription(p: Package, plan?: SubscriptionPlan): Promise<SubscriptionPlan>;

    subscribe(sub: Subscription, plan: SubscriptionPlan, user: User, vat?: VATRate): Promise<PendingSubscription>;

    subscriptionDetails(sub: Subscription): Promise<SubscriptionPayment | undefined>;

    cancelSubscription(subscription: Subscription): Promise<void>;

    provider(): PaymentProvider;
}

export class OrderNotFound extends Error {
    constructor() {
        super('OrderNotFound');
        Object.setPrototypeOf(this, OrderNotFound.prototype);
    }
}

export class GameIdMismatch extends Error {
    constructor(public readonly expected: GameId, public readonly fromUser: GameId) {
        super('GameIdMismatch');
        Object.setPrototypeOf(this, GameIdMismatch.prototype);
    }
}
