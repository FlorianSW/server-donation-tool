import {inject, singleton} from 'tsyringe';
import {Order, Payment, PendingSubscription, Reference, Subscription} from '../domain/payment';
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
        @inject('Payment') private readonly payment: Payment,
        @inject('RedeemPackage') private readonly redeem: RedeemPackage,
    ) {
    }

    async subscribe(p: Package, user: User): Promise<PendingSubscription> {
        const plan = await this.subscriptionPlans.findByPackage(p);
        const result = await this.payment.subscribe(plan, user);

        await this.subscriptions.save(Subscription.create(plan, result.id, user));

        return result;
    }

    async redeemSubscriptionPayment(paymentId: string, transactionId: string): Promise<Order> {
        const sub = await this.subscriptions.findByPayment(paymentId);
        const plan = await this.subscriptionPlans.find(sub.planId);

        sub.state = 'ACTIVE';
        await this.subscriptions.save(sub);
        const order = Order.create(new Date(), {
            id: paymentId,
            transactionId: transactionId,
        }, new Reference(sub.user.steamId, sub.user.discordId, plan.basePackage));
        await this.orders.save(order);
        const target = new RedeemTarget(sub.user.steamId, sub.user.discordId);
        await this.redeem.redeem(order, target);
        this.events.emit('successfulSubscriptionExecution', target, order);

        return order;
    }
}
