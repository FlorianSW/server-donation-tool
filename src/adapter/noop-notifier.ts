import {Notifier} from '../domain/notifier';
import {User} from '../domain/user';
import {Order} from '../domain/payment';
import {RedeemError} from '../domain/package';

export class NoopNotifier implements Notifier {
    async onSuccessfulRedeem(user: User, order: Order): Promise<void> {
    }

    async onFailedRedeemPerk(user: User, order: Order, error: RedeemError): Promise<void> {
    }
}
