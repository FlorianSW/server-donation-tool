import {requireAuthentication} from '../../auth';
import {Request, Response, Router} from 'express';
import {AppConfig} from '../../domain/app-config';
import {Logger} from 'winston';
import {inject, singleton} from 'tsyringe';
import csrf from 'csurf';
import {SubscriptionNotFound} from '../../domain/payment';
import {Subscriptions} from '../../service/subscriptions';

@singleton()
export class SubscriptionsController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('Subscriptions') private readonly subs: Subscriptions,
        @inject('Logger') private readonly logger: Logger
    ) {
        const csrfProtection = csrf();
        this.router.get('/subscriptions/:subscriptionId', requireAuthentication, csrfProtection, this.renderSubscription.bind(this));
        this.router.post('/subscriptions/:subscriptionId', requireAuthentication, csrfProtection, this.cancelSubscription.bind(this));
    }

    private async renderSubscription(req: Request, res: Response) {
        const view = await this.subs.viewSubscription(req.params.subscriptionId, req.user);
        res.render('subscription', {
            user: req.user,
            subscription: view.subscription,
            plan: view.plan,
            history: view.history,
            csrfToken: req.csrfToken(),
        });
    }

    private async cancelSubscription(req: Request, res: Response) {
        try {
            await this.subs.cancel(req.params.subscriptionId, req.user);
            res.redirect(`/subscriptions/${req.params.subscriptionId}`);
        } catch (e) {
            if (e instanceof SubscriptionNotFound) {
                res.sendStatus(404).end();
            } else {
                throw e;
            }
        }
    }
}
