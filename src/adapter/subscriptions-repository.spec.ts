import {SubscriptionsRepository} from '../domain/repositories';
import Knex from 'knex';
import * as fs from 'fs';
import {Subscription, SubscriptionPlan} from '../domain/payment';
import {SQLiteSubscriptionsRepository} from './subscriptions-repository';
import {FakePayment} from './paypal/paypal-payment';
import {anotherUser, aUser, somePackages} from '../test-data.spec';

const testDbPath = __dirname + '/subscriptions-repository.spec.sqlite';

describe('SubscriptionsRepository', () => {
    const aPlan = SubscriptionPlan.create(somePackages[0], 'A_PRODUCT_ID', 'A_PLAN_ID')
    let repository: SubscriptionsRepository;

    beforeEach(() => {
        const knex = Knex({
            client: 'sqlite3',
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        repository = new SQLiteSubscriptionsRepository(knex);
    });

    it('persists subscription', async () => {
        const sub = Subscription.create(aPlan, aUser);
        sub.agreeBilling('A_PAYMENT_ID');
        sub.pushPerkDetails({SOME_ID: 'SOME_DATA'});
        await repository.save(sub);
        const subs = await repository.findByPayment('A_PAYMENT_ID');

        expect(subs).toMatchObject({
            user: {
                steamId: aUser.steam.id,
                discordId: aUser.discord.id,
            },
            payment: {
                id: 'A_PAYMENT_ID',
            },
            state: 'PENDING',
            planId: aPlan.id,
            perkDetails: new Map([['SOME_ID', 'SOME_DATA']]),
        } as Subscription);
    });

    it('finds by ID', async () => {
        const sub = Subscription.create(aPlan, aUser);
        sub.agreeBilling('A_PAYMENT_ID');
        await repository.save(sub);

        const subs = await repository.find(sub.id);

        expect(subs).toMatchObject({
            user: {
                steamId: aUser.steam.id,
                discordId: aUser.discord.id,
            },
            payment: {
                id: 'A_PAYMENT_ID',
            },
            state: 'PENDING',
            planId: aPlan.id,
        } as Subscription);
    });

    it('finds active subscriptions', async () => {
        const sub = Subscription.create(aPlan, aUser);
        sub.agreeBilling('A_PAYMENT_ID');
        await repository.save(sub);

        const sub2 = Subscription.create(aPlan, aUser);
        sub2.agreeBilling('A_PAYMENT_ID2');
        await repository.save(sub2);

        const sub3 = Subscription.create(aPlan, aUser);
        sub3.agreeBilling('A_PAYMENT_ID3');
        sub3.pay('A_TRANSACTION_ID', FakePayment.NAME, somePackages[0]);
        await repository.save(sub3);

        const cancelled = Subscription.create(aPlan, aUser);
        cancelled.agreeBilling('A_PAYMENT_ID');
        cancelled.cancel();
        await repository.save(cancelled);

        const anotherSub = Subscription.create(aPlan, anotherUser);
        anotherSub.agreeBilling('ANOTHER_PAYMENT');
        await repository.save(anotherSub);

        const subs = await repository.findActive(aUser);

        expect(subs).toHaveLength(3);
        const validIds = [sub.id, sub2.id, sub3.id];
        for (let sub of subs) {
            expect(validIds).toContain(sub.id);
            expect(sub.isActive()).toBe(true);
        }
    });

    it('deletes a subscription', async () => {
        const sub = Subscription.create(aPlan, aUser);
        sub.agreeBilling('A_PAYMENT_ID');
        await repository.save(sub);

        await repository.delete(sub);

        await expect(repository.find(sub.id)).resolves.toBeUndefined();
    });

    afterEach(async () => {
        const repo = repository as SQLiteSubscriptionsRepository;
        await repo.clear();
        await repo.close();
        fs.rmSync(testDbPath);
    });
});
