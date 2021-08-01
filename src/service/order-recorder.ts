import {Events} from '../domain/events';
import {User} from '../domain/user';
import {Order} from '../domain/payment';
import {DiscordRolePerk} from '../adapter/perk/discord-role-perk';
import {DiscordRoleRepository, OrderRepository} from '../domain/repositories';

export class OrderRecorder {
    constructor(private readonly events: Events, private readonly repository: OrderRepository) {
        events.on('successfulPayment', this.onSuccessfulPayment.bind(this));
    }

    async onSuccessfulPayment(user: User, order: Order): Promise<void> {
        await this.repository.save(order);
    }

    async close(): Promise<void> {
        this.events.off('successfulPayment', this.onSuccessfulPayment.bind(this));
    }
}
