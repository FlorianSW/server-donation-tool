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
        const now = new Date();
        let year = now.getUTCFullYear();
        let month = now.getUTCMonth() + 1;
        if (req.query.month && req.query.year) {
            year = parseInt(req.query.year as string);
            month = parseInt(req.query.month as string);
        }
        if (year < 1900 || year > 3000 || month < 1 || month > 12) {
            year = now.getUTCFullYear();
            month = now.getUTCMonth() + 1;
        }
        const o = await this.service.monthlyOverview(month, year);
        res.render('order-overview', {
            data: o,
        });
    }
}
