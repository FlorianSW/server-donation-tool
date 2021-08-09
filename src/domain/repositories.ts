import {Order} from './payment';
import {Closeable} from '../index';

export interface ExpiringDiscordRole {
    discordUser: string,
    roleId: string,
    expiresAt: Date,
}

export interface DiscordRoleRepository extends Closeable {
    save(role: ExpiringDiscordRole): Promise<void>
    find(expiresBefore: Date): Promise<ExpiringDiscordRole[]>
    delete(role: ExpiringDiscordRole): Promise<void>
}

export interface OrderRepository extends Closeable {
    save(order: Order): Promise<void>
    find(id: string): Promise<Order | undefined>
    findByPaymentOrder(id: string): Promise<Order | undefined>
    findCreatedAfter(after: Date): Promise<Order[]>
    findUnpaidBefore(after: Date): Promise<Order[]>
    delete(order: Order): Promise<void>
}
