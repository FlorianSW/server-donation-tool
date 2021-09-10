import {Request, Response, Router} from 'express';
import {AppConfig} from '../../domain/app-config';
import {Logger} from 'winston';
import {inject, singleton} from 'tsyringe';
import {Subscriptions} from '../../service/subscriptions';

enum EventType {
    SaleCompleted = 'PAYMENT.SALE.COMPLETED', SubscriptionCancelled = 'BILLING.SUBSCRIPTION.CANCELLED',
}

interface Webhook {
    id: string;
    event_type: EventType;
    resource: SaleCompleted | SubscriptionCancelled;
}

interface SaleCompleted {
    amount: {
        total: string;
        currency: string;
    };
    custom: string;
    billing_agreement_id: string;
    id: string;
    state: string;
}

interface SubscriptionCancelled {
    id: string;
}

@singleton()
export class PaypalWebhooksController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('Subscriptions') private readonly subscriptions: Subscriptions,
        @inject('Logger') private readonly logger: Logger
    ) {
        this.router.post('/api/paypal/webhook', this.incoming.bind(this));
    }

    private async incoming(req: Request, res: Response): Promise<void> {
        const event = req.body as Webhook;
        switch (event.event_type) {
            case EventType.SaleCompleted:
                const r = event.resource as SaleCompleted;
                await this.subscriptions.redeemSubscriptionPayment(r.billing_agreement_id, r.id);
                break;
            case EventType.SubscriptionCancelled:
                break;
            default:
                this.logger.debug('Received a webhook event type, which is not handled: ' + event.event_type);
        }
        res.status(200).end();
    }
}
