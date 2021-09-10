import {OrderRepository, SubscriptionPlanRepository, SubscriptionsRepository} from '../domain/repositories';
import {Order, Payment, SubscriptionPlan} from '../domain/payment';
import {InMemorySubscriptionPlanRepository} from '../adapter/subscription-plan-repository';
import {FakePayment} from '../adapter/paypal-payment';
import {Subscriptions} from './subscriptions';
import {InMemorySubscriptionsRepository} from '../adapter/subscriptions-repository';
import {aPackage, aUser} from '../adapter/perk/testdata.spec';
import {RedeemPackage} from './redeem-package';
import {InMemoryOrderRepository} from '../adapter/order-repository';
import winston from 'winston';
import {EventQueue} from '../adapter/event-queue';
import {RedeemTarget} from '../domain/package';
import DoneCallback = jest.DoneCallback;

describe('Subscriptions', () => {
    let plansRepository: SubscriptionPlanRepository;
    let subRepository: SubscriptionsRepository;
    let orders: OrderRepository;
    let payment: Payment;
    let events: EventQueue;
    let aPlan: SubscriptionPlan;
    let service: Subscriptions;

    beforeEach(async () => {
        plansRepository = new InMemorySubscriptionPlanRepository();
        subRepository = new InMemorySubscriptionsRepository();
        orders = new InMemoryOrderRepository();
        payment = new FakePayment();
        events = new EventQueue();

        aPlan = await payment.persistSubscription(aPackage);
        await plansRepository.save(aPlan);

        service = new Subscriptions(plansRepository, subRepository, orders, events, payment, new RedeemPackage(orders, events, winston.createLogger()));
    });

    it('creates a new subscription for a donator', async () => {
        const result = await service.subscribe(aPackage, aUser);

        const subscription = await subRepository.findByPayment(result.id);
        expect(result.approvalLink).not.toBe('');
        expect(subscription.planId).toBe(aPlan.id);
        expect(subscription.user).toEqual({
            steamId: aUser.steam.id,
            discordId: aUser.discord.id,
        });
    });

    it('redeems perks for a subscription payment', (done: DoneCallback) => {
        service.subscribe(aPackage, aUser).then((sub) => {
            events.on('successfulSubscriptionExecution', (target: RedeemTarget, order: Order) => {
                expect(target.discordId).toEqual(aUser.discord.id);
                expect(target.steamId).toEqual(aUser.steam.id);
                expect(order.payment.transactionId).toEqual('A_TRANSACTION_ID');
                subRepository.findByPayment(sub.id).then((subscription) => {
                    expect(subscription.state).toBe('ACTIVE');
                    done();
                });
            });

            service.redeemSubscriptionPayment(sub.id, 'A_TRANSACTION_ID').then((result) => {
                const order = orders.find(result.id);
                expect(order).not.toBeNull();
            });
        });
    });
});
