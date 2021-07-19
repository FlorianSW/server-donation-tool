import * as yaml from 'js-yaml';
import fs from 'fs';

const overridesFile = 'string_overrides.yml';

interface TranslationSettings {
    language: string;
};

interface MessageOverrides {
    messages: { [key: string]: string };
}

let overrides: MessageOverrides;
if (fs.existsSync(overridesFile)) {
    overrides = yaml.load(fs.readFileSync(overridesFile, 'utf8')) as MessageOverrides;
} else {
    overrides = {
        messages: {}
    };
}

const messages: { [key: string]: string } = {
    HEADER_DONATE: 'Donate',

    INFO_TITLE: 'Donate',
    INFO_DESCRIPTION: 'Thanks for considering a donation to our community. Please follow this simple process to donate and get rewarded with getting a slot on our priority queue. Once the priority queue entry is created, it will take until the next server restart to be available.',

    STEAM_ACCOUNT_TITLE: 'Steam Account',
    STEAM_FROM_DISCORD: 'This Steam account is linked with your Discord user.',
    STEAM_FROM_STEAM: 'You logged in with this Steam account.',
    STEAM_LOGIN_ANOTHER: 'Login with another account',

    PERK_SELECTION_TITLE: 'Select package',
    PERK_SELECTION_VARIABLE_LABEL: 'Choose your desired amount in {{currency}}',
    PERK_SELECTION_VARIABLE_TITLE: 'An amount with two optional decimal fractions. Examples: 10 or 7.51',
    PERK_SELECTION_SELECT: 'Select',
    PERK_NO_AVAILABLE: 'There is no package available. You may already have all available perks.',

    PAYPAL_DONATION_TITLE: 'PayPal Donation',
    PAYPAL_DESCRIPTION: 'We use PayPal to process your donation. Proceed to PayPal in order to complete the transaction.',
    PAYPAL_SELECTED_PACKAGE: 'Your selected Package',
    PAYPAL_ERROR: 'Something went wrong with your donation.',

    PRIORITY_QUEUE_REDEEM_COMPLETE: 'Your priority queue slot for {{serverName}} was created successfully. It will expire at: {{until}}',
    PRIORITY_QUEUE_REDEEM_ERROR: 'Could not setup priority queue for {{serverName}}. Error: {{reason}}',

    DISCORD_ROLE_REDEEM_COMPLETE: 'You got assigned the following discord roles: {{roles}}',
    DISCORD_ROLE_REDEEM_ERROR: 'Could not assign discord roles. Error: {{reason}}',
    ASSIGNED_DISCORD_ROLE: 'Discord roles you have already',

    FREETEXT_TEXT: '{{text}}',

    PERKS_OWNED_TITLE: 'Perks you own',
    PERKS_OWNED_DISCORD_ROLE: '{{role}} role in Discord',
    PERKS_OWNED_PRIORITY_QUEUE_UNTIL: 'until: ',

    REDEEM_TITLE: 'Thank you for your donation',
    REDEEM_DESCRIPTION_WITH_PERKS: 'You can now redeem your perk to profit from the benefits it includes.',
    REDEEM_DESCRIPTION_WITHOUT_PERKS: 'We appreciate your support to our community.',
    REDEEM_SUBMIT: 'Redeem',
    REDEEM_BACK: 'Back to Start',
    REDEEM_RETRY: 'Retry',

    ALREADY_PRIORITY_QUEUE_TITLE: 'Already Priority Queue',
    ALREADY_PRIORITY_QUEUE_DESCRIPTION: 'Your Steam ID, which is connected to your Discord user, already has priority queue. Thanks for your donation!',
    ALREADY_PRIORITY_QUEUE_STEAM_ID: 'Your Steam ID',
    ALREADY_PRIORITY_QUEUE_UNTIL: 'Priority Queue until',

    PERK_INCLUDED: 'Includes following perks:',
    PERK_PRIORITY_QUEUE_DESCRIPTION: 'Priority Queue on {{serverName}} for {{amountInDays}} days',
    PERK_PRIORITY_QUEUE_PERMANENT_DESCRIPTION: 'Permanent Priority Queue on {{serverName}}',
    PERK_DISCORD_ROLE_DESCRIPTION: 'These discord roles will be assigned to your user: {{roles}}',

    NOTIFICATIONS_REDEEM_SUCCESSFUL_TITLE: 'Donation redeemed',
    NOTIFICATIONS_REDEEM_SUCCESSFUL_DESCRIPTION: 'A donator redeemed perks of the package they donated for.',
    NOTIFICATIONS_REDEEM_SUCCESSFUL_USERNAME: 'Username',
    NOTIFICATIONS_REDEEM_SUCCESSFUL_STEAM_ID: 'Steam ID',
    NOTIFICATIONS_REDEEM_SUCCESSFUL_PACKAGE: 'Package name',
    NOTIFICATIONS_REDEEM_SUCCESSFUL_TRANSACTION: 'Transaction details',
    NOTIFICATIONS_REDEEM_ERROR_TITLE: 'Redeem of perk errored',
    NOTIFICATIONS_PAYMENT_SUCCESSFUL_TITLE: 'New Donation',
    NOTIFICATIONS_PAYMENT_SUCCESSFUL_DESCRIPTION: 'A new donation was received. The payment succeeded.',

    ERROR_STEAM_ID_MISMATCH_TITLE: 'Steam ID mismatch',
    ERROR_STEAM_ID_MISMATCH_DESCRIPTION: 'The Steam ID for this donation is different from the one connected with your profile.',
    ERROR_STEAM_ID_MISMATCH_ORDER_LABEL: 'Steam ID of donation',
    ERROR_STEAM_ID_MISMATCH_USER_LABEL: 'Your Steam ID',

    ERROR_LOGIN: 'Login error',
    ERROR_LOGIN_DESCRIPTION: 'The login was not successful. Please make sure you complete the login on the Discord page.',
    ERROR_LOGIN_AGAIN: 'Login again',

    ERROR_GENERIC_TITLE: 'Something went wrong 😥',
    ERROR_GENERIC_DESCRIPTION: 'There was an error while processing your request from which we can not recover automatically. If the error persists, please contact the community support channel and report this error using the below additional error information.',
    ERROR_GENERIC_SUPPORT: 'Support information bundle:',

    ERROR_MISSING_STEAM_TITLE: 'Discord profile has no Steam connection',
    ERROR_MISSING_STEAM_DESCRIPTION: 'We offer perks to our donators, like Priority queue. In order for you to be able to redeem your donator perk, we need to know your Steam account you usually play with. Ideally we would like to get your Steam account connected to your Discord profile (which you used to login here). You can even hide the connection from the public in your Discord profile settings, it just need to exist.<br><br>Please go to your Discord, connect your Steam account and try again.',
    ERROR_MISSING_STEAM_TRY_AGAIN: 'Done! Try again',
    ERROR_MISSING_STEAM_LOGIN_TITLE: 'Alternatively login with steam',
    ERROR_MISSING_STEAM_LOGIN_DESCRIPTION: 'You do not necessarily need to link your Steam account with your Steam profile. As an alternative, you can login with your Steam account on this Website. To do so, click the login link.',
    ERROR_MISSING_STEAM_LOGIN: 'Login with Steam',
};

export type TranslateParams = [string, TranslateOptions];

export interface TranslateOptions {
    params: { [key: string]: string }
}

export function translate(key: string, options?: TranslateOptions): string {
    let message = messages[key];
    if (overrides.messages.hasOwnProperty(key)) {
        message = overrides.messages[key];
    }
    if (settings.language === 'qqx' || message === undefined) {
        if (options?.params !== undefined) {
            const paramNames = Object.keys(options.params).join(', ');
            return `{${key}:${paramNames}}`;
        }
        return `{${key}}`;
    }
    if (options?.params !== undefined) {
        for (const param in options.params) {
            message = message.replace(`{{${param}}}`, options.params[param]);
        }
    }
    return message;
}

const settings: TranslationSettings = {
    language: 'en',
};
export default settings;
