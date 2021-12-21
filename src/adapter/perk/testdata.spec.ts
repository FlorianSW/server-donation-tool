import {User} from '../../domain/user';
import {Package, PriceType} from '../../domain/package';
import {Order, Reference, SubscriptionPlan} from '../../domain/payment';
import {FakePayment} from '../paypal/paypal-payment';

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
    },
    username: 'A_USERNAME',
    subscribedPackages: {},
};
export const anotherUser: User = {
    steam: {
        id: anotherSteamId,
        source: 'DISCORD',
        name: 'Test',
    },
    discord: {
        id: 'ANOTHER_DISCORD_ID',
    },
    username: 'ANOTHER_USERNAME',
    subscribedPackages: {},
};
export const aPackage: Package = {
    id: 1,
    perks: [],
    name: 'A_PACKAGE',
    price: {
        type: PriceType.FIXED,
        currency: 'USD',
        amount: '1.00'
    }
};
export const anOrder: Order = Order.create(new Date(), {
    id: 'SOME_PAYMENT_ORDER_ID',
    transactionId: 'A_TRANSACTION_ID',
    provider: FakePayment.NAME,
}, new Reference(aSteamId, '11111111111', aPackage));

export const aRedeemedOrder: Order = Order.create(new Date(), {
    id: 'SOME_PAYMENT_ORDER_ID',
    transactionId: 'A_TRANSACTION_ID',
    provider: FakePayment.NAME,
}, new Reference(aSteamId, '11111111111', aPackage));
aRedeemedOrder.redeemedAt = aRedeemedOrder.created;

export const aPlan = SubscriptionPlan.create(aPackage, 'SOME_PRODUCT_ID', 'SOME_PLAN_ID');
