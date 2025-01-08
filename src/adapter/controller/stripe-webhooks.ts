import {Request, Response, Router} from 'express';
import {AppConfig, Properties} from '../../domain/app-config';
import {Logger} from 'winston';
import {inject, singleton} from 'tsyringe';
import {Subscriptions} from '../../service/subscriptions';
import {RedeemPackage} from '../../service/redeem-package';
import {OrderRepository, SubscriptionsRepository} from '../../domain/repositories';
import Stripe from "stripe";

const propertiesContext = 'stripe';
const propertySubscriptionWebhookId = 'subscriptionWebhookId';
const propertySubscriptionWebhookSecret = 'subscriptionWebhookSecret';

@singleton()
export class StripeWebhooksController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('Properties') readonly props: Properties,
        @inject('Subscriptions') private readonly subscriptions: Subscriptions,
        @inject('SubscriptionsRepository') private readonly subRepo: SubscriptionsRepository,
        @inject('StripeClient') private readonly client: Stripe,
        @inject('Logger') private readonly logger: Logger,
    ) {
        (async () => {
            if (config.stripe.manageWebhook) {
                if (this.config.app.publicUrl.protocol.startsWith('http:')) {
                    logger.error('Requested to manage Stripe webhooks for subscriptions, but public URL is http instead of https. Consult the documentation regarding subscriptions.');
                    process.exit(1);
                }
                const id = await props.find(propertiesContext, propertySubscriptionWebhookId);

                try {
                    if (id !== null) {
                        logger.info('Stripe webhook exists, updating to current URL');
                        const webhook = await this.getWebhook(id);
                        await this.updateWebhook(webhook);
                    } else {
                        logger.info('Stripe webhook does not exist, hence creating one');
                        const wh = await this.createWebhook();
                        await props.set(propertiesContext, propertySubscriptionWebhookId, wh.id);
                        await props.set(propertiesContext, propertySubscriptionWebhookSecret, wh.secret);
                    }
                } catch (e) {
                    logger.error('Unknown error while managing Stripe webhook.', e);
                    process.exit(1);
                }
            }
        })();
        this.router.post('/api/stripe/webhook', this.incoming.bind(this));
    }

    private async incoming(req: Request, res: Response): Promise<void> {
        const ev = await this.webhookEvent(req);
        if (ev === null) {
            this.logger.error('Received invalid webhook');
            res.status(200).end();
            return;
        }
        switch (ev.type) {
            case 'checkout.session.completed':
                if (ev.data.object.subscription === null) {
                    return;
                }
                const subBySubId = await this.subRepo.findByPayment(ev.data.object.subscription as string);
                const subBySessionId = await this.subRepo.findByPayment(ev.data.object.id);
                if (!subBySubId && subBySessionId) {
                    subBySessionId.payment.id = ev.data.object.subscription as string;
                    await this.subRepo.save(subBySessionId);
                }
                await this.subscriptions.redeemSubscriptionPayment(ev.data.object.subscription as string, ev.data.object.id);
                break;
            case 'customer.subscription.deleted':
            case 'customer.subscription.paused':
                await this.subscriptions.notifyCancel(ev.data.object.id);
                break;
            default:
                this.logger.debug('Received a webhook event type, which is not handled: ' + ev.type);
        }
        res.status(200).end();
    }

    private async webhookEvent(req: Request): Promise<Stripe.Event> {
        const sig = req.headers['stripe-signature'];
        const secret = await this.props.find(propertiesContext, propertySubscriptionWebhookSecret);
        return this.client.webhooks.constructEvent(req.rawBody, sig, secret);
    }

    private async createWebhook(): Promise<Stripe.WebhookEndpoint> {
        return await this.client.webhookEndpoints.create({
            url: new URL('/api/stripe/webhook', this.config.app.publicUrl).toString(),
            enabled_events: [
                'checkout.session.completed',
                'customer.subscription.created',
                'customer.subscription.deleted',
                'customer.subscription.paused',
            ],
        });
    }

    private async getWebhook(id: string): Promise<Stripe.WebhookEndpoint> {
        return await this.client.webhookEndpoints.retrieve(id);
    }

    private async updateWebhook(webhook: Stripe.WebhookEndpoint): Promise<Stripe.WebhookEndpoint> {
        const url = new URL('/api/stripe/webhook', this.config.app.publicUrl).toString();
        if (url === webhook.url) {
            return;
        }
        return await this.client.webhookEndpoints.update(webhook.id, {
            url: url,
        });
    }
}
