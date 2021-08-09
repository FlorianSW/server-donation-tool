import {Package} from './package';
import {v4} from 'uuid';

export class Reference {
    constructor(public readonly steamId: string, public readonly discordId: string, public readonly p: Package) {
    }

    static fromString(s: string, d: string, packages: Package[]): Reference | undefined {
        const ids = s.split('#');
        const selectedPackage = packages.find((p) => p.id === parseInt(ids[1]));
        if (!selectedPackage) {
            return;
        }
        return new Reference(ids[0], d, selectedPackage);
    }

    asString() {
        return `${this.steamId}#${this.p.id}`
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
        public status: OrderStatus,
        public payment: OrderPayment
    ) {
    }

    public pay(transactionId: string) {
        this.payment.transactionId = transactionId;
        this.status = OrderStatus.PAID;
    }

    public static create(created: Date, payment: OrderPayment, reference: Reference): Order {
        return new Order(v4(), created, reference, OrderStatus.CREATED, payment);
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

export class OrderNotCompleted extends Error {
    constructor() {
        super('OrderNotCompleted');
        Object.setPrototypeOf(this, OrderNotCompleted.prototype);
    }
}

export class SteamIdMismatch extends Error {
    constructor(public readonly expected: string, public readonly fromUser: string) {
        super('SteamIdMismatch');
        Object.setPrototypeOf(this, SteamIdMismatch.prototype);
    }
}
