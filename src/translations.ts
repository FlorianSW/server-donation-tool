const messages: { [key: string]: string } = {
    STEAM_ACCOUNT_TITLE: 'Steam Account',
    STEAM_FROM_DISCORD: 'This Steam account is linked with your Discord user.',

    PAYPAL_DONATION_TITLE: 'PayPal Donation',
    PAYPAL_DESCRIPTION: 'We use PayPal to process your donation. Proceed to PayPal in order to complete the transaction.',
    PAYPAL_UNSTARTED: 'Choose the payment method to proceed',
    PAYPAL_COMPLETE: 'Donation was completed',
    PAYPAL_ERROR: 'Something went wrong with your donation.',

    PRIORITY_QUEUE_TITLE: 'Priority Queue setup',
    PRIORITY_QUEUE_DESCRIPTION: 'Once your donation is completed, you can redeem your priority queue slot.',
    PRIORITY_QUEUE_REDEEM: 'Redeem',
    PRIORITY_QUEUE_REDEEM_PENDING: 'Redeem pending',
    PRIORITY_QUEUE_REDEEM_COMPLETE: 'Your priority queue slot was created successfully. It will expire at: {{until}}',

    ALREADY_PRIORITY_QUEUE_TITLE: 'Already Priority Queue',
    ALREADY_PRIORITY_QUEUE_DESCRIPTION: 'Your Steam ID, which is connected to your Discord user, already has priority queue. Thanks for your donation!',
    ALREADY_PRIORITY_QUEUE_STEAM_ID: 'Your Steam ID',
    ALREADY_PRIORITY_QUEUE_UNTIL: 'Priority Queue until',

    ERROR_STEAM_ID_MISMATCH_TITLE: 'Steam ID mismatch',
    ERROR_STEAM_ID_MISMATCH_DESCRIPTION: 'The Steam ID for this donation is different from the one connected with your profile.',
    ERROR_STEAM_ID_MISMATCH_ORDER_LABEL: 'Steam ID of donation',
    ERROR_STEAM_ID_MISMATCH_USER_LABEL: 'Your Steam ID',

    ERROR_LOGIN: 'Login error',
    ERROR_LOGIN_DESCRIPTION: 'The login was not successful. Please make sure you complete the login on the Discord page.',
    ERROR_LOGIN_AGAIN: 'Login again',
};

export interface TranslateOptions {
    params: { [key: string]: string }
}

export function translate(key: string, options?: TranslateOptions): string {
    let message = messages[key];
    if (message === undefined) {
        return key;
    }
    if (options?.params !== undefined) {
        for (const param in options.params) {
            message = message.replace(`{{${param}}}`, options.params[param]);
        }
    }
    return message;
}
