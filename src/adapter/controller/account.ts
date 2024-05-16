import {inject, singleton} from 'tsyringe';
import {Request, Response, Router} from 'express';
import {OrderRepository} from '../../domain/repositories';
import {requireAuthentication} from '../../auth';

@singleton()
export class AccountController {
    public readonly router: Router = Router();

    constructor(
        @inject('OrderRepository') private readonly repo: OrderRepository,
    ) {
        this.router.get('/account', requireAuthentication, this.render.bind(this));
    }

    private async render(req: Request, res: Response) {
        const orders = await this.repo.findLastFor(req.user, 20);
        res.render('account', {
            orders: orders,
        });
    }
}
