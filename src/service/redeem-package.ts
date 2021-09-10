import {inject, singleton} from 'tsyringe';
import {TranslateParams} from '../translations';
import {RedeemError, RedeemTarget} from '../domain/package';
import {Order} from '../domain/payment';
import {OrderRepository} from '../domain/repositories';
import {Logger} from 'winston';
import {EventSource} from '../domain/events';

export interface RedeemResults {
    success: TranslateParams[],
    errors: RedeemError[],
}

@singleton()
export class RedeemPackage {
    constructor(
        @inject('OrderRepository') private readonly repo: OrderRepository,
        @inject('EventSource') private readonly events: EventSource,
        @inject('Logger') private readonly logger: Logger,
    ) {
    }

    async redeem(order: Order, target: RedeemTarget): Promise<RedeemResults> {
        if (order.reference.steamId === null) {
            order.reference.steamId = target.steamId;
            await this.repo.save(order);
        }

        const success: TranslateParams[] = [];
        const errors: RedeemError[] = [];
        for (let perk of order.reference.p.perks) {
            try {
                success.push(await perk.redeem(target, order));
            } catch (e) {
                this.logger.error(`Could not redeem perk ${perk.type}:`, e);
                if (e instanceof RedeemError) {
                    errors.push(e);
                    this.events.emit('failedRedeemPerk', target, order, e);
                } else {
                    throw e;
                }
            }
        }
        if (success.length !== 0) {
            this.events.emit('successfulRedeem', target, order);
        }

        return {
            success: success,
            errors: errors,
        };
    }
}
