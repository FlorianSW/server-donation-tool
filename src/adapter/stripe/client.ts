import {AppConfig} from '../../domain/app-config';
import Stripe from 'stripe';

export function stripeClient(config: AppConfig): Stripe {
    return new Stripe(config.stripe.secretKey, {
        apiVersion: '2024-12-18.acacia',
    });
}
