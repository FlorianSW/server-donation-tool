import {OrderRepository} from '../domain/repositories';
import Knex from 'knex';
import * as fs from 'fs';
import {SQLiteOrderRepository} from './order-repository';
import {Order, Reference} from '../domain/payment';
import {anOrder, asRedeemed, asRefunded, makeOrder, somePackages, withCreatedDate} from '../test-data.spec';

const testDbPath = __dirname + '/order-repository.spec.sqlite';

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

        repository = new SQLiteOrderRepository(knex, somePackages);
    });

    it('persists order', async () => {
        const order = makeOrder(withCreatedDate(new Date('2025-05-16T18:25:49Z')), asRedeemed(new Date('2025-05-16T18:25:49Z')), asRefunded(new Date('2025-05-16T18:25:49Z')));
        await repository.save(order);

        const saved = await repository.find(order.id);

        expect(saved).not.toBeUndefined();
        expect(saved).toEqual(order);
    });

    it('finds order by payment order ID', async () => {
        await repository.save(anOrder);

        const roles = await repository.findByPaymentOrder(anOrder.payment.id);

        expect(roles).not.toBeUndefined();
        expect(roles).toEqual([anOrder]);
    });

    it('finds order by transaction ID', async () => {
        await repository.save(anOrder);

        const roles = await repository.findByTransactionId(anOrder.payment.transactionId);

        expect(roles).not.toBeUndefined();
        expect(roles).toEqual(anOrder);
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

        const result: Order[] = [];
        await repository.findCreatedPages(new Date('2025-05-17T01:00:00Z'), undefined, (o) => {
            result.push(...o);
            return true;
        });
        expect(result).toHaveLength(2);
        expect(result[0].id).toEqual(secondOrder.id);
        expect(result[1].id).toEqual(thirdOrder.id);
    });

    it('finds orders created between', async () => {
        const secondOrder = Order.create(new Date('2025-05-17T18:25:49Z'), anOrder.payment, anOrder.reference);
        const thirdOrder = Order.create(new Date('2025-05-18T18:25:49Z'), anOrder.payment, anOrder.reference);
        anOrder.pay(anOrder.payment.transactionId);
        secondOrder.pay(secondOrder.payment.transactionId);
        thirdOrder.pay(thirdOrder.payment.transactionId);
        await repository.save(anOrder);
        await repository.save(secondOrder);
        await repository.save(thirdOrder);

        const result: Order[] = [];
        await repository.findCreatedPages(new Date('2025-05-17T01:00:00Z'), new Date('2025-05-18T00:00:00Z'), (o) => {
            result.push(...o);
            return true;
        });
        expect(result).toHaveLength(1);
        expect(result[0].id).toEqual(secondOrder.id);
    });

    it('finds orders for specific user', async () => {
        const secondOrder = Order.create(new Date('2025-05-17T18:25:49Z'), anOrder.payment, anOrder.reference);
        const thirdOrder = Order.create(new Date('2025-05-18T18:25:49Z'), anOrder.payment, new Reference('A_STEAM_ID', 'ANOTHER_DISCORD_ID', somePackages[0]));
        anOrder.pay(anOrder.payment.transactionId);
        secondOrder.pay(secondOrder.payment.transactionId);
        thirdOrder.pay(thirdOrder.payment.transactionId);
        await repository.save(anOrder);
        await repository.save(secondOrder);
        await repository.save(thirdOrder);

        const result = await repository.findLastFor({
            discord: {
                id: anOrder.reference.discordId,
                username: 'A_USERNAME',
                discriminator: '0001'
            }, username: 'A_NAME', subscribedPackages: {}
        }, 1);
        expect(result).toHaveLength(1);
        expect(result[0].id).toEqual(secondOrder.id);
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

        const result: Order[] = [];
        await repository.findCreatedPages(new Date('2025-05-17T18:25:50Z'), undefined, (o) => {
            result.push(...o);
            return true;
        });
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
