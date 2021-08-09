import {OrderRepository} from '../domain/repositories';
import Knex from 'knex';
import * as fs from 'fs';
import {SQLiteOrderRepository} from './order-repository';
import {Order, OrderStatus, Reference} from '../domain/payment';
import {Package, PriceType} from '../domain/package';
import {FreetextPerk} from './perk/freetext-perk';

const testDbPath = __dirname + '/order-repository.spec.sqlite';
const packages: Package[] = [{
    id: 1,
    perks: [new FreetextPerk()],
    price: {
        type: PriceType.FIXED,
        amount: '10.00',
        currency: 'USD',
    },
    name: 'SOME_PACKAGE_NAME',
}];

const anOrder: Order = {
    id: 'SOME_ORDER_ID',
    created: new Date('2025-05-16T18:25:49Z'),
    status: OrderStatus.PAID,
    payment: {
        id: 'PAYMENT_ORDER_ID',
        transactionId: 'SOME_TRANSACTION_ID',
    },
    reference: new Reference('A_STEAM_ID', 'A_DISCORD_ID', packages[0]),
};

describe('OrderRepository', () => {
    let repository: OrderRepository;

    beforeEach(() => {
        const knex = Knex({
            client: 'sqlite3',
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        repository = new SQLiteOrderRepository(knex, packages);
    });

    it('persists order', async () => {
        await repository.save(anOrder);

        const roles = await repository.find('SOME_ORDER_ID');

        expect(roles).not.toBeUndefined();
        expect(roles).toEqual(anOrder);
    });

    it('finds order by payment order ID', async () => {
        await repository.save(anOrder);

        const roles = await repository.findByPaymentOrder('PAYMENT_ORDER_ID');

        expect(roles).not.toBeUndefined();
        expect(roles).toEqual(anOrder);
    });

    it('returns undefined on unknown order Id', async () => {
        await expect(repository.find('UNKNOWN_ORDER_ID')).resolves.toBeUndefined();
    });

    it('finds orders created after', async () => {
        await repository.save(anOrder);
        await repository.save({...anOrder, id: 'ANOTHER_ID', created: new Date('2025-05-17T18:25:49Z')});
        await repository.save({...anOrder, id: 'OTHER_ID', created: new Date('2025-05-18T18:25:49Z')});

        const result = await repository.findCreatedAfter(new Date('2025-05-17T01:00:00Z'));
        expect(result).toHaveLength(2);
        expect(result[0].id).toEqual('ANOTHER_ID');
        expect(result[1].id).toEqual('OTHER_ID');
    });

    it('does not find order', async () => {
        await repository.save(anOrder);
        await repository.save({...anOrder, id: 'ANOTHER_ID', created: new Date('2025-05-17T18:25:49Z')});

        const result = await repository.findCreatedAfter(new Date('2025-05-17T18:25:50Z'));
        expect(result).toHaveLength(0);
    });

    afterEach(async () => {
        const repo = repository as SQLiteOrderRepository;
        await repo.clear();
        await repo.close();
        fs.rmSync(testDbPath);
    });
});
