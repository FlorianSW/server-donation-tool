import {inject, injectAll, singleton} from 'tsyringe';
import {
    Order, Payment,
    PendingSubscription,
    Subscription,
    SubscriptionNotFound,
    SubscriptionNotPending,
    SubscriptionPaymentProvider,
    SubscriptionPlan
} from '../domain/payment';
import {User} from '../domain/user';
import {Package, PerkDetails, RedeemTarget} from '../domain/package';
import {OrderRepository, SubscriptionPlanRepository, SubscriptionsRepository} from '../domain/repositories';
import {RedeemPackage} from './redeem-package';
import {EventSource} from '../domain/events';
import {VATRate} from '../domain/vat';
import {Logger} from 'winston';

@singleton()
export class Subscriptions {
    constructor(
        @inject('SubscriptionPlanRepository') private readonly subscriptionPlans: SubscriptionPlanRepository,
        @inject('SubscriptionsRepository') private readonly subscriptions: SubscriptionsRepository,
        @inject('OrderRepository') private readonly orders: OrderRepository,
        @inject('EventSource') private readonly events: EventSource,
        @injectAll('SubscriptionPaymentProvider') private readonly payments: SubscriptionPaymentProvider[],
        @inject('RedeemPackage') private readonly redeem: RedeemPackage,
        @inject('Logger') private readonly logger: Logger,
    ) {
    }

    async subscribe(paymentProvider: SubscriptionPaymentProvider, p: Package, perkDetails: PerkDetails, user: User, vat?: VATRate): Promise<PendingSubscription> {
        const plan = await this.subscriptionPlans.findByPackage(paymentProvider.provider(), p);
        const sub = Subscription.create(plan, user, vat);
        sub.pushPerkDetails(perkDetails);
        const result = await paymentProvider.subscribe(sub, plan, user, vat);
        sub.agreeBilling(result.id);
        await this.subscriptions.save(sub);

        return result;
    }

    async redeemSubscriptionPayment(paymentId: string, transactionId: string): Promise<Order | undefined> {
        const sub = await this.subscriptions.findByPayment(paymentId);
        const plan = await this.subscriptionPlans.find(sub.planId);
        const target = new RedeemTarget({steam: sub.user.steamId, discord: sub.user.discordId}, sub.user.discordId);
        if (sub.state === 'PENDING') {
            this.events.emit('subscriptionCreated', target, plan, sub);
        }

        if (await this.orders.findByTransactionId(transactionId)) {
            this.logger.info('Found duplicated subscription execution', {transactionId: transactionId});
            return;
        }

        const provider = this.payments.find((p) => p.provider().id === plan.provider);
        if (!provider) {
            this.logger.error('Payment provider does not exist anymore or does not support subscriptions', {provider: plan.provider});
            return;
        }
        const order = sub.pay(transactionId, provider.provider().branding.name, plan.basePackage);
        order.pushPerkDetails(Object.fromEntries(sub.perkDetails.entries()));
        await this.subscriptions.save(sub);
        await this.orders.save(order);
        await this.redeem.redeem(order, target, order.reference.p.perks);
        this.events.emit('subscriptionExecuted', target, plan, sub, order);

        return order;
    }

    async viewSubscription(id: string, forUser: User): Promise<ViewSubscription> {
        let subscription = await this.subscription(id, forUser);
        const orders = await this.orders.findByPaymentOrder(subscription.payment.id);
        const plan = await this.subscriptionPlans.find(subscription.planId);

        const provider = this.payments.find((p) => p.provider().id === plan.provider);
        if (!provider) {
            this.logger.error('Payment provider does not exist anymore or does not support subscriptions', {provider: plan.provider});
            return;
        }
        let pending: PendingSubscription | null;
        if (subscription.state !== 'CANCELLED') {
            const paymentStatus = await provider.subscriptionDetails(subscription);
            if (paymentStatus.updatePayment) {
                subscription.payment.id = paymentStatus.updatePayment.id;
                await this.subscriptions.save(subscription);
            }
            if (!paymentStatus) {
                await this.cancel(subscription.id, forUser);
                subscription = await this.subscription(id, forUser);
            }
            if (paymentStatus && paymentStatus.state === 'APPROVAL_PENDING') {
                pending = {
                    id: subscription.payment.id,
                    approvalLink: paymentStatus.approvalLink
                } as PendingSubscription;
            }
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
        const plan = await this.subscriptionPlans.find(subscription.planId);
        const provider = this.payments.find((p) => p.provider().id === plan.provider);
        if (!provider) {
            this.logger.error('Payment provider does not exist anymore or does not support subscriptions', {provider: plan.provider});
            return;
        }
        const paymentStatus = await provider.subscriptionDetails(subscription);
        if (paymentStatus && (paymentStatus.state === 'APPROVED' || paymentStatus.state === 'ACTIVE')) {
            await provider.cancelSubscription(subscription);
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
        this.events.emit('subscriptionCancelled', new RedeemTarget({steam: subscription.user.steamId, discord: subscription.user.discordId}, subscription.user.discordId), plan, subscription);
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
export class StubSubscriptions {
}
