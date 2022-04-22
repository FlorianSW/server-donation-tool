import {Request, Response, Router} from 'express';
import {AppConfig, Properties} from '../../domain/app-config';
import {Logger} from 'winston';
import {inject, singleton} from 'tsyringe';
import {Subscriptions} from '../../service/subscriptions';
import {SaleCompleted, SubscriptionCancelled} from '../../domain/payment';
import {PayPalClient} from '../paypal/client';
import {
    CreateWebhookRequest,
    GetWebhookEvent,
    GetWebhookRequest,
    UpdateWebhookRequest,
    Webhook,
    WebhookEventResponse
} from '../paypal/types';
import fs from 'fs';
import {promisify} from 'util';

const fileExists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
const unlinkFile = promisify(fs.unlink);

enum EventType {
    SaleCompleted = 'PAYMENT.SALE.COMPLETED', SubscriptionCancelled = 'BILLING.SUBSCRIPTION.CANCELLED',
}

interface WebhookEvent {
    id: string;
    event_type: EventType;
}

const propertiesContext = 'paypal';
const propertySubscriptionWebhookId = 'subscriptionWebhookId';

const configPath = './db/config/paypal/';
const configFile = 'subscription_webhook_id';

@singleton()
export class PaypalWebhooksController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('Properties') private readonly props: Properties,
        @inject('Subscriptions') private readonly subscriptions: Subscriptions,
        @inject('PayPalClient') private readonly client: PayPalClient,
        @inject('Logger') private readonly logger: Logger,
    ) {
        this.migrateFileBasedConfig().then(async () => {
            if (config.paypal.manageWebhook) {
                if (this.config.app.publicUrl.protocol.startsWith('http:')) {
                    logger.error('Requested to manage PayPal webhooks for subscriptions, but public URL is http instead of https. Consult the documentation regarding subscriptions.');
                    process.exit(1);
                }
                const id = await props.find(propertiesContext, propertySubscriptionWebhookId);

                try {
                    if (id !== null) {
                        logger.info('PayPal webhook exists, updating to current URL');
                        const webhook = await this.getWebhook(id);
                        await this.updateWebhook(webhook);
                    } else {
                        logger.info('PayPal webhook does not exist, hence creating one');
                        const wh = await this.createWebhook();
                        await props.set(propertiesContext, propertySubscriptionWebhookId, wh.id);
                    }
                } catch (e) {
                    logger.error('Unknown error while managing PayPal webhook.', e);
                    process.exit(1);
                }
            }
        });
        this.router.post('/api/paypal/webhook', this.incoming.bind(this));
    }

    private async migrateFileBasedConfig(): Promise<void> {
        const exists = await fileExists(configPath + configFile);
        if (exists) {
            const id = (await readFile(configPath + configFile)).toString('utf-8');
            await this.props.set(propertiesContext, propertySubscriptionWebhookId, id);
            await unlinkFile(configPath + configFile);
        }
    }

    private async incoming(req: Request, res: Response): Promise<void> {
        const event = req.body as WebhookEvent;
        const resource = await this.webhookEvent(event.id);
        if (resource === null) {
            this.logger.error('Received invalid webhook (not originating from PayPal: ' + event.id);
            res.status(200).end();
        }
        switch (event.event_type) {
            case EventType.SaleCompleted:
                const completed = resource as SaleCompleted;
                await this.subscriptions.redeemSubscriptionPayment(completed.billing_agreement_id, completed.id);
                break;
            case EventType.SubscriptionCancelled:
                const cancelled = resource as SubscriptionCancelled;
                await this.subscriptions.notifyCancel(cancelled.id);
                break;
            default:
                this.logger.debug('Received a webhook event type, which is not handled: ' + event.event_type);
        }
        res.status(200).end();
    }

    private async webhookEvent<T extends SaleCompleted | SubscriptionCancelled>(id: string): Promise<T | null> {
        const r = new GetWebhookEvent(id);

        try {
            const event = await this.client.execute<WebhookEventResponse>(r);

            if (event.statusCode !== 200) {
                return null;
            }
            return event.result.resource as T;
        } catch (e) {
            if (e.statusCode === 404) {
                return null;
            }
            throw e;
        }
    }

    private async createWebhook(): Promise<Webhook> {
        const r = new CreateWebhookRequest();
        r.requestBody({
            url: new URL('/api/paypal/webhook', this.config.app.publicUrl).toString(),
            event_types: [{
                name: EventType.SaleCompleted,
            }, {
                name: EventType.SubscriptionCancelled,
            }],
        });
        const event = await this.client.execute<Webhook>(r);

        if (event.statusCode !== 201) {
            return null;
        }
        return event.result;
    }

    private async getWebhook(id: string): Promise<Webhook> {
        const r = new GetWebhookRequest(id);
        const event = await this.client.execute<Webhook>(r);

        if (event.statusCode !== 200) {
            return null;
        }
        return event.result;
    }

    private async updateWebhook(webhook: Webhook): Promise<Webhook> {
        const url = new URL('/api/paypal/webhook', this.config.app.publicUrl).toString();
        if (url === webhook.url) {
            return;
        }
        const r = new UpdateWebhookRequest(webhook.id);
        r.requestBody(url);
        const event = await this.client.execute<Webhook>(r);

        if (event.statusCode !== 200) {
            return null;
        }
        return event.result;
    }
}
