import {SubscriptionsRepository} from '../domain/repositories';
import Knex from 'knex';
import * as fs from 'fs';
import {aPackage, aUser} from './perk/testdata.spec';
import {Subscription, SubscriptionPlan} from '../domain/payment';
import {SQLiteSubscriptionsRepository} from './subscriptions-repository';

const testDbPath = __dirname + '/subscriptions-repository.spec.sqlite';

describe('SubscriptionsRepository', () => {
    const aPlan = SubscriptionPlan.create(aPackage, 'A_PRODUCT_ID', 'A_PLAN_ID')
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
        sub.pay('A_PAYMENT_ID');
        await repository.save(sub);
        const roles = await repository.findByPayment('A_PAYMENT_ID');

        expect(roles).toMatchObject({
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

    it('finds by ID', async () => {
        const sub = Subscription.create(aPlan, aUser);
        sub.pay('A_PAYMENT_ID');
        await repository.save(sub);

        const roles = await repository.find(sub.id);

        expect(roles).toMatchObject({
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

    afterEach(async () => {
        const repo = repository as SQLiteSubscriptionsRepository;
        await repo.clear();
        await repo.close();
        fs.rmSync(testDbPath);
    });
});
