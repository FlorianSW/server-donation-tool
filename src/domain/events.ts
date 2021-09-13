import {Order, Subscription, SubscriptionPlan} from './payment';
import {RedeemError, RedeemTarget} from './package';

export interface DonationEvents {
    on(event: 'successfulPayment', listener: (user: RedeemTarget, order: Order) => void): this;
    on(event: 'successfulRedeem', listener: (user: RedeemTarget, order: Order) => void): this;
    on(event: 'subscriptionExecuted', listener: (user: RedeemTarget, plan: SubscriptionPlan, sub: Subscription, order: Order) => void): this;
    on(event: 'subscriptionCreated', listener: (user: RedeemTarget, plan: SubscriptionPlan, sub: Subscription) => void): this;
    on(event: 'subscriptionCancelled', listener: (user: RedeemTarget, plan: SubscriptionPlan, sub: Subscription) => void): this;
    on(event: 'failedRedeemPerk', listener: (user: RedeemTarget, order: Order, error: RedeemError) => void): this;

    off(event: 'successfulPayment', listener: (user: RedeemTarget, order: Order) => void): this;
    off(event: 'successfulRedeem', listener: (user: RedeemTarget, order: Order) => void): this;
    off(event: 'subscriptionExecuted', listener: (user: RedeemTarget, plan: SubscriptionPlan, sub: Subscription, order: Order) => void): this;
    off(event: 'subscriptionCreated', listener: (user: RedeemTarget, plan: SubscriptionPlan, sub: Subscription) => void): this;
    off(event: 'subscriptionCancelled', listener: (user: RedeemTarget, plan: SubscriptionPlan, sub: Subscription) => void): this;
    off(event: 'failedRedeemPerk', listener: (user: RedeemTarget, order: Order, error: RedeemError) => void): this;
}

export interface EventSource {
    emit(event: 'successfulPayment', user: RedeemTarget, order: Order): void;
    emit(event: 'successfulRedeem', user: RedeemTarget, order: Order): void;
    emit(event: 'subscriptionExecuted', user: RedeemTarget, plan: SubscriptionPlan, sub: Subscription, order: Order): void;
    emit(event: 'subscriptionCreated', user: RedeemTarget, plan: SubscriptionPlan, sub: Subscription): void;
    emit(event: 'subscriptionCancelled', user: RedeemTarget, plan: SubscriptionPlan, sub: Subscription): void;
    emit(event: 'failedRedeemPerk', user: RedeemTarget, order: Order, error: RedeemError): void;
}
