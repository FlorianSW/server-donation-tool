import {User} from './user';
import {Order} from './payment';
import {RedeemError} from './package';

export interface DonationEvents {
    on(event: 'successfulPayment', listener: (user: User, order: Order) => void): this;
    on(event: 'successfulRedeem', listener: (user: User, order: Order) => void): this;
    on(event: 'failedRedeemPerk', listener: (user: User, order: Order, error: RedeemError) => void): this;

    off(event: 'successfulPayment', listener: (user: User, order: Order) => void): this;
    off(event: 'successfulRedeem', listener: (user: User, order: Order) => void): this;
    off(event: 'failedRedeemPerk', listener: (user: User, order: Order, error: RedeemError) => void): this;
}

export interface EventSource {
    emit(event: 'successfulPayment', user: User, order: Order): void;
    emit(event: 'successfulRedeem', user: User, order: Order): void;
    emit(event: 'failedRedeemPerk', user: User, order: Order, error: RedeemError): void;
}
