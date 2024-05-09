import {Order, Subscription, SubscriptionPlan} from './payment';
import {Closeable} from '../index';
import {Package} from './package';
import {User} from './user';

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
    findByPaymentOrder(id: string): Promise<Order[]>
    findByTransactionId(id: string): Promise<Order | undefined>
    findCreatedPages(after: Date, before: Date | undefined, iterator: (o: Order[]) => boolean): Promise<boolean>
    findLastFor(user: User, limit: number): Promise<Order[]>
    findUnpaidBefore(after: Date): Promise<Order[]>
    delete(order: Order): Promise<void>
}

export interface SubscriptionPlanRepository extends Closeable {
    save(subscriptionPlan: SubscriptionPlan): Promise<void>
    find(id: string): Promise<SubscriptionPlan>
    findByPackage(p: Package): Promise<SubscriptionPlan>
}

export interface SubscriptionsRepository extends Closeable {
    save(subscription: Subscription): Promise<void>
    delete(subscription: Subscription): Promise<void>
    find(id: string): Promise<Subscription>
    findActive(user: User): Promise<Subscription[]>
    findByPayment(id: string): Promise<Subscription>
}

export interface NitradoPlayer {
    discordUser: string,
    player: string,
    serverId: string,
    expiresAt: Date,
}

export interface NitradoPriorityPlayerRepository extends Closeable {
    save(role: NitradoPlayer): Promise<void>
    find(expiresBefore: Date): Promise<NitradoPlayer[]>
    delete(role: NitradoPlayer): Promise<void>
}
