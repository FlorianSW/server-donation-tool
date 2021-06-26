const translations: { [key: string]: string } = {
    STEAM_FROM_DISCORD: 'This Steam account is linked with your Discord user.',
    PAYPAL_DESCRIPTION: 'We use PayPal to process your donation. Proceed to PayPal in order to complete the transaction.',
};

export function translate(key: string): string | undefined {
    return translations[key];
}
