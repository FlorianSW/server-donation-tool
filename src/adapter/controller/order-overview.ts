import {inject, singleton} from 'tsyringe';
import {Request, Response, Router} from 'express';
import {requireAuthentication, requiresRole} from '../../auth';
import {translate} from '../../translations';
import {CalculateDonationTarget} from '../../service/donation-target';
import {Role} from '../../domain/user';
import {OrderOverview} from '../../service/order-overview';

@singleton()
export class OrderOverviewController {
    public readonly router: Router = Router();

    constructor(@inject(OrderOverview) private readonly service: OrderOverview) {
        this.router.get('/statistics', requireAuthentication, requiresRole(Role.Auditor), this.monthlyStatistics.bind(this));
    }

    private async monthlyStatistics(req: Request, res: Response): Promise<void> {
        const o = await this.service.monthlyOverview();
        res.render('order-overview', {
            data: o,
        });
    }
}
