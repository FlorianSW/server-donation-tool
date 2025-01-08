import {SubscriptionPlanRepository} from '../domain/repositories';
import Knex from 'knex';
import * as fs from 'fs';
import {SQLiteSubscriptionPlanRepository} from './subscription-plan-repository';
import {PaymentProvider, SubscriptionPlan} from '../domain/payment';
import {somePackages} from '../test-data.spec';
import {FakePayment} from "./paypal/paypal-payment";

const testDbPath = __dirname + '/subscription-plan-repository.spec.sqlite';

describe('SubscriptionPlanRepository', () => {
    let repository: SubscriptionPlanRepository;
    let provider: PaymentProvider;

    beforeEach(() => {
        const knex = Knex({
            client: 'sqlite3',
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        provider = new FakePayment().provider();
        repository = new SQLiteSubscriptionPlanRepository(knex, [somePackages[0]]);
    });

    it('persists plan', async () => {
        await repository.save(SubscriptionPlan.create(provider, somePackages[0], 'A_PRODUCT_ID', 'A_PLAN_ID'));

        const roles = await repository.findByPackage(provider, somePackages[0]);

        expect(roles).toMatchObject({
            payment: {
                productId: 'A_PRODUCT_ID',
                planId: 'A_PLAN_ID',
            },
            basePackage: somePackages[0],
        } as SubscriptionPlan);
    });

    it('finds by ID', async () => {
        const plan = SubscriptionPlan.create(provider, somePackages[0], 'A_PRODUCT_ID', 'A_PLAN_ID');
        await repository.save(plan);

        const roles = await repository.find(plan.id);

        expect(roles).toMatchObject({
            payment: {
                productId: 'A_PRODUCT_ID',
                planId: 'A_PLAN_ID',
            },
            basePackage: somePackages[0],
        } as SubscriptionPlan);
    });

    afterEach(async () => {
        const repo = repository as SQLiteSubscriptionPlanRepository;
        await repo.clear();
        await repo.close();
        fs.rmSync(testDbPath);
    });
});
