import {Order} from './payment';
import {RedeemError, RedeemTarget} from './package';

export interface DonationEvents {
    on(event: 'successfulPayment', listener: (user: RedeemTarget, order: Order) => void): this;
    on(event: 'successfulRedeem', listener: (user: RedeemTarget, order: Order) => void): this;
    on(event: 'successfulSubscriptionExecution', listener: (user: RedeemTarget, order: Order) => void): this;
    on(event: 'failedRedeemPerk', listener: (user: RedeemTarget, order: Order, error: RedeemError) => void): this;

    off(event: 'successfulPayment', listener: (user: RedeemTarget, order: Order) => void): this;
    off(event: 'successfulRedeem', listener: (user: RedeemTarget, order: Order) => void): this;
    off(event: 'successfulSubscriptionExecution', listener: (user: RedeemTarget, order: Order) => void): this;
    off(event: 'failedRedeemPerk', listener: (user: RedeemTarget, order: Order, error: RedeemError) => void): this;
}

export interface EventSource {
    emit(event: 'successfulPayment', user: RedeemTarget, order: Order): void;
    emit(event: 'successfulRedeem', user: RedeemTarget, order: Order): void;
    emit(event: 'successfulSubscriptionExecution', user: RedeemTarget, order: Order): void;
    emit(event: 'failedRedeemPerk', user: RedeemTarget, order: Order, error: RedeemError): void;
}
