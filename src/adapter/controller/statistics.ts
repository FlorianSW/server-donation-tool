import {inject, singleton} from 'tsyringe';
import {Request, Response, Router} from 'express';
import {requireAuthentication} from '../../auth';
import {translate} from '../../translations';
import {CalculateDonationTarget} from '../../service/donation-target';

@singleton()
export class StatisticsController {
    public readonly router: Router = Router();

    constructor(@inject(CalculateDonationTarget) private readonly service: CalculateDonationTarget) {
        if (service.hasMonthlyTarget()) {
            this.router.get('/api/statistics/monthly', requireAuthentication, this.monthlyStatistics.bind(this));
        }
    }

    private async monthlyStatistics(req: Request, res: Response): Promise<void> {
        const target = await this.service.monthly();
        let msgKey = 'DONATION_TARGET_CLAIM';
        if (target.reached) {
            msgKey = 'DONATION_TARGET_REACHED';
        }
        res.send({
            currency: target.currency,
            totalAmount: target.totalAmount,
            target: target.target,
            message: translate(msgKey, {
                params: {
                    totalAmount: target.totalAmount.toString(10),
                    currency: target.currency,
                    target: target.target.toString(10),
                }
            }),
        });
    }
}
