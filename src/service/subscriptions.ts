import {inject, singleton} from 'tsyringe';
import {
    Order,
    PendingSubscription,
    Subscription,
    SubscriptionNotFound,
    SubscriptionNotPending,
    SubscriptionPaymentProvider,
    SubscriptionPlan
} from '../domain/payment';
import {User} from '../domain/user';
import {Package, RedeemTarget} from '../domain/package';
import {OrderRepository, SubscriptionPlanRepository, SubscriptionsRepository} from '../domain/repositories';
import {RedeemPackage} from './redeem-package';
import {EventSource} from '../domain/events';

@singleton()
export class Subscriptions {
    constructor(
        @inject('SubscriptionPlanRepository') private readonly subscriptionPlans: SubscriptionPlanRepository,
        @inject('SubscriptionsRepository') private readonly subscriptions: SubscriptionsRepository,
        @inject('OrderRepository') private readonly orders: OrderRepository,
        @inject('EventSource') private readonly events: EventSource,
        @inject('SubscriptionPaymentProvider') private readonly payment: SubscriptionPaymentProvider,
        @inject('RedeemPackage') private readonly redeem: RedeemPackage,
    ) {
    }

    async subscribe(p: Package, user: User): Promise<PendingSubscription> {
        const plan = await this.subscriptionPlans.findByPackage(p);
        const sub = Subscription.create(plan, user);
        const result = await this.payment.subscribe(sub, plan, user);
        sub.agreeBilling(result.id);
        await this.subscriptions.save(sub);

        return result;
    }

    async redeemSubscriptionPayment(paymentId: string, transactionId: string): Promise<Order> {
        const sub = await this.subscriptions.findByPayment(paymentId);
        const plan = await this.subscriptionPlans.find(sub.planId);
        const target = new RedeemTarget(sub.user.steamId, sub.user.discordId);
        if (sub.state === 'PENDING') {
            this.events.emit('subscriptionCreated', target, plan, sub);
        }

        const order = sub.pay(transactionId, this.payment.provider().branding.name, plan.basePackage);
        await this.subscriptions.save(sub);
        await this.orders.save(order);
        await this.redeem.redeem(order, target, order.reference.p.perks);
        this.events.emit('subscriptionExecuted', target, plan, sub, order);

        return order;
    }

    async viewSubscription(id: string, forUser: User): Promise<ViewSubscription> {
        const subscription = await this.subscription(id, forUser);
        const orders = await this.orders.findByPaymentOrder(subscription.payment.id);
        const plan = await this.subscriptionPlans.find(subscription.planId);
        const paymentStatus = await this.payment.subscriptionDetails(subscription);
        let pending: PendingSubscription | null;
        if (paymentStatus.state === 'APPROVAL_PENDING') {
            pending = {
                id: subscription.payment.id,
                approvalLink: paymentStatus.approvalLink
            } as PendingSubscription;
        }

        return {
            subscription: subscription,
            plan: plan,
            history: orders,
            pending: pending,
        };
    }

    async cancel(id: string, forUser: User): Promise<void> {
        const subscription = await this.subscription(id, forUser);
        const paymentStatus = await this.payment.subscriptionDetails(subscription);
        if (paymentStatus.state === 'APPROVED' || paymentStatus.state === 'ACTIVE') {
            await this.payment.cancelSubscription(subscription);
        }
        subscription.cancel();
        await this.subscriptions.save(subscription);
    }

    async notifyCancel(paymentId: string): Promise<void> {
        const subscription = await this.subscriptions.findByPayment(paymentId);
        const plan = await this.subscriptionPlans.find(subscription.planId);
        if (!subscription) {
            throw new SubscriptionNotFound();
        }
        subscription.cancel();
        await this.subscriptions.save(subscription);
        this.events.emit('subscriptionCancelled', new RedeemTarget(subscription.user.steamId, subscription.user.discordId), plan, subscription);
    }

    async abort(id: string, forUser: User): Promise<void> {
        const subscription = await this.subscription(id, forUser);
        if (!subscription) {
            throw new SubscriptionNotFound();
        }
        if (subscription.state !== 'PENDING') {
            throw new SubscriptionNotPending();
        }
        await this.subscriptions.delete(subscription);
    }

    private async subscription(id: string, forUser: User): Promise<Subscription> {
        const subscription = await this.subscriptions.find(id);
        if (!subscription || subscription.user.discordId !== forUser.discord.id) {
            throw new SubscriptionNotFound();
        }
        return subscription;
    }
}

export interface ViewSubscription {
    subscription: Subscription,
    plan: SubscriptionPlan,
    history: Order[],
    pending: PendingSubscription | null;
}

@singleton()
export class StubSubscriptions {}
