import {DonationEvents} from '../domain/events';
import {User} from '../domain/user';
import {Order} from '../domain/payment';
import {OrderRepository} from '../domain/repositories';
import {inject, singleton} from 'tsyringe';

@singleton()
export class OrderRecorder {
    constructor(@inject('DonationEvents') private readonly events: DonationEvents, @inject('OrderRepository') private readonly repository: OrderRepository) {
        events.on('successfulPayment', this.onSuccessfulPayment.bind(this));
    }

    async onSuccessfulPayment(user: User, order: Order): Promise<void> {
        await this.repository.save(order);
    }

    async close(): Promise<void> {
        this.events.off('successfulPayment', this.onSuccessfulPayment.bind(this));
    }
}
