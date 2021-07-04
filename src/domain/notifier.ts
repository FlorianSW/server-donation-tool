import {User} from './user';
import {Order} from './payment';
import {RedeemError} from './package';

export enum Type {
    SUCCESSFUL_REDEEM = 'SUCCESSFUL_REDEEM',
    REDEEM_ERROR = 'REDEEM_ERROR'
}

export interface Notifier {
    onSuccessfulRedeem(user: User, order: Order): Promise<void>;

    onFailedRedeemPerk(user: User, order: Order, error: RedeemError): Promise<void>;
}
