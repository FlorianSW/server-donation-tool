const paypal = require('@paypal/checkout-server-sdk');

/**
 *
 * Returns PayPal HTTP client instance with environment that has access
 * credentials context. Use this instance to invoke PayPal APIs, provided the
 * credentials have access.
 */
export function paypalClient() {
    return new paypal.core.PayPalHttpClient(environment());
}

/**
 *
 * Set up and return PayPal JavaScript SDK environment with PayPal access credentials.
 * This sample uses SandboxEnvironment. In production, use LiveEnvironment.
 *
 */
function environment() {
    return new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET
    );
}
