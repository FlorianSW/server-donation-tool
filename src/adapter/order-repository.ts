import {OrderRepository} from '../domain/repositories';
import {Knex} from 'knex';
import {Order, OrderPayment, OrderStatus, Reference} from '../domain/payment';
import {Package} from '../domain/package';
import {inject, singleton} from 'tsyringe';
import {PaypalPayment} from './paypal/paypal-payment';
import {User} from '../domain/user';
import {VATRate} from '../domain/vat';
import {Logger} from 'winston';

const tableName = 'order_repository';
const columnId = 'id';
const columnOrderId = 'order_id';
const columnCreated = 'created';
const columnStatus = 'status';
const columnCustomMessage = 'custom_message';
const columnTransactionId = 'transaction_id';
const columnSteamId = 'steam_id';
const columnDiscordId = 'discord_id';
const columnPackageId = 'package_id';
const columnPrice = 'price';
const columnRedeemedAt = 'redeemed_at';
const columnRefundedAt = 'refunded_at';
const columnPaymentProvider = 'payment_provider';
const columnPerkDetails = 'perk_details';
const columnCountryCode = 'country_code';
const columnVatRate = 'vat_rate';

@singleton()
export class SQLiteOrderRepository implements OrderRepository {
    private initialized: Promise<boolean>;

    constructor(@inject('DonationsDB') private readonly con: Knex, @inject('packages') private readonly packages: Package[], @inject('Logger') private readonly logger: Logger) {
        this.initialized = new Promise((resolve) => {
            con.schema.hasTable(tableName).then(async (hasTable) => {
                if (!hasTable) {
                    con.schema.createTable(tableName, (b) => {
                        b.string(columnId).unique('uc_id');
                        b.string(columnOrderId);
                        b.dateTime(columnCreated).index('idx_' + columnCreated);
                        b.string(columnTransactionId).nullable().index('idx_' + columnTransactionId);
                        b.integer(columnStatus).index('idx_' + columnStatus);
                        b.string(columnCustomMessage, 255).nullable().defaultTo(null);
                        b.string(columnSteamId).nullable().defaultTo(null);
                        b.string(columnDiscordId).index('idx_' + columnDiscordId);
                        b.bigInteger(columnPackageId);
                        b.float(columnPrice);
                        b.dateTime(columnRedeemedAt).nullable().defaultTo(null);
                        b.dateTime(columnRefundedAt).nullable().defaultTo(null);
                        b.string(columnPaymentProvider, 10).notNullable().defaultTo(PaypalPayment.NAME);
                        b.text(columnPerkDetails).nullable().defaultTo(null);
                        b.string(columnCountryCode, 5).defaultTo('XX');
                        b.float(columnVatRate).defaultTo(0);
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
                    if (!c.hasOwnProperty(columnCustomMessage)) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.string(columnCustomMessage, 255).nullable().defaultTo(null);
                        });
                    }
                    if (!c.hasOwnProperty(columnRedeemedAt)) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.dateTime(columnRedeemedAt).nullable().defaultTo(null);
                        });
                        await con.raw(`UPDATE ${tableName}
                                       SET ${columnRedeemedAt} = ${columnCreated}
                                       WHERE ${columnRedeemedAt} IS NULL;`);
                    }
                    if (!c.hasOwnProperty(columnPaymentProvider)) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.string(columnPaymentProvider, 10).notNullable().defaultTo(PaypalPayment.NAME);
                        });
                    }
                    if (!c.hasOwnProperty(columnPerkDetails)) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.text(columnPerkDetails).nullable().defaultTo('[]');
                        });
                    }
                    if (!c.hasOwnProperty(columnRefundedAt)) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.dateTime(columnRefundedAt).nullable().defaultTo(null);
                        });
                    }
                    if (!c.hasOwnProperty(columnCountryCode)) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.string(columnCountryCode, 5).nullable();
                        });
                    }
                    await con.schema.alterTable(tableName, (b) => {
                        b.setNullable(columnCountryCode);
                    });
                    if (!c.hasOwnProperty(columnVatRate)) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.float(columnVatRate).defaultTo(0);
                        });
                    }
                    if (!(await this.hasIndex('uc_transaction_id'))) {
                        await this.removeDuplicateSubscriptionOrders();
                        await this.con.raw(`CREATE UNIQUE INDEX IF NOT EXISTS uc_${columnTransactionId} ON ${tableName}(${columnTransactionId})`);
                    }
                    if (await this.hasIndex('idx_transaction_id')) {
                        await con.schema.alterTable(tableName, (b) => {
                            b.dropIndex(columnTransactionId, 'idx_transaction_id');
                        });
                    }
                    await con.raw(`CREATE INDEX IF NOT EXISTS idx_${columnDiscordId} ON ${tableName}(${columnDiscordId})`);
                    await con.raw(`CREATE INDEX IF NOT EXISTS idx_${columnTransactionId} ON ${tableName}(${columnTransactionId})`);
                    resolve(true);
                }
            });
        });
    }

    private async removeDuplicateSubscriptionOrders() {
        this.logger.warn('Database requires migration, which will take some time and will be done in the background. Part of these migrations will remove orphaned or duplicated orders...');
        let res = this.con
            .table(tableName)
            .select(columnId, columnTransactionId)
            .where(columnStatus, '>=', OrderStatus.PAID)
            .groupBy(columnTransactionId);

        let counter = 0;
        while (true) {
            const o = await res.offset(counter).limit(25);
            for (let k in o) {
                const order = o[k];
                if (order[columnTransactionId]) {
                    await this.con.table(tableName)
                        .where(columnTransactionId, order[columnTransactionId])
                        .whereNot(columnId, order[columnId])
                        .delete();
                }
            }
            if (counter >= counter + o.length) break;
            counter += o.length;
        }
        this.logger.warn('Database migration finished...');
    }

    private async hasIndex(name: string): Promise<boolean> {
        const idx = await this.con.table('sqlite_master')
            .where('type', 'index')
            .where('name', name)
            .where('tbl_name', tableName)
            .count('name as count')
            .first();

        return idx.count === 1;
    }

    async clear(): Promise<void> {
        await this.initialized;
        await this.con.table(tableName).truncate();
    }

    async close(): Promise<void> {
        await this.con.destroy();
        this.initialized = undefined;
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

    async findByPaymentOrder(id: string): Promise<Order[]> {
        await this.initialized;
        return this.con
            .table(tableName)
            .where(columnOrderId, '=', id)
            .limit(20)
            .then((result) => {
                return result.map((o) => this.toOrder(o));
            });
    }

    async findByTransactionId(id: string): Promise<Order | undefined> {
        await this.initialized;
        return this.con
            .table(tableName)
            .where(columnTransactionId, '=', id)
            .limit(1)
            .then((result) => {
                if (result.length === 1) {
                    return this.toOrder(result[0]);
                }
            });
    }

    async findCreatedPages(after: Date, before: Date | undefined, iterator: (o: Order[]) => boolean): Promise<boolean> {
        await this.initialized;
        let res = this.con
            .table(tableName)
            .where(columnStatus, '>=', OrderStatus.PAID)
            .orderBy(columnCreated);

        if (before) {
            res = res.whereBetween(columnCreated, [after.getTime(), before.getTime()]);
        } else {
            res = res.where(columnCreated, '>=', after.getTime());
        }
        const maxResults = await res.clone().count('id as count').first().then((t) => t.count);
        let counter = 0;
        while (true) {
            const o = await res.offset(counter).limit(25).then((result) => {
                return result.map((o) => this.toOrder(o));
            });
            counter += o.length;
            const r = iterator(o);
            if (r === false) {
                return false;
            }
            if (counter >= maxResults) break;
        }
        return true;
    }

    async findLastFor(user: User, limit: number): Promise<Order[]> {
        await this.initialized;
        return this.con
            .table(tableName)
            .where(columnDiscordId, user.discord.id)
            .orderBy(columnCreated, 'desc')
            .limit(limit)
            .then((result) => {
                return result.map((o) => this.toOrder(o));
            });
    }

    async delete(order: Order): Promise<void> {
        await this.initialized;
        await this.con.table(tableName).where(columnId, order.id).delete();
    }

    async findUnpaidBefore(after: Date): Promise<Order[]> {
        await this.initialized;
        return this.con
            .table(tableName)
            .where(columnCreated, '<=', after.getTime())
            .where(columnStatus, OrderStatus.CREATED)
            .then((result) => {
                return result.map((o) => this.toOrder(o));
            });
    }

    async save(order: Order): Promise<void> {
        await this.initialized;
        // @formatter:off
        await this.con.raw(`REPLACE INTO ${tableName} (${columnId}, ${columnOrderId}, ${columnCreated}, ${columnStatus}, ${columnTransactionId}, ${columnPaymentProvider}, ${columnSteamId}, ${columnDiscordId}, ${columnPackageId}, ${columnPrice}, ${columnCustomMessage}, ${columnRedeemedAt}, ${columnRefundedAt}, ${columnPerkDetails}, ${columnCountryCode}, ${columnVatRate}) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            order.id, order.payment.id, order.created.getTime(), order.status, order.payment.transactionId || null, order.payment.provider, order.reference.steamId || null, order.reference.discordId, order.reference.p.id, parseFloat(order.reference.p.price.amount), order.customMessage, order.redeemedAt || null, order.refundedAt || null, JSON.stringify(Array.from(order.perkDetails.entries())), order.vat?.countryCode || null, order.vat?.rate || 0,
        ]);
        // @formatter:on
    }

    private toOrder(o: any): Order {
        const p = this.packages.find((p) => p.id === o[columnPackageId]);
        const reference = new Reference(o[columnSteamId] || null, o[columnDiscordId], {
            ...p,
            price: {
                ...p.price,
                amount: o[columnPrice].toFixed(2),
            }
        });
        const payment: OrderPayment = {
            id: o[columnOrderId],
            transactionId: o[columnTransactionId],
            provider: o[columnPaymentProvider],
        };
        let vat: VATRate | undefined;
        if (o[columnCountryCode] && o[columnCountryCode] !== '' && o[columnCountryCode] !== 'XX') {
            vat = new VATRate(o[columnCountryCode], o[columnVatRate]);
        }
        return new Order(
            o[columnId],
            new Date(o[columnCreated]),
            reference,
            o[columnCustomMessage] || null,
            vat,
            o[columnRedeemedAt] ? new Date(o[columnRedeemedAt]) : null,
            o[columnStatus],
            payment,
            new Map(JSON.parse(o[columnPerkDetails])),
            o[columnRefundedAt] ? new Date(o[columnRefundedAt]) : null
        );
    }
}

export class InMemoryOrderRepository implements OrderRepository {
    private readonly orders: Map<string, Order> = new Map();

    async find(id: string): Promise<Order | undefined> {
        return this.orders.get(id);
    }

    async findByPaymentOrder(id: string): Promise<Order[]> {
        return Array.from(this.orders.values()).filter((o) => o.payment.id >= id);
    }

    async findByTransactionId(id: string): Promise<Order | undefined> {
        return Array.from(this.orders.values()).filter((o) => o.payment.transactionId >= id)[0];
    }

    async save(order: Order): Promise<void> {
        this.orders.set(order.id, order);
    }

    async findCreatedPages(after: Date, before: Date | undefined, iterator: (o: Order[]) => boolean): Promise<boolean> {
        const a = Array.from(this.orders.values()).filter((o) => o.created.getTime() >= after.getTime());
        if (before) {
            iterator(a.filter((o) => o.created.getTime() <= before.getTime()));
        } else {
            iterator(a);
        }
        return true;
    }

    async findUnpaidBefore(after: Date): Promise<Order[]> {
        return Array.from(this.orders.values()).filter((o) => o.status === OrderStatus.CREATED).filter((o) => o.created.getTime() >= after.getTime());
    }

    async delete(order: Order): Promise<void> {
        this.orders.delete(order.id);
    }

    async close(): Promise<void> {
    }

    async findLastFor(user: User, limit: number): Promise<Order[]> {
        return Array.from(this.orders.values())
            .filter((o) => o.reference.discordId === user.discord.id)
            .sort((o1, o2) => o1.created.getTime() - o2.created.getTime())
            .slice(0, limit - 1);
    }
}
