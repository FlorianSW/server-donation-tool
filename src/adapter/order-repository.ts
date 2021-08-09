import {OrderRepository} from '../domain/repositories';
import Knex from 'knex';
import {Order, OrderStatus, Reference} from '../domain/payment';
import {Package} from '../domain/package';
import {inject, singleton} from 'tsyringe';

const tableName = 'order_repository';
const columnId = 'id';
const columnOrderId = 'order_id';
const columnCreated = 'created';
const columnStatus = 'status';
const columnTransactionId = 'transaction_id';
const columnSteamId = 'steam_id';
const columnDiscordId = 'discord_id';
const columnPackageId = 'package_id';
const columnPrice = 'price';

@singleton()
export class SQLiteOrderRepository implements OrderRepository {
    private initialized: Promise<boolean>;

    constructor(@inject('DonationsDB') private readonly con: Knex, @inject('packages') private readonly packages: Package[]) {
        this.initialized = new Promise((resolve) => {
            con.schema.hasTable(tableName).then(async (hasTable) => {
                if (!hasTable) {
                    con.schema.createTable(tableName, (b) => {
                        b.string(columnId).unique('uc_id');
                        b.string(columnOrderId);
                        b.dateTime(columnCreated).index('idx_' + columnCreated);
                        b.string(columnTransactionId).nullable();
                        b.integer(columnStatus).index('idx_' + columnStatus);
                        b.string(columnSteamId);
                        b.string(columnDiscordId).index('idx_' + columnDiscordId);
                        b.bigInteger(columnPackageId);
                        b.float(columnPrice);
                    }).then(() => {
                        resolve(true);
                    });
                } else {
                    const c = await con.table(tableName).columnInfo() as any as {}[];
                    if (!c.hasOwnProperty(columnId)) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.dropIndex(columnOrderId, 'uc_order_id');
                            b.string(columnId).unique('uc_id');
                        });
                    }
                    if (!c.hasOwnProperty(columnPrice)) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.float(columnPrice);
                        });
                    }
                    if (!c.hasOwnProperty(columnStatus)) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.integer(columnStatus).index('idx_' + columnStatus);
                        });
                        await con.table(tableName).update(columnStatus, OrderStatus.CREATED).whereNull(columnTransactionId);
                        await con.table(tableName).update(columnStatus, OrderStatus.PAID).whereNotNull(columnTransactionId);
                    }
                    await con.raw(`CREATE INDEX IF NOT EXISTS idx_${columnDiscordId} ON ${tableName}(${columnDiscordId})`);
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
        const p = this.packages.find((p) => p.id === o[columnPackageId]);
        return {
            id: o[columnId],
            created: new Date(o[columnCreated]),
            payment: {
                id: o[columnOrderId],
                transactionId: o[columnTransactionId],
            },
            status: o[columnStatus],
            reference: new Reference(o[columnSteamId], o[columnDiscordId], {
                ...p,
                price: {
                    ...p.price,
                    amount: o[columnPrice].toFixed(2),
                }
            }),
        } as Order;
    }

    async find(id: string): Promise<Order | undefined> {
        await this.initialized;
        return this.con
            .table(tableName)
            .where(columnId, '=', id)
            .then((result) => {
                if (result.length === 1) {
                    return this.toOrder(result[0]);
                }
            });
    }

    async findByPaymentOrder(id: string): Promise<Order | undefined> {
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
            .where(columnStatus, '>=', OrderStatus.PAID)
            .then((result) => {
                return result.map((o) => this.toOrder(o));
            });
    }

    async save(order: Order): Promise<void> {
        await this.initialized;
        // @formatter:off
        await this.con.raw(`REPLACE INTO ${tableName} (${columnId}, ${columnOrderId}, ${columnCreated}, ${columnStatus}, ${columnTransactionId}, ${columnSteamId}, ${columnDiscordId}, ${columnPackageId}, ${columnPrice}) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            order.id, order.payment.id, order.created.getTime(), order.status, order.payment.transactionId || null, order.reference.steamId, order.reference.discordId, order.reference.p.id, parseFloat(order.reference.p.price.amount)
        ]);
        // @formatter:on
    }
}

export class InMemoryOrderRepository implements OrderRepository {
    private readonly orders: Map<string, Order> = new Map();

    async find(id: string): Promise<Order | undefined> {
        return this.orders.get(id);
    }

    async findByPaymentOrder(id: string): Promise<Order | undefined> {
        return Array.from(this.orders.values()).find((o) => o.payment.id >= id);
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
