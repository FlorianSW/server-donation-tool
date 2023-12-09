import {Package, Perk, PriceType} from './domain/package';
import {FreetextPerk} from './adapter/perk/freetext-perk';
import {Order, OrderPayment, Reference, SubscriptionPlan} from './domain/payment';
import {FakePayment} from './adapter/paypal/paypal-payment';
import {User} from './domain/user';
import {VATRate} from './domain/vat';

export const aSteamId = '76561198012102485';
export const anotherSteamId = '76561198012102486';
export const aServerApiId = 'c10a80c6-ad46-477e-971d-614370ec173e';
export const aUser: User = {
    steam: {
        id: aSteamId,
        source: 'DISCORD',
        name: 'Test',
    },
    discord: {
        id: 'A_DISCORD_ID',
        username: 'A_USERNAME',
        discriminator: '0001',
    },
    username: 'A_USERNAME',
    subscribedPackages: {},
    roles: [],
};
export const anotherUser: User = {
    steam: {
        id: anotherSteamId,
        source: 'DISCORD',
        name: 'Test',
    },
    discord: {
        id: 'ANOTHER_DISCORD_ID',
        username: 'A_USERNAME',
        discriminator: '0001',
    },
    username: 'ANOTHER_USERNAME',
    subscribedPackages: {},
    roles: [],
};

export const somePackages: Package[] = [{
    id: 1,
    perks: [new FreetextPerk()],
    price: {
        type: PriceType.FIXED,
        amount: '10.00',
        currency: 'USD',
    },
    name: 'SOME_PACKAGE_NAME',
}, {
    id: 2,
    perks: [],
    name: 'A_PACKAGE',
    price: {
        type: PriceType.FIXED,
        currency: 'USD',
        amount: '1.00'
    }
}];

export const anOrder: Order = makeOrder(withCreatedDate(new Date('2025-05-16T18:25:49Z')), withPerkDetails({SOME_ID: 'SOME_VALUE'}));

export const aRedeemedOrder = makeOrder(asRedeemed());

export const aPlan = SubscriptionPlan.create(somePackages[0], 'SOME_PRODUCT_ID', 'SOME_PLAN_ID');

interface CreateOrderRequest {
    createdAt: Date,
    payment: OrderPayment,
    reference: Reference,
    message: string,
    vat?: VATRate | undefined,
}

type modifier = (c: CreateOrderRequest | Order) => CreateOrderRequest | Order

export function withCreatedDate(d: Date): modifier {
    return (c) => {
        if (c instanceof Order) {
            return c;
        }
        c.createdAt = d;
        return c;
    }
}

export function asRedeemed(d?: Date): modifier {
    return (c) => {
        if (c instanceof Order) {
            c.redeem(1);
            if (d) {
                c.firstRedeemed = d;
            }
        }
        return c;
    }
}

export function asRefunded(d?: Date): modifier {
    return (c) => {
        if (c instanceof Order) {
            c.refund();
            if (d) {
                c.refundedAt = d;
            }
        }
        return c;
    }
}

export function withPerkDetails(d: { [key: string]: string }): modifier {
    return (c) => {
        if (c instanceof Order) {
            c.pushPerkDetails(d);
        }
        return c;
    }
}

export function withVat(v?: VATRate | undefined): modifier {
    return (c) => {
        if (c instanceof Order) {
            return c;
        }
        c.vat = v;
        return c;
    }
}

export function withPerks(p: Perk[]): modifier {
    return (c) => {
        if (c instanceof Order) {
            return c;
        }
        c.reference = new Reference(
            c.reference.steamId,
            c.reference.discordId,
            {
                ...c.reference.p,
                perks: p,
            }
        );
        return c;
    }
}

export function withTransaction(p: OrderPayment): modifier {
    return (c) => {
        if (c instanceof Order) {
            return c;
        }
        c.payment = p;
        return c;
    }
}

export function makeOrder(...m: modifier[]): Order {
    let r: CreateOrderRequest = {
        createdAt: new Date(),
        payment: {
            id: 'PAYMENT_ORDER_ID',
            transactionId: 'SOME_TRANSACTION_ID',
            provider: FakePayment.NAME,
        },
        reference: new Reference(aSteamId, 'A_DISCORD_ID', somePackages[0]),
        message: 'A_MESSAGE',
        vat: new VATRate('DE', 19),
    }

    for (let mod of m) {
        r = mod(r) as CreateOrderRequest;
    }

    let candidate = Order.create(
        r.createdAt,
        r.payment,
        r.reference,
        r.message,
        r.vat,
    );

    for (let mod of m) {
        candidate = mod(candidate) as Order;
    }
    return candidate;
}
