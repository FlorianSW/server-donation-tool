import {AppConfig} from '../app-config';

const paypal = require('@paypal/checkout-server-sdk');

/**
 *
 * Returns PayPal HTTP client instance with environment that has access
 * credentials context. Use this instance to invoke PayPal APIs, provided the
 * credentials have access.
 */
export function paypalClient(config: AppConfig) {
    return new paypal.core.PayPalHttpClient(environment(config));
}

/**
 *
 * Set up and return PayPal JavaScript SDK environment with PayPal access credentials.
 * This sample uses SandboxEnvironment. In production, use LiveEnvironment.
 *
 */
function environment(config: AppConfig) {
    return new paypal.core.SandboxEnvironment(config.paypal.clientId, config.paypal.clientSecret);
}
