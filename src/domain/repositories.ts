import {Order} from './payment';

export interface ExpiringDiscordRole {
    discordUser: string,
    roleId: string,
    expiresAt: Date,
}

export interface DiscordRoleRepository {
    save(role: ExpiringDiscordRole): Promise<void>
    find(expiresBefore: Date): Promise<ExpiringDiscordRole[]>
    delete(role: ExpiringDiscordRole): Promise<void>
    close(): Promise<void>
}

export interface OrderRepository {
    save(order: Order): Promise<void>
    find(id: string): Promise<Order | undefined>
}
