import {User} from '../../domain/user';
import {Package, PriceType} from '../../domain/package';
import {Order, Reference} from '../../domain/payment';

export const aSteamId = '76561198012102485';
export const aServerApiId = 'c10a80c6-ad46-477e-971d-614370ec173e';
export const aUser: User = {
    steam: {
        id: aSteamId,
        source: 'DISCORD',
        name: 'Test',
    },
    discord: {
        id: '',
    },
    username: 'A_USERNAME',
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
}, new Reference(aSteamId, '11111111111', aPackage));
