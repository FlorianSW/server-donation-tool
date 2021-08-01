import {OrderRepository} from '../domain/repositories';
import Knex from 'knex';
import * as fs from 'fs';
import {SQLiteOrderRepository} from './order-repository';
import {Reference} from '../domain/payment';
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
        const order = {
            id: 'SOME_ORDER_ID',
            created: new Date('2025-05-16T18:25:49Z'),
            transactionId: 'SOME_TRANSACTION_ID',
            reference: new Reference('A_STEAM_ID', 'A_DISCORD_ID', packages[0]),
        };
        await repository.save(order);

        const roles = await repository.find('SOME_ORDER_ID');

        expect(roles).not.toBeUndefined();
        expect(roles).toEqual(order);
    });

    it('returns undefined on unknown order Id', async () => {
        await expect(repository.find('UNKNOWN_ORDER_ID')).resolves.toBeUndefined();
    });

    afterEach(async () => {
        const repo = repository as SQLiteOrderRepository;
        await repo.clear();
        await repo.close();
        fs.rmSync(testDbPath);
    });
});
