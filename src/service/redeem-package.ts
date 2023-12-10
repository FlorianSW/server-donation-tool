import {inject, singleton} from 'tsyringe';
import {TranslateParams} from '../translations';
import {isRefundable, Perk, RedeemError, RedeemTarget} from '../domain/package';
import {Order} from '../domain/payment';
import {OrderRepository} from '../domain/repositories';
import {Logger} from 'winston';
import {EventSource} from '../domain/events';
import {AppConfig} from '../domain/app-config';

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
        @inject('AppConfig') private readonly config: AppConfig,
    ) {
    }

    async redeem(order: Order, target: RedeemTarget, perks: Perk[]): Promise<RedeemResults> {
        if (order.reference.steamId === null) {
            order.reference.steamId = target.steamId;
        }

        const error = order.redeem(this.config.app.orders.redeemCooldownHours);
        if (error) {
            return {
                success: [],
                errors: [error],
            }
        }

        const success: TranslateParams[] = [];
        const errors: RedeemError[] = [];
        for (let perk of perks) {
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
            this.events.emit('successfulRedeem', target, order, perks);
        }
        await this.repo.save(order);

        return {
            success: success,
            errors: errors,
        };
    }

    async refund(order: Order, target: RedeemTarget): Promise<RedeemResults> {
        order.refund();
        await this.repo.save(order);

        const errors: RedeemError[] = [];
        for (let perk of order.reference.p.perks) {
            if (isRefundable(perk)) {
                try {
                    await perk.refund(target, order);
                } catch (e) {
                    this.logger.error(`Could not refund perk ${perk.type}:`, e);
                    if (e instanceof RedeemError) {
                        errors.push(e);
                        this.events.emit('failedRefundPerk', target, order, e);
                    } else {
                        throw e;
                    }
                }
            }
        }

        this.events.emit('successfulRefund', target, order);
        return {
            success: [],
            errors: errors,
        };
    }
}
