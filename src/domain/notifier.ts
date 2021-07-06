import {User} from './user';
import {Order} from './payment';
import {RedeemError} from './package';

export enum Type {
    SUCCESSFUL_REDEEM = 'SUCCESSFUL_REDEEM',
    REDEEM_ERROR = 'REDEEM_ERROR',
    DONATED = 'DONATED',
}

export interface Notifier {
    onSuccessfulPayment(user: User, order: Order): Promise<void>;

    onSuccessfulRedeem(user: User, order: Order): Promise<void>;

    onFailedRedeemPerk(user: User, order: Order, error: RedeemError): Promise<void>;
}
