import {OrderRepository} from '../domain/repositories';
import Knex from 'knex';
import {Order, Reference} from '../domain/payment';
import {Package} from '../domain/package';
import {inject, singleton} from 'tsyringe';

const tableName = 'order_repository';
const columnOrderId = 'order_id';
const columnCreated = 'created';
const columnTransactionId = 'transaction_id';
const columnSteamId = 'steam_id';
const columnDiscordId = 'discord_id';
const columnPackageId = 'package_id';

@singleton()
export class SQLiteOrderRepository implements OrderRepository {
    private initialized: Promise<boolean>;

    constructor(@inject('DonationsDB') private readonly con: Knex, @inject('packages') private readonly packages: Package[]) {
        this.initialized = new Promise((resolve) => {
            con.schema.hasTable(tableName).then((hasTable) => {
                if (!hasTable) {
                    con.schema.createTable(tableName, (b) => {
                        b.string(columnOrderId).unique('uc_order_id');
                        b.dateTime(columnCreated).index('idx_' + columnCreated);
                        b.string(columnTransactionId);
                        b.string(columnSteamId);
                        b.string(columnDiscordId);
                        b.bigInteger(columnPackageId);
                    }).then(() => {
                        resolve(true);
                    });
                } else {
                    resolve(true);
                }
            });
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

    private toOrder(o: any): Order {
        return {
            id: o[columnOrderId],
            created: new Date(o[columnCreated]),
            transactionId: o[columnTransactionId],
            reference: new Reference(o[columnSteamId], o[columnDiscordId], this.packages.find((p) => p.id === o[columnPackageId])),
        } as Order;
    }

    async find(id: string): Promise<Order | undefined> {
        await this.initialized;
        return this.con
            .table(tableName)
            .where(columnOrderId, '=', id)
            .then((result) => {
                if (result.length === 1) {
                    return this.toOrder(result[0]);
                }
            });
    }

    async findCreatedAfter(after: Date): Promise<Order[]> {
        await this.initialized;
        return this.con
            .table(tableName)
            .where(columnCreated, '>=', after.getTime())
            .then((result) => {
                return result.map((o) => this.toOrder(o));
            });
    }

    async save(order: Order): Promise<void> {
        await this.initialized;
        // @formatter:off
        await this.con.raw(`REPLACE INTO ${tableName} (${columnOrderId}, ${columnCreated}, ${columnTransactionId}, ${columnSteamId}, ${columnDiscordId}, ${columnPackageId}) VALUES(?, ?, ?, ?, ?, ?)`, [
            order.id, order.created.getTime(), order.transactionId, order.reference.steamId, order.reference.discordId, order.reference.p.id
        ]);
        // @formatter:on
    }
}

export class InMemoryOrderRepository implements OrderRepository {
    private readonly orders: Map<string, Order> = new Map();

    async find(id: string): Promise<Order | undefined> {
        return this.orders.get(id);
    }

    async save(order: Order): Promise<void> {
        this.orders.set(order.id, order);
    }

    async findCreatedAfter(after: Date): Promise<Order[]> {
        return Array.from(this.orders.values()).filter((o) => o.created.getTime() >= after.getTime());
    }

    async close(): Promise<void> {
    }
}
