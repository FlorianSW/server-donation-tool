import {OrderRepository, SubscriptionPlanRepository, SubscriptionsRepository} from '../domain/repositories';
import {
    Order,
    OrderStatus,
    Subscription,
    SubscriptionNotFound,
    SubscriptionPaymentProvider,
    SubscriptionPlan
} from '../domain/payment';
import {InMemorySubscriptionPlanRepository} from '../adapter/subscription-plan-repository';
import {FakePayment} from '../adapter/paypal/paypal-payment';
import {Subscriptions} from './subscriptions';
import {InMemorySubscriptionsRepository} from '../adapter/subscriptions-repository';
import {RedeemPackage} from './redeem-package';
import {InMemoryOrderRepository} from '../adapter/order-repository';
import winston from 'winston';
import {EventQueue} from '../adapter/event-queue';
import {RedeemTarget} from '../domain/package';
import {aUser, somePackages} from '../test-data.spec';
import {randomUUID} from 'crypto';
import DoneCallback = jest.DoneCallback;

describe('Subscriptions', () => {
    let plansRepository: SubscriptionPlanRepository;
    let subRepository: SubscriptionsRepository;
    let orders: OrderRepository;
    let payment: SubscriptionPaymentProvider;
    let events: EventQueue;
    let aPlan: SubscriptionPlan;
    let service: Subscriptions;

    beforeEach(async () => {
        plansRepository = new InMemorySubscriptionPlanRepository();
        subRepository = new InMemorySubscriptionsRepository();
        orders = new InMemoryOrderRepository();
        payment = new FakePayment();
        events = new EventQueue();

        aPlan = await payment.persistSubscription(somePackages[0]);
        await plansRepository.save(aPlan);

        const logger = winston.createLogger();
        service = new Subscriptions(plansRepository, subRepository, orders, events, payment, new RedeemPackage(orders, events, logger), logger);
    });

    it('creates a new subscription for a donator', async () => {
        const result = await service.subscribe(somePackages[0], {}, aUser);

        const subscription = await subRepository.findByPayment(result.id);
        expect(result.approvalLink).not.toBe('');
        expect(subscription.planId).toBe(aPlan.id);
        expect(subscription.user).toEqual({
            steamId: aUser.steam.id,
            discordId: aUser.discord.id,
        });
    });

    it('redeems perks for a subscription payment', (done: DoneCallback) => {
        const tId = randomUUID();
        service.subscribe(somePackages[0], {SOME_ID: 'SOME_DATA'}, aUser).then((sub) => {
            events.on('subscriptionExecuted', (target: RedeemTarget, plan: SubscriptionPlan, sub: Subscription, order: Order) => {
                expect(target.discordId).toEqual(aUser.discord.id);
                expect(target.steamId).toEqual(aUser.steam.id);
                expect(order.payment.transactionId).toEqual(tId);
                expect(order.status).toEqual(OrderStatus.PAID);
                expect(order.perkDetails).toEqual(new Map([['SOME_ID', 'SOME_DATA']]));
                subRepository.findByPayment(sub.payment.id).then((subscription) => {
                    expect(subscription.state).toBe('ACTIVE');
                    done();
                });
            });

            service.redeemSubscriptionPayment(sub.id, tId).then((result) => {
                const order = orders.find(result.id);
                expect(order).not.toBeNull();
            });
        });
    });

    it('does not redeem duplicated webhook message', async () => {
        const tId = randomUUID();
        const sub = await service.subscribe(somePackages[0], {SOME_ID: 'SOME_DATA'}, aUser)

        await service.redeemSubscriptionPayment(sub.id, tId);
        const r = await orders.findByPaymentOrder(sub.id);
        expect(r).toHaveLength(1);

        await service.redeemSubscriptionPayment(sub.id, tId);
        const o = await orders.findByPaymentOrder(sub.id);
        expect(o).toHaveLength(1);
    });

    it('cancels subscription', async () => {
        const ps = await service.subscribe(somePackages[0], {}, aUser);
        const sub = await subRepository.findByPayment(ps.id);

        await service.cancel(sub.id, aUser);

        const result = await subRepository.find(sub.id);
        expect(result.state).toBe('CANCELLED');
    });

    it('notifies subscription about cancellation', async () => {
        const ps = await service.subscribe(somePackages[0], {}, aUser);
        const sub = await subRepository.findByPayment(ps.id);

        await service.notifyCancel(ps.id);

        const result = await subRepository.find(sub.id);
        expect(result.state).toBe('CANCELLED');
    });

    it('errors when other\'s subscription cancelled', async () => {
        const ps = await service.subscribe(somePackages[0], {}, aUser);
        const sub = await subRepository.findByPayment(ps.id);

        await expect(() => service.cancel(sub.id, {
            ...aUser,
            discord: {id: 'ANOTHER_DISCORD_ID', username: 'A_USERNAME', discriminator: '0001'}
        })).rejects.toBeInstanceOf(SubscriptionNotFound);
    });

    it('views subscriptions details and history', async () => {
        const ps = await service.subscribe(somePackages[0], {}, aUser);
        const sub = await subRepository.findByPayment(ps.id);
        const first = await service.redeemSubscriptionPayment(sub.payment.id, randomUUID());
        const second = await service.redeemSubscriptionPayment(sub.payment.id, randomUUID());

        const result = await service.viewSubscription(sub.id, aUser);

        expect(result.subscription.id).toEqual(sub.id);
        expect(result.plan).toEqual(aPlan);
        expect(result.history).toHaveLength(2);
        expect(result.history[0].id).toEqual(first.id);
        expect(result.history[1].id).toEqual(second.id);
    });
});
