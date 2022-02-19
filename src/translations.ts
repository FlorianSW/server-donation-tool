import * as yaml from 'js-yaml';
import fs from 'fs';

const overridesFile = 'string_overrides.yml';

interface TranslationSettings {
    language: string;
}

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

    LOGIN_TITLE: 'Login to continue',
    LOGIN_DESCRIPTION: 'Welcome to our donation tool. In order to ease the process of donating, as well as for you to redeem your perks, we use this website. To be able to process your donation, we would like to know, who you are, please click the login link to start.',
    LOGIN_REDIRECT: 'Login with Discord',

    PRIVACY_POLICY: 'Privacy Policy',

    STEAM_ACCOUNT_TITLE: 'Steam Account',
    STEAM_FROM_DISCORD: 'This Steam account is linked with your Discord user.',
    STEAM_FROM_STEAM: 'You logged in with this Steam account.',
    STEAM_LOGIN_ANOTHER: 'Login with another account',

    DISCORD_ACCOUNT_TITLE: 'Discord Account',
    DISCORD_LOGOUT: 'Login with another account',

    ACCOUNT_INFO_TITLE: 'Your linked accounts',
    ACCOUNT_RECENT_DONATIONS_TITLE: 'Recent donations',

    PERK_SELECTION_TITLE: 'Select package',
    PERK_SELECTION_WHO_DESCRIPTION: 'Do you want to redeem the donation perks by your self of should this be a gift to someone else? Please select one option to proceed with the donation.',
    PERK_SELECTION_DONATE: 'Donate',
    PERK_SELECTION_SUBSCRIBE: 'Subscribe',
    PERK_SELECTION_VIEW_SUBSCRIPTION: 'View Subscription',
    PERK_SELECTION_VARIABLE_LABEL: 'Choose your desired amount in {{currency}}',
    PERK_SELECTION_VARIABLE_TITLE: 'An amount with two optional decimal fractions. Examples: 10 or 7.51',
    PERK_SELECTION_SELECT: 'Select',
    PERK_NO_AVAILABLE: 'There is no package available. You may already have all available perks.',
    PERK_SUBSCRIPTION_AVAILABLE: 'This package is available as a monthly subscription.',

    PAYPAL_DONATION_TITLE: 'PayPal Donation',
    PAYPAL_SUBSCRIPTION_TITLE: 'PayPal Subscription',
    PAYPAL_DESCRIPTION: 'We use PayPal to process your donation. Proceed to PayPal in order to complete the transaction.',
    PAYPAL_SUBSCRIPTION_DESCRIPTION: 'When clicking the Subscribe button, you will be redirected to PayPal in order to setup the subscription. Once we receive the first payment of that Subscription (which may take some minutes), we will automatically setup the perks included in your selected donation package.',
    PAYPAL_SUBSCRIPTION_BILLED: 'Billed {{cycle}}',
    PAYPAL_ORDER_DESCRIPTION: 'Donation for {{communityName}}',
    PAYPAL_DEFAULT_COMMUNITY_NAME: 'our community',
    PAYPAL_ERROR: 'Something went wrong with your donation.',
    PAYPAL_SUBSCRIPTION_MONTHLY_DESCRIPTION: 'Donate every month to earn the perks of this package.',
    PAYPAL_SUBSCRIPTION_MONTHLY_NAME: 'Monthly donation for {{package}}',
    PAYPAL_ONE_TIME: 'One-time donation',
    PAYPAL_SUBSCRIPTION: 'Subscription',
    PAYPAL_SUBSCRIBE: 'Subscribe',

    CMD_DONATE_NAME: 'donate',
    CMD_DONATE_DESCRIPTION: 'Donate to this community. Thanks for your contribution :heart:',
    CMD_DONATE_PACKAGE_LABEL: 'Package',
    CMD_DONATE_PACKAGE_DOES_NOT_EXIST_LABEL: 'Your selected package does not exist. Please start over and select another package.',
    CMD_DONATE_START_OVER: 'Start over',
    CMD_DONATE_PACKAGE_DETAILS_TITLE: 'Here are the details for package {{name}}',
    CMD_DONATE_PACKAGE_DETAILS_PERKS: 'Perks',
    CMD_DONATE_PACKAGE_DETAILS_PRICE: 'Price',
    CMD_DONATE_SELECT_ANOTHER: 'Select another package',
    CMD_DONATE_DONATE: 'Donate',
    CMD_DONATE_INTRO: 'Hi {{name}} :wave:\n\nThank you that you consider donating to our community. Below are our available donation packages. Please select the one you would like to donate for.',
    CMD_DONATE_HIDDEN_PACKAGES: 'Some packages are not available through Discord. If you do not find what you\'re looking for, visit the [full donation page]({{fullSite}}).',

    DONATE_TITLE: 'Donate',
    DONATE_SUMMARY_TITLE: '{{index}}. Summary',
    DONATE_SUMMARY_PERKS_FOR_LABEL: 'Perks for:',
    DONATE_SUMMARY_PERKS_FOR_VALUE: 'Yourself or as a gift',
    DONATE_SUMMARY_USER_LABEL: 'Your information:',
    DONATE_CUSTOM_MESSAGE_TITLE: '{{index}}. Leave an optional comment',
    DONATE_CUSTOM_MESSAGE_LABEL: 'Custom message',
    DONATE_PAYMENT_TITLE: '{{index}}. Make a payment',
    DONATE_SUBSCRIBE_TITLE: '{{index}}. Subscribe',
    DONATE_SELECTED_PACKAGE: 'Selected Package',
    DONATE_SELECTED_PACKAGE_EDIT: 'Change',
    DONATE_PERK_INCLUDED: 'Incl.',
    DONATE_PERKS_SUBJECT_SELECTION_TITLE: '{{index}}. Select perk details',
    DONATE_PERKS_SUBJECT_SELECTION_DESCRIPTION: 'Some perks require you to select for what you want to redeem the perk. Please select them here.',

    SUBSCRIBE_CYCLE_LABEL: 'Subscription cycle',
    SUBSCRIBE_CYCLE_MONTHLY: 'monthly',

    PRIORITY_QUEUE_REDEEM_COMPLETE: 'Your priority queue slot for {{serverName}} was created successfully. It will expire at: {{until}}',
    PRIORITY_QUEUE_REDEEM_ERROR: 'Could not setup priority queue for {{serverName}}. Error: {{reason}}',

    LB_AG_PG_REDEEM_COMPLETE: 'Your {{pgName}} in game tag for {{serverName}} was created successfully. It will be applied with the next server restart.',
    LB_AG_PG_REDEEM_ERROR: 'Your {{pgName}} in game tag for {{serverName}} could not be set up. Error: {{reason}}',

    RESERVED_SLOT_REDEEM_COMPLETE: 'Your reserved slot for {{serverName}} was created successfully. It will expire at: {{until}}',
    RESERVED_SLOT_REDEEM_ERROR: 'Could not setup reserved slot for {{serverName}}. Error: {{reason}}',

    WHITELIST_REDEEM_COMPLETE: 'You are now whitelisted for {{serverName}}. It will expire at: {{until}}',
    WHITELIST_REDEEM_ERROR: 'Could not setup whitelist for {{serverName}}. Error: {{reason}}',

    DISCORD_ROLE_REDEEM_COMPLETE: 'You got assigned the following discord roles: {{roles}}',
    DISCORD_ROLE_REDEEM_ERROR: 'Could not assign discord roles. Error: {{reason}}',
    ASSIGNED_DISCORD_ROLE: 'Discord roles you have already',

    DONATION_TARGET_CLAIM: 'We need your help to cover our monthly costs of {{target}}{{currency}}. Thanks to all community members who already donated a total amount of {{totalAmount}}{{currency}}.',
    DONATION_TARGET_REACHED: 'With the awesome amount of {{totalAmount}}{{currency}}, we have reached our donation target to cover our monthly costs of {{target}}{{currency}}. Thanks for your help, every donation helps.',
    DONATION_TARGET_DISCORD_TITLE: 'Donation Target',
    DONATION_TARGET_CALL_TO_ACTION_TITLE: 'Support us',
    DONATION_TARGET_CALL_TO_ACTION_LINK: 'Donate now',

    FREETEXT_TEXT: '{{text}}',

    PERKS_OWNED_TITLE: 'Perks you own',
    PERKS_OWNED_DISCORD_ROLE: '{{role}} role in Discord',
    PERKS_OWNED_LB_AG_PREFIX_GROUP_MEMBER: '{{pgName}} in-game tag on {{serverName}}',
    PERKS_OWNED_PRIORITY_QUEUE_UNTIL: 'until: ',
    PERKS_OWNED_WHITELIST_UNTIL: 'until: ',
    PERKS_OWNED_FAILED_TO_LOAD: 'We\'re having troubles getting this perk\'s information. But no worries, it is still being applied if you own it.',

    REDEEM_SUBMIT: 'Redeem now',

    REDEEM_SUCCESS_TITLE: 'Thank you for your donation',
    REDEEM_SUCCESS_RETRY: 'Retry',

    REDEEM_TITLE_WITH_PERKS: 'One step away to profit from your perks!',
    REDEEM_TITLE_WITHOUT_PERKS: 'Thanks for your donation',
    REDEEM_DESCRIPTION_WITH_PERKS: 'Thanks for your donation. The package you donated for includes the following perks, which you can redeem by clicking on the below button. You can unselect the perks you do not want to redeem.',
    REDEEM_DESCRIPTION_WITHOUT_PERKS: 'We appreciate your support to our community.',
    REDEEM_SHARE_TITLE: 'Share the earned perks',
    REDEEM_SHARE_DESCRIPTION: 'You can share this link with someone you want to gift the perks to. Perks can only be redeemed by one person.',
    REDEEM_BACK: 'Back to Start',

    SUBSCRIPTION_TITLE: 'Subscriptions',
    SUBSCRIPTION_DESCRIPTION: 'With subscriptions you can opt into automatically donating for your favourite package on a recurring basis. The subscription will automatically debit the price from your PayPal account and setup the perks included in the package for you. On this page you can manage your subscription.',
    SUBSCRIPTION_DETAILS_TITLE: 'Details',
    SUBSCRIPTION_DETAILS_STATUS: 'Status',
    SUBSCRIPTION_DETAILS_STATUS_PENDING: 'Pending',
    SUBSCRIPTION_DETAILS_STATUS_PENDING_DESCRIPTION: 'The subscription is currently pending and we are waiting for the payment confirmation. Once the subscription is confirmed, we will automatically setup your perks and will send you a message in Discord. Please make sure that you allow messages from members of our community discord, which are not in your friend list. You can refresh this page after some minutes to check the state as well.',
    SUBSCRIPTION_DETAILS_STATUS_ACTIVE: 'Active',
    SUBSCRIPTION_DETAILS_STATUS_CANCELLED: 'Cancelled',
    SUBSCRIPTION_DETAILS_PACKAGE_NAME: 'Subscribed to package',
    SUBSCRIPTION_DETAILS_PACKAGE_PRICE: 'Package price',
    SUBSCRIPTION_DETAILS_CYCLE: 'Billing cycle',
    SUBSCRIPTION_CANCEL: 'Cancel',
    SUBSCRIPTION_APPROVE: 'Complete subscription',
    SUBSCRIPTION_HISTORY_TITLE: 'Past transactions',

    ALREADY_PRIORITY_QUEUE_TITLE: 'Already Priority Queue',
    ALREADY_PRIORITY_QUEUE_DESCRIPTION: 'Your Steam ID, which is connected to your Discord user, already has priority queue. Thanks for your donation!',
    ALREADY_PRIORITY_QUEUE_STEAM_ID: 'Your Steam ID',
    ALREADY_PRIORITY_QUEUE_UNTIL: 'Priority Queue until',

    PERK_INCLUDED: 'Includes following perks:',
    PERK_PRIORITY_QUEUE_DESCRIPTION: '{{amountInDays}} days Priority Queue on {{serverName}}',
    PERK_PRIORITY_QUEUE_PERMANENT_DESCRIPTION: 'Permanent Priority Queue on {{serverName}}',
    PERK_PRIORITY_QUEUE_MULTI_DESCRIPTION: '{{amountInDays}} days Priority Queue on one of these servers: {{serverNames}}',
    PERK_PRIORITY_QUEUE_MULTI_PERMANENT_DESCRIPTION: 'Permanent Priority Queue on one of these servers: {{serverNames}}',
    PERK_DISCORD_ROLE_DESCRIPTION: 'These discord roles will be assigned to your user: {{roles}}',
    PERK_DISCORD_ROLE_SHORT: 'Discord role: {{roles}}',
    PERK_WHITELIST_DESCRIPTION: 'Whitelisted on {{serverName}} for {{amountInDays}} days',
    PERK_WHITELIST_PERMANENT_DESCRIPTION: 'Permanently whitelisted on {{serverName}}',
    PERK_RESERVED_SLOT_DESCRIPTION: 'Reserved slot on {{serverName}} for {{amountInDays}} days',
    PERK_RESERVED_SLOT_PERMANENT_DESCRIPTION: 'Permanent reserved slot on {{serverName}}',
    PERK_LB_AG_PG_DESCRIPTION: 'Permanent {{pgName}} in game tag in chat on {{serverName}}',
    PERK_LB_AG_PG_DESCRIPTION_MULTI: 'Permanent {{pgName}} in game tag in chat on one of these servers: {{serverNames}}',

    NOTIFICATIONS_REDEEM_SUCCESSFUL_TITLE: 'Donation redeemed',
    NOTIFICATIONS_REDEEM_SUCCESSFUL_DESCRIPTION: 'A donator redeemed perks of the package they donated for.',
    NOTIFICATIONS_REDEEM_SUCCESSFUL_USERNAME: 'Username',
    NOTIFICATIONS_REDEEM_SUCCESSFUL_DISCORD_ID: 'Discord ID',
    NOTIFICATIONS_REDEEM_SUCCESSFUL_STEAM_ID: 'Steam ID',
    NOTIFICATIONS_REDEEM_SUCCESSFUL_PACKAGE: 'Package name',
    NOTIFICATIONS_REDEEM_SUCCESSFUL_TRANSACTION: 'Transaction details',
    NOTIFICATIONS_REDEEM_ERROR_TITLE: 'Redeem of perk errored',
    NOTIFICATIONS_REDEEM_ERROR_RETRY_TITLE: 'Donator retry link',
    NOTIFICATIONS_REDEEM_ERROR_RETRY_LINK: 'Retry link',
    NOTIFICATIONS_PAYMENT_SUCCESSFUL_TITLE: 'New Donation',
    NOTIFICATIONS_PAYMENT_SUCCESSFUL_DESCRIPTION: 'A new donation was received. The payment succeeded.',
    NOTIFICATIONS_PAYMENT_SUCCESSFUL_PUBLIC_DESCRIPTION: 'Thanks {{user}} for donating and supporting our community! :heart:',
    NOTIFICATIONS_PAYMENT_SUCCESSFUL_CUSTOM_MESSAGE: 'Custom message of donator',
    NOTIFICATIONS_SUBSCRIPTION_CREATED_TITLE: 'New Subscription',
    NOTIFICATIONS_SUBSCRIPTION_CREATED_DESCRIPTION: 'A donator subscribed to a package. The first payment is pending.',
    NOTIFICATIONS_SUBSCRIPTION_EXECUTED_TITLE: 'A payment was made by a subscription',
    NOTIFICATIONS_SUBSCRIPTION_EXECUTED_DESCRIPTION: 'A recurring subscription created a payment.',
    NOTIFICATIONS_SUBSCRIPTION_CANCELLED_TITLE: 'Subscription cancelled',
    NOTIFICATIONS_SUBSCRIPTION_CANCELLED_DESCRIPTION: 'A donator cancelled a subscription.',
    NOTIFICATIONS_SUBSCRIPTION_ID: 'Subscription ID',
    NOTIFICATIONS_SUBSCRIPTION_PACKAGE: 'Subscribed to package',
    NOTIFICATIONS_SUBSCRIPTION_DETAILS: 'Subscription details',
    USER_NOTIFICATIONS_SUB_DETAILS_LINK: 'Details incl. Cancel Link',
    USER_NOTIFICATIONS_SUB_DETAILS_LINK_CAPTION: 'Subscription details',

    USER_NOTIFICATIONS_FAILED_REDEEM_TEXT: 'Hi :wave:,\n\nThanks for your donation. Unfortunately, we were unable to setup a perk for you :cold_sweat:\nWith the link below you can retry the redeem at a later time. If it still does not work for you, please contact us in our discord. Sorry for the inconvenience!',
    USER_NOTIFICATIONS_FAILED_REDEEM_RETRY_TITLE: 'Retry link',
    USER_NOTIFICATIONS_FAILED_REDEEM_RETRY_LINK: 'Click me :smiley:',
    USER_NOTIFICATIONS_STEAM_ID: 'Steam ID',
    USER_NOTIFICATIONS_DISCORD_LINK: 'Link to our discord',
    USER_NOTIFICATIONS_PACKAGE: 'Package name',
    USER_NOTIFICATIONS_SUB_EXECUTED_TEXT: 'Hi :wave:,\n\nThanks again for donating to our community. We received a payment of your recurring subscription :pray:\nAs part of that subscription we automatically extended the included perks for you.\nIf you want to cancel this subscription, please go to your PayPal account -> Settings and cancel the subscription there.\n\nIf you have any questions, feel free to get in touch with us. Thanks again for your donation and have a good day :heart:',
    USER_NOTIFICATIONS_SUB_TRANSACTION_ID: 'This payment will show in your PayPal activity with this Transaction ID',

    PAYMENT_METHOD_PAYPAL: 'PayPal',
    PAYMENT_METHOD_STRIPE: 'Other (Credit Card, Klarna, etc.)',

    WAIT_FOR_PAYMENT_TITLE: 'Payment pending',
    WAIT_FOR_PAYMENT_DESCRIPTION: 'We are still waiting for the payment to be processed and confirmed by the payment provider. You can only redeem your perks when the payment is confirmed. This should usually not take more than several seconds to some minutes. Please refresh this page to check if the payment succeeded.',

    ERROR_STEAM_ID_MISMATCH_TITLE: 'Steam ID mismatch',
    ERROR_STEAM_ID_MISMATCH_DESCRIPTION: 'The Steam ID for this donation is different from the one connected with your profile.',
    ERROR_STEAM_ID_MISMATCH_ORDER_LABEL: 'Steam ID of donation',
    ERROR_STEAM_ID_MISMATCH_USER_LABEL: 'Your Steam ID',

    ERROR_LOGIN: 'Login error',
    ERROR_LOGIN_DESCRIPTION: 'The login was not successful. Please make sure you complete the login on the Discord page.',
    ERROR_LOGIN_AGAIN: 'Login again',

    ERROR_ORDER_NOT_FOUND: 'Order with ID {{orderId}} not found',

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
            message = message.replace(new RegExp(`{{${param}}}`, 'g'), options.params[param]);
        }
    }
    return message;
}

const settings: TranslationSettings = {
    language: 'en',
};
export default settings;
