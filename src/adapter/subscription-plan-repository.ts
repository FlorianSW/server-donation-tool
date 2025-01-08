import {SubscriptionPlanRepository} from '../domain/repositories';
import {Knex} from 'knex';
import {inject, singleton} from 'tsyringe';
import {PaymentProvider, SubscriptionPlan} from '../domain/payment';
import {Package} from '../domain/package';

const tableName = 'subscription_plans';
const columnId = 'id';
const columnBasePackage = 'package_id';
const columnProductId = 'product_id';
const columnPlanId = 'plan_id';
const columnProvider = 'provider';

@singleton()
export class SQLiteSubscriptionPlanRepository implements SubscriptionPlanRepository {
    private initialized: Promise<boolean>;

    constructor(@inject('DonationsDB') private readonly con: Knex, @inject('packages') private readonly packages: Package[]) {
        this.initialized = new Promise((resolve) => {
            con.schema.hasTable(tableName).then(async (hasTable) => {
                if (!hasTable) {
                    con.schema.createTable(tableName, (b) => {
                        b.string(columnId).primary('primary_id');
                        b.integer(columnBasePackage).index('idx_package');
                        b.string(columnProductId).unique('uc_product_id');
                        b.string(columnPlanId);
                        b.string(columnProvider);
                    }).then(() => {
                        resolve(true);
                    });
                } else {
                    const c = await con.table(tableName).columnInfo() as any as {}[];
                    if (!c.hasOwnProperty(columnProvider)) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.string(columnProvider).defaultTo('paypal');
                        });
                    }
                    resolve(true);
                }
            });
        });
    }

    async save(plan: SubscriptionPlan): Promise<void> {
        await this.initialized;
        // @formatter:off
        await this.con.raw(`REPLACE INTO ${tableName} (${columnId}, ${columnBasePackage}, ${columnProductId}, ${columnPlanId}, ${columnProvider}) VALUES (?, ?, ?, ?, ?)`, [
            plan.id, plan.basePackage.id, plan.payment.productId, plan.payment.planId, plan.provider,
        ]);
        // @formatter:on
    }

    async findByPackage(provider: PaymentProvider, p: Package): Promise<SubscriptionPlan | undefined> {
        await this.initialized;
        return this.con
            .table(tableName)
            .where(columnBasePackage, p.id).and.where(columnProvider, provider.id)
            .then((result) => {
                return this.toSubscriptionPlan(result);
            });
    }

    async find(id: string): Promise<SubscriptionPlan | undefined> {
        await this.initialized;
        return this.con
            .table(tableName)
            .limit(1)
            .where(columnId, id)
            .then((result) => {
                return this.toSubscriptionPlan(result);
            });
    }

    async clear(): Promise<void> {
        await this.initialized;
        await this.con.table(tableName).truncate();
    }

    async close(): Promise<void> {
        await this.con.destroy();
        this.initialized = undefined;
    }

    private toSubscriptionPlan(result: any[]): SubscriptionPlan {
        if (result.length !== 1) {
            return undefined;
        }
        const o = result[0];
        const p = this.packages.find((p) => p.id === o[columnBasePackage]);
        return new SubscriptionPlan(
            o[columnId],
            p,
            o[columnProvider],
            {
                productId: o[columnProductId],
                planId: o[columnPlanId],
            }
        );
    }
}

export class InMemorySubscriptionPlanRepository implements SubscriptionPlanRepository {
    private readonly plans: Map<number, SubscriptionPlan> = new Map();

    async close(): Promise<void> {
    }

    async find(id: string): Promise<SubscriptionPlan | undefined> {
        return Array.from(this.plans.values()).find((sp) => sp.id === id);
    }

    async findByPackage(provider: PaymentProvider, p: Package): Promise<SubscriptionPlan | undefined> {
        return this.plans.get(p.id);
    }

    async save(plan: SubscriptionPlan): Promise<void> {
        this.plans.set(plan.basePackage.id, plan);
    }
}

