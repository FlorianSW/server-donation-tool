import {Request, Response, Router} from 'express';
import {AppConfig} from '../../domain/app-config';
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
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

enum EventType {
    SaleCompleted = 'PAYMENT.SALE.COMPLETED', SubscriptionCancelled = 'BILLING.SUBSCRIPTION.CANCELLED',
}

interface WebhookEvent {
    id: string;
    event_type: EventType;
}

const configPath = './db/config/paypal/';
const configFile = 'subscription_webhook_id';

@singleton()
export class PaypalWebhooksController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('Subscriptions') private readonly subscriptions: Subscriptions,
        @inject('PayPalClient') private readonly client: PayPalClient,
        @inject('Logger') private readonly logger: Logger,
    ) {
        if (config.paypal.manageWebhook) {
            if (this.config.app.publicUrl.protocol.startsWith('http:')) {
                logger.error('Requested to manage PayPal webhooks for subscriptions, but public URL is http instead of https. Consult the documentation regarding subscriptions.');
                process.exit(1);
            }
            fileExists(configPath + configFile).then(async (exists) => {
                try {
                    await mkdir(configPath, {recursive: true});
                    if (exists) {
                        logger.info('PayPal webhook exists, updating to current URL');
                        const id = (await readFile(configPath + configFile)).toString('utf-8');
                        const webhook = await this.getWebhook(id);
                        await this.updateWebhook(webhook);
                    } else {
                        logger.info('PayPal webhook does not exist, hence creating one');
                        const wh = await this.createWebhook();
                        await writeFile(configPath + configFile, wh.id);
                    }
                } catch (e) {
                    logger.error('Unknown error while managing PayPal webhook.', e);
                    process.exit(1);
                }
            });
        }
        this.router.post('/api/paypal/webhook', this.incoming.bind(this));
    }

    private async incoming(req: Request, res: Response): Promise<void> {
        const event = req.body as WebhookEvent;
        const resource = await this.webhookEvent(event.id);
        if (resource === null) {
            this.logger.error('Received invalid webhook (not originating from PayPal: ' + event.id);
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
        const event = await this.client.execute<WebhookEventResponse>(r);

        if (event.statusCode !== 200) {
            return null;
        }
        return event.result.resource as T;
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
