const messages: { [key: string]: string } = {
    HEADER_DONATE: 'Donate to {{community}}',

    INFO_TITLE: 'Donate',
    INFO_DESCRIPTION: 'Thanks for considering a donation to our community. Please follow this simple process to donate and get rewarded with getting a slot on our priority queue. Once the priority queue entry is created, it will take until the next server restart to be available.',

    SERVERS_WITH_PRIORITY_QUEUE: 'Servers you have priority queue on',
    SERVERS_WITH_PRIORITY_QUEUE_UNTIL: 'until: ',

    STEAM_ACCOUNT_TITLE: 'Steam Account',
    STEAM_FROM_DISCORD: 'This Steam account is linked with your Discord user.',

    PERK_SELECTION_TITLE: 'Select package',
    PERK_NO_AVAILABLE: 'There is no package available. You may already have all available perks.',

    PAYPAL_DONATION_TITLE: 'PayPal Donation',
    PAYPAL_DESCRIPTION: 'We use PayPal to process your donation. Proceed to PayPal in order to complete the transaction.',
    PAYPAL_UNSTARTED: 'Choose the payment method to proceed',
    PAYPAL_COMPLETE: 'Donation was completed',
    PAYPAL_ERROR: 'Something went wrong with your donation.',

    PRIORITY_QUEUE_TITLE: 'Thank you for your donation',
    PRIORITY_QUEUE_DESCRIPTION: 'You can now redeem your perk to profit from the benefits it includes.',
    PRIORITY_QUEUE_REDEEM: 'Redeem',
    PRIORITY_QUEUE_REDEEM_PENDING: 'Redeem pending',
    PRIORITY_QUEUE_BACK: 'Back to Start',
    PRIORITY_QUEUE_REDEEM_COMPLETE: 'Your priority queue slot for {{serverName}} was created successfully. It will expire at: {{until}}',

    ALREADY_PRIORITY_QUEUE_TITLE: 'Already Priority Queue',
    ALREADY_PRIORITY_QUEUE_DESCRIPTION: 'Your Steam ID, which is connected to your Discord user, already has priority queue. Thanks for your donation!',
    ALREADY_PRIORITY_QUEUE_STEAM_ID: 'Your Steam ID',
    ALREADY_PRIORITY_QUEUE_UNTIL: 'Priority Queue until',

    PERK_INCLUDED: 'Includes following perks:',
    PERK_PRIORITY_QUEUE_DESCRIPTION: 'Priority Queue on {{serverName}} for {{amountInDays}} days',

    ERROR_STEAM_ID_MISMATCH_TITLE: 'Steam ID mismatch',
    ERROR_STEAM_ID_MISMATCH_DESCRIPTION: 'The Steam ID for this donation is different from the one connected with your profile.',
    ERROR_STEAM_ID_MISMATCH_ORDER_LABEL: 'Steam ID of donation',
    ERROR_STEAM_ID_MISMATCH_USER_LABEL: 'Your Steam ID',

    ERROR_LOGIN: 'Login error',
    ERROR_LOGIN_DESCRIPTION: 'The login was not successful. Please make sure you complete the login on the Discord page.',
    ERROR_LOGIN_AGAIN: 'Login again',

    ERROR_MISSING_STEAM_TITLE: 'Discord profile has no Steam connection',
    ERROR_MISSING_STEAM_DESCRIPTION: 'We offer perks to our donators, like Priority queue. In order for you to be able to redeem your donator perk, we need to know your Steam account you usually play with. Currently, the only supported method to provide this Steam account is by connecting it with your Discord profile (which you used to login here). You can even hide the connection from the public in your Discord profile settings, it just need to exist.<br><br>Please go to your Discord, connect your Steam account and try again.',
    ERROR_MISSING_STEAM_TRY_AGAIN: 'Done! Try again',
};

export type TranslateParams = [string, TranslateOptions];

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
