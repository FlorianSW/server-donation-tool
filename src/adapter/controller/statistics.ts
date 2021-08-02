import {inject, singleton} from 'tsyringe';
import {Request, Response, Router} from 'express';
import {requireAuthentication} from '../../auth';
import {OrderRepository} from '../../domain/repositories';
import {AppConfig} from '../../domain/app-config';

@singleton()
export class StatisticsController {
    public readonly router: Router = Router();
    private readonly monthlyTarget: number;

    constructor(
        @inject('OrderRepository') private readonly repository: OrderRepository,
        @inject('AppConfig') config: AppConfig,
    ) {
        if (config.app.community?.donationTarget?.monthly) {
            this.monthlyTarget = config.app.community.donationTarget.monthly;
            this.router.get('/statistics/monthly', requireAuthentication, this.monthlyStatistics.bind(this));
        }
    }

    private async monthlyStatistics(req: Request, res: Response): Promise<void> {
        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
        const orders = await this.repository.findCreatedAfter(startOfMonth);
        const totalDonations = orders.map((o) => parseFloat(o.reference.p.price.amount)).reduce((pv, cv) => pv + cv);
        res.send({
            totalAmount: totalDonations,
            target: this.monthlyTarget,
        });
    }
}
