import {Package} from './package';
import {User} from './user';

export class Reference {
    constructor(public readonly steamId: string, public readonly p: Package) {
    }

    static fromString(s: string, packages: Package[]): Reference | undefined {
        const ids = s.split('#');
        const selectedPackage = packages.find((p) => p.id === parseInt(ids[1]));
        if (!selectedPackage) {
            return;
        }
        return new Reference(ids[0], selectedPackage);
    }

    asString() {
        return `${this.steamId}#${this.p.id}`
    }
}

export interface Order {
    id: string,
    created: Date,
    reference: Reference,
    transactionId?: string,
}

export interface PaymentCapture {
    id: string;
}

export interface CreatePaymentOrderRequest {
    forPackage: Package;
    steamId: string;
}

export interface CapturePaymentRequest {
    orderId: string;
}

export interface Payment {
    createPaymentOrder(request: CreatePaymentOrderRequest): Promise<Order>;

    capturePayment(request: CapturePaymentRequest): Promise<PaymentCapture>;

    orderDetails(orderId: string, forUser: User): Promise<Order>;
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
