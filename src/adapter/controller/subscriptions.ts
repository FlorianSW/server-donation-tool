import {requireAuthentication} from '../../auth';
import {Request, Response, Router} from 'express';
import {AppConfig} from '../../domain/app-config';
import {Logger} from 'winston';
import {inject, singleton} from 'tsyringe';
import {SubscriptionPlanRepository, SubscriptionsRepository} from '../../domain/repositories';
import csrf from 'csurf';
import {Payment, Subscription} from '../../domain/payment';

@singleton()
export class SubscriptionsController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('SubscriptionsRepository') private readonly subscriptions: SubscriptionsRepository,
        @inject('SubscriptionPlanRepository') private readonly plans: SubscriptionPlanRepository,
        @inject('Payment') private readonly payment: Payment,
        @inject('Logger') private readonly logger: Logger
    ) {
        const csrfProtection = csrf();
        this.router.get('/subscriptions/:subscriptionId', requireAuthentication, csrfProtection, this.renderSubscription.bind(this));
        this.router.post('/subscriptions/:subscriptionId', requireAuthentication, csrfProtection, this.cancelSubscription.bind(this));
    }

    private async fetchSubscription(req: Request, res: Response): Promise<Subscription> {
        const subscriptionId = req.params.subscriptionId;
        const subscription = await this.subscriptions.find(subscriptionId);

        if (!subscription || subscription.user.discordId !== req.user.discord.id) {
            res.sendStatus(404).end();
            return;
        }

        return subscription;
    }

    private async renderSubscription(req: Request, res: Response) {
        const subscription = await this.fetchSubscription(req, res);
        const plan = await this.plans.find(subscription.planId);
        res.render('subscription', {
            user: req.user,
            subscription: subscription,
            plan: plan,
            csrfToken: req.csrfToken(),
        });
    }

    private async cancelSubscription(req: Request, res: Response) {
        const subscription = await this.fetchSubscription(req, res);
        await this.payment.cancelSubscription(subscription);
        subscription.cancel();
        await this.subscriptions.save(subscription);
        res.redirect(`/subscriptions/${subscription.id}`);
    }
}
