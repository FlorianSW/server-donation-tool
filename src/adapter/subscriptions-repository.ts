import {SubscriptionsRepository} from '../domain/repositories';
import Knex from 'knex';
import {inject, singleton} from 'tsyringe';
import {Subscription} from '../domain/payment';

const tableName = 'subscriptions';
const columnId = 'id';
const columnPlanId = 'plan_id';
const columnPaymentId = 'payment_id';
const columnUserSteamId = 'steam_id';
const columnUserDiscordId = 'discord_id';
const columnState = 'state';

@singleton()
export class SQLiteSubscriptionsRepository implements SubscriptionsRepository {
    private initialized: Promise<boolean>;

    constructor(@inject('DonationsDB') private readonly con: Knex) {
        this.initialized = new Promise((resolve) => {
            con.schema.hasTable(tableName).then((hasTable) => {
                if (!hasTable) {
                    con.schema.createTable(tableName, (b) => {
                        b.string(columnId).primary('primary_id');
                        b.string(columnPlanId);
                        b.string(columnPaymentId).index('idx_payment_id');
                        b.string(columnUserSteamId);
                        b.string(columnUserDiscordId).index('idx_discord_id');
                        b.string(columnState);
                    }).then(() => {
                        resolve(true);
                    });
                } else {
                    resolve(true);
                }
            });
        });
    }

    async save(s: Subscription): Promise<void> {
        await this.initialized;
        // @formatter:off
        await this.con.raw(`REPLACE INTO ${tableName} (${columnId}, ${columnPlanId}, ${columnPaymentId}, ${columnUserSteamId}, ${columnUserDiscordId}, ${columnState}) VALUES (?, ?, ?, ?, ?, ?)`, [
            s.id, s.planId, s.payment.id, s.user.steamId, s.user.discordId, s.state
        ]);
        // @formatter:on
    }

    async delete(sub: Subscription): Promise<void> {
        await this.initialized;
        await this.con.table(tableName).where(columnId, sub.id).delete();
    }

    async findByPayment(id: string): Promise<Subscription | undefined> {
        await this.initialized;
        return this.con
            .table(tableName)
            .limit(1)
            .where(columnPaymentId, id)
            .then((result) => {
                return this.toSubscription(result);
            });
    }

    async find(id: string): Promise<Subscription | undefined> {
        await this.initialized;
        return this.con
            .table(tableName)
            .limit(1)
            .where(columnId, id)
            .then((result) => {
                return this.toSubscription(result);
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

    private toSubscription(result: any[]): Subscription {
        if (result.length !== 1) {
            return undefined;
        }
        const o = result[0];
        return new Subscription(
            o[columnId],
            o[columnPlanId],
            {
                id: o[columnPaymentId],
            },
            {
                discordId: o[columnUserDiscordId],
                steamId: o[columnUserSteamId],
            },
            o[columnState],
        );
    }
}

export class InMemorySubscriptionsRepository implements SubscriptionsRepository {
    private readonly subscriptions: Map<string, Subscription> = new Map();

    async close(): Promise<void> {
    }

    async findByPayment(id: string): Promise<Subscription | undefined> {
        return this.subscriptions.get(id);
    }

    async delete(subscription: Subscription): Promise<void> {
        this.subscriptions.delete(subscription.id);
    }

    async find(id: string): Promise<Subscription | undefined> {
        return Array.from(this.subscriptions.values()).find((s) => s.id === id);
    }

    async save(s: Subscription): Promise<void> {
        this.subscriptions.set(s.payment.id, s);
    }
}

