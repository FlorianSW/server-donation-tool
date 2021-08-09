import {Package} from './package';

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

export interface Order {
    id: string,
    created: Date,
    reference: Reference,
    status: OrderStatus,
    payment: {
        id: string;
        transactionId?: string,
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
