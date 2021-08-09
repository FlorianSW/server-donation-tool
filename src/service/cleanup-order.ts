import {OrderRepository} from '../domain/repositories';
import {inject, singleton} from 'tsyringe';

@singleton()
export class CleanupOrder {
    private readonly interval: NodeJS.Timeout;

    constructor(@inject('OrderRepository') private readonly repository: OrderRepository) {
        this.interval = setInterval(this.cleanupOldUnpaidOrders.bind(this), 60 * 60 * 1000);
    }

    async cleanupOldUnpaidOrders(): Promise<void> {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const orders = await this.repository.findUnpaidBefore(yesterday);
        for (const order of orders) {
            await this.repository.delete(order);
        }
    }

    async close(): Promise<void> {
        clearInterval(this.interval);
    }
}
