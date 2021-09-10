import {Package} from './package';
import {v4} from 'uuid';
import {AppConfig} from './app-config';

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
        public status: OrderStatus,
        public payment: OrderPayment
    ) {
    }

    public static create(created: Date, payment: OrderPayment, reference: Reference, customMessage: string | null = null): Order {
        return new Order(v4(), created, reference, customMessage, OrderStatus.CREATED, payment);
    }

    public pay(transactionId: string) {
        this.payment.transactionId = transactionId;
        this.status = OrderStatus.PAID;
    }

    public asLink(config: AppConfig): URL {
        return new URL(`/donate/${this.id}`, config.app.publicUrl);
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
}

export interface CapturePaymentRequest {
    orderId: string;
}

export interface Payment {
    createPaymentOrder(request: CreatePaymentOrderRequest): Promise<PaymentOrder>;

    capturePayment(request: CapturePaymentRequest): Promise<PaymentCapture>;
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
