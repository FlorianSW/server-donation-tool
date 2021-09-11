import {Request, Response, Router} from 'express';
import {AppConfig} from '../../domain/app-config';
import {Logger} from 'winston';
import {inject, singleton} from 'tsyringe';
import {Subscriptions} from '../../service/subscriptions';
import {Payment, SaleCompleted, SubscriptionCancelled} from '../../domain/payment';

enum EventType {
    SaleCompleted = 'PAYMENT.SALE.COMPLETED', SubscriptionCancelled = 'BILLING.SUBSCRIPTION.CANCELLED',
}

interface Webhook {
    id: string;
    event_type: EventType;
}

@singleton()
export class PaypalWebhooksController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('Subscriptions') private readonly subscriptions: Subscriptions,
        @inject('Payment') private readonly payment: Payment,
        @inject('Logger') private readonly logger: Logger
    ) {
        this.router.post('/api/paypal/webhook', this.incoming.bind(this));
    }

    private async incoming(req: Request, res: Response): Promise<void> {
        const event = req.body as Webhook;
        const resource = await this.payment.webhookEvent(event.id);
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
}
