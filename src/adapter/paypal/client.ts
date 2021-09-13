import {AppConfig} from '../../domain/app-config';
import {Environment} from './paypal-payment';

const paypal = require('@paypal/checkout-server-sdk');

export interface Response<T> {
    statusCode: number,
    headers: { [key: string]: string },
    result: T,
}

export type RequestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface Request<T = null> {
    path: string;
    method: RequestMethod;
    body?: T;
    headers: { [key: string]: string };
}

export abstract class JsonRequest<T = null> implements Request<T> {
    public readonly headers = {
        'Content-Type': 'application/json'
    };

    protected constructor(public readonly path: string, public readonly method: RequestMethod, public readonly body: T = null) {
    }
}

export interface PaypalClient {
    execute<T, S = any>(request: Request<S>): Promise<Response<T>>;
}

/**
 *
 * Returns PayPal HTTP client instance with environment that has access
 * credentials context. Use this instance to invoke PayPal APIs, provided the
 * credentials have access.
 */
export function paypalClient(config: AppConfig): PaypalClient {
    return new paypal.core.PayPalHttpClient(environment(config));
}

/**
 *
 * Set up and return PayPal JavaScript SDK environment with PayPal access credentials.
 * This sample uses SandboxEnvironment. In production, use LiveEnvironment.
 */
function environment(config: AppConfig) {
    if (config.paypal.environment === Environment.PRODUCTION) {
        return new paypal.core.LiveEnvironment(config.paypal.clientId, config.paypal.clientSecret);
    } else {
        return new paypal.core.SandboxEnvironment(config.paypal.clientId, config.paypal.clientSecret);
    }
}
