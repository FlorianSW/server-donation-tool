import {SubscriptionPlanRepository} from '../domain/repositories';
import Knex from 'knex';
import * as fs from 'fs';
import {SQLiteSubscriptionPlanRepository} from './subscription-plan-repository';
import {aPackage} from './perk/testdata.spec';
import {SubscriptionPlan} from '../domain/payment';

const testDbPath = __dirname + '/subscription-plan-repository.spec.sqlite';

describe('SubscriptionPlanRepository', () => {
    let repository: SubscriptionPlanRepository;

    beforeEach(() => {
        const knex = Knex({
            client: 'sqlite3',
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        repository = new SQLiteSubscriptionPlanRepository(knex, [aPackage]);
    });

    it('persists plan', async () => {
        await repository.save(SubscriptionPlan.create(aPackage, 'A_PRODUCT_ID', 'A_PLAN_ID'));

        const roles = await repository.findByPackage(aPackage);

        expect(roles).toMatchObject({
            payment: {
                productId: 'A_PRODUCT_ID',
                planId: 'A_PLAN_ID',
            },
            basePackage: aPackage,
        } as SubscriptionPlan);
    });

    it('finds by ID', async () => {
        const plan = SubscriptionPlan.create(aPackage, 'A_PRODUCT_ID', 'A_PLAN_ID');
        await repository.save(plan);

        const roles = await repository.find(plan.id);

        expect(roles).toMatchObject({
            payment: {
                productId: 'A_PRODUCT_ID',
                planId: 'A_PLAN_ID',
            },
            basePackage: aPackage,
        } as SubscriptionPlan);
    });

    afterEach(async () => {
        const repo = repository as SQLiteSubscriptionPlanRepository;
        await repo.clear();
        await repo.close();
        fs.rmSync(testDbPath);
    });
});
