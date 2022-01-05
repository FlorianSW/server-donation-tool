import {OrderRepository} from '../domain/repositories';
import Knex from 'knex';
import * as fs from 'fs';
import {SQLiteOrderRepository} from './order-repository';
import {Order, Reference} from '../domain/payment';
import {Package, PriceType} from '../domain/package';
import {FreetextPerk} from './perk/freetext-perk';
import {FakePayment} from './paypal/paypal-payment';

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

const anOrder: Order = Order.create(new Date('2025-05-16T18:25:49Z'), {
    id: 'PAYMENT_ORDER_ID',
    transactionId: 'SOME_TRANSACTION_ID',
    provider: FakePayment.NAME,
}, new Reference('A_STEAM_ID', 'A_DISCORD_ID', packages[0]), 'A_MESSAGE');
anOrder.pushPerkDetails({SOME_ID: 'SOME_VALUE'});

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

        const order = await repository.find(anOrder.id);

        expect(order).not.toBeUndefined();
        expect(order).toEqual(anOrder);
    });

    it('finds order by payment order ID', async () => {
        await repository.save(anOrder);

        const roles = await repository.findByPaymentOrder('PAYMENT_ORDER_ID');

        expect(roles).not.toBeUndefined();
        expect(roles).toEqual([anOrder]);
    });

    it('returns undefined on unknown order Id', async () => {
        await expect(repository.find('UNKNOWN_ORDER_ID')).resolves.toBeUndefined();
    });

    it('finds orders created after', async () => {
        const secondOrder = Order.create(new Date('2025-05-17T18:25:49Z'), anOrder.payment, anOrder.reference);
        const thirdOrder = Order.create(new Date('2025-05-18T18:25:49Z'), anOrder.payment, anOrder.reference);
        anOrder.pay(anOrder.payment.transactionId);
        secondOrder.pay(secondOrder.payment.transactionId);
        thirdOrder.pay(thirdOrder.payment.transactionId);
        await repository.save(anOrder);
        await repository.save(secondOrder);
        await repository.save(thirdOrder);

        const result = await repository.findCreatedAfter(new Date('2025-05-17T01:00:00Z'));
        expect(result).toHaveLength(2);
        expect(result[0].id).toEqual(secondOrder.id);
        expect(result[1].id).toEqual(thirdOrder.id);
    });

    it('finds unpaid orders created before', async () => {
        const secondOrder = Order.create(new Date('2025-05-17T18:25:49Z'), anOrder.payment, anOrder.reference);
        const thirdOrder = Order.create(new Date('2025-05-18T18:25:49Z'), anOrder.payment, anOrder.reference);
        anOrder.pay(anOrder.payment.transactionId);
        await repository.save(anOrder);
        await repository.save(secondOrder);
        await repository.save(thirdOrder);

        const result = await repository.findUnpaidBefore(new Date('2025-05-17T20:25:49Z'));
        expect(result).toHaveLength(1);
        expect(result[0].id).toEqual(secondOrder.id);
    });

    it('does not find order', async () => {
        await repository.save(anOrder);
        await repository.save(Order.create(new Date('2025-05-17T18:25:49Z'), anOrder.payment, anOrder.reference));

        const result = await repository.findCreatedAfter(new Date('2025-05-17T18:25:50Z'));
        expect(result).toHaveLength(0);
    });

    it('deletes order', async () => {
        const secondOrder = Order.create(new Date('2025-05-17T18:25:49Z'), anOrder.payment, anOrder.reference);
        await repository.save(anOrder);
        await repository.save(secondOrder);

        await repository.delete(anOrder);

        await expect(repository.find(anOrder.id)).resolves.toBeUndefined();
        await expect(repository.find(secondOrder.id)).resolves.not.toBeUndefined();
    });

    afterEach(async () => {
        const repo = repository as SQLiteOrderRepository;
        await repo.clear();
        await repo.close();
        fs.rmSync(testDbPath);
    });
});
