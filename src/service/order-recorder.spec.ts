import {EventQueue} from '../adapter/event-queue';
import {Package, PriceType} from '../domain/package';
import {OrderRecorder} from './order-recorder';
import {InMemoryOrderRepository} from '../adapter/order-repository';
import {Reference} from '../domain/payment';
import {User} from '../domain/user';

const aPackage: Package = {
    id: 1,
    perks: [],
    name: 'A_PACKAGE',
    price: {
        type: PriceType.FIXED,
        currency: 'USD',
        amount: '1.00'
    }
};

const aUser: User = {
    discord: {
        id: '1111111111'
    },
    username: 'A_NAME',
};

describe('OrderRecorder', () => {
    let repository: InMemoryOrderRepository;
    let recorder: OrderRecorder;

    beforeEach(() => {
        repository = new InMemoryOrderRepository();
        const events = new EventQueue();
        recorder = new OrderRecorder(events, repository);
    });

    it('records an order when payed', async () => {
        const order = {
            id: 'SOME_ORDER_ID',
            created: new Date('2025-05-16T18:25:49Z'),
            transactionId: 'SOME_TRANSACTION_ID',
            reference: new Reference('A_STEAM_ID', 'A_DISCORD_ID', aPackage),
        };

        await recorder.onSuccessfulPayment(aUser, order);

        await expect(repository.find(order.id)).resolves.toEqual(order);
    });
});
