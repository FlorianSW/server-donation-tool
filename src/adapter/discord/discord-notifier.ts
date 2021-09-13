import {Order, Subscription, SubscriptionPlan} from '../../domain/payment';
import {EmbedFieldData, MessageEmbed, WebhookClient} from 'discord.js';
import {translate} from '../../translations';
import {RedeemError, RedeemTarget} from '../../domain/package';
import {DonationEvents} from '../../domain/events';
import {inject, singleton} from 'tsyringe';
import {AppConfig} from '../../domain/app-config';

export enum Type {
    SUCCESSFUL_REDEEM = 'SUCCESSFUL_REDEEM',
    REDEEM_ERROR = 'REDEEM_ERROR',
    DONATED = 'DONATED',
    SUBSCRIPTION_EXECUTED = 'SUBSCRIPTION_EXECUTED',
    SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
    SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
}

export interface DiscordNotification {
    webhookUrl: string,
    username?: string,
    types: Type[],
}

function webhookClient(notification: DiscordNotification): WebhookClient {
    const parts = notification.webhookUrl.split('/');
    return new WebhookClient(parts[parts.length - 2], parts[parts.length - 1]);
}

@singleton()
export class DiscordNotifier {
    constructor(@inject('DonationEvents') private readonly events: DonationEvents, @inject('AppConfig') private readonly config: AppConfig) {
        events.on('successfulPayment', this.onSuccessfulPayment.bind(this));
        events.on('subscriptionCreated', this.onSubscriptionCreated.bind(this));
        events.on('subscriptionCancelled', this.onSubscriptionCancelled.bind(this));
        events.on('subscriptionExecuted', this.onSubscriptionExecuted.bind(this));
        events.on('successfulRedeem', this.onSuccessfulRedeem.bind(this));
        events.on('failedRedeemPerk', this.onFailedRedeemPerk.bind(this));
    }

    get notifications(): DiscordNotification[] {
        return this.config.discord.notifications;
    }

    async onSuccessfulPayment(target: RedeemTarget, order: Order): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.DONATED))
            .forEach((d) => {
                const embed = new MessageEmbed()
                    .setColor('DARK_BLUE')
                    .setTitle(translate('NOTIFICATIONS_PAYMENT_SUCCESSFUL_TITLE'))
                    .setDescription(translate('NOTIFICATIONS_PAYMENT_SUCCESSFUL_DESCRIPTION'))
                    .addFields(this.donatorMetaFields(target))
                    .addFields(this.orderMetaFields(order));

                if (order.customMessage) {
                    embed.addField(translate('NOTIFICATIONS_PAYMENT_SUCCESSFUL_CUSTOM_MESSAGE'), order.customMessage);
                }
                webhookClient(d).send({
                    username: d.username || 'Donations',
                    embeds: [embed],
                });
            });
    }

    async onSubscriptionCreated(target: RedeemTarget, plan: SubscriptionPlan, sub: Subscription): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.SUBSCRIPTION_CREATED))
            .forEach((d) => {
                const embed = new MessageEmbed()
                    .setColor('DARK_BLUE')
                    .setTitle(translate('NOTIFICATIONS_SUBSCRIPTION_CREATED_TITLE'))
                    .setDescription(translate('NOTIFICATIONS_SUBSCRIPTION_CREATED_DESCRIPTION'))
                    .addFields(this.donatorMetaFields(target))
                    .addFields(this.subscriptionMetaFields(sub, plan));

                webhookClient(d).send({
                    username: d.username || 'Donations',
                    embeds: [embed],
                });
            });
    }

    async onSubscriptionCancelled(target: RedeemTarget, plan: SubscriptionPlan, sub: Subscription): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.SUBSCRIPTION_CANCELLED))
            .forEach((d) => {
                const embed = new MessageEmbed()
                    .setColor('DARK_RED')
                    .setTitle(translate('NOTIFICATIONS_SUBSCRIPTION_CANCELLED_TITLE'))
                    .setDescription(translate('NOTIFICATIONS_SUBSCRIPTION_CANCELLED_DESCRIPTION'))
                    .addFields(this.donatorMetaFields(target))
                    .addFields(this.subscriptionMetaFields(sub, plan));

                webhookClient(d).send({
                    username: d.username || 'Donations',
                    embeds: [embed],
                });
            });
    }

    async onSubscriptionExecuted(target: RedeemTarget, plan: SubscriptionPlan, sub: Subscription, order: Order): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.SUBSCRIPTION_EXECUTED))
            .forEach((d) => {
                const embed = new MessageEmbed()
                    .setColor('DARK_GREEN')
                    .setTitle(translate('NOTIFICATIONS_SUBSCRIPTION_EXECUTED_TITLE'))
                    .setDescription(translate('NOTIFICATIONS_SUBSCRIPTION_EXECUTED_DESCRIPTION'))
                    .addFields(this.donatorMetaFields(target))
                    .addFields(this.subscriptionMetaFields(sub, plan))
                    .addFields(this.orderMetaFields(order));

                webhookClient(d).send({
                    username: d.username || 'Donations',
                    embeds: [embed],
                });
            });
    }

    async onSuccessfulRedeem(target: RedeemTarget, order: Order): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.SUCCESSFUL_REDEEM))
            .forEach((d) => {
                webhookClient(d).send({
                    username: d.username || 'Donations',
                    embeds: [
                        new MessageEmbed()
                            .setColor('DARK_GREEN')
                            .setTitle(translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_TITLE'))
                            .setDescription(translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_DESCRIPTION'))
                            .addFields(this.donatorMetaFields(target))
                            .addFields(this.orderMetaFields(order))
                    ],
                });
            });
    }

    async onFailedRedeemPerk(target: RedeemTarget, order: Order, error: RedeemError): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.REDEEM_ERROR))
            .forEach((d) => {
                webhookClient(d).send({
                    username: d.username || 'Donations',
                    embeds: [
                        new MessageEmbed()
                            .setColor('DARK_RED')
                            .setTitle(translate('NOTIFICATIONS_REDEEM_ERROR_TITLE'))
                            .setDescription(translate(...error.params))
                            .addFields(this.donatorMetaFields(target))
                            .addFields(this.orderMetaFields(order))
                            .addField(translate('NOTIFICATIONS_REDEEM_ERROR_RETRY_TITLE'), `[${translate('NOTIFICATIONS_REDEEM_ERROR_RETRY_LINK')}](${order.asLink(this.config)})`, true)
                    ],
                });
            });
    }

    private donatorMetaFields(target: RedeemTarget): EmbedFieldData[] {
        return [
            {
                name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_USERNAME'),
                value: `<@${target.discordId}> ${target.username ? `(${target.username})` : ''}`,
                inline: true
            },
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_DISCORD_ID'), value: target.discordId, inline: true},
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_STEAM_ID'), value: target.steamId, inline: true}
        ];
    }

    private orderMetaFields(order: Order): EmbedFieldData[] {
        return [
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_PACKAGE'), value: order.reference.p.name, inline: true},
            {
                name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_TRANSACTION'), value: `Order ID: ${order.id}
PayPal Order ID: ${order.payment.id}
Transaction ID: ${order.payment.transactionId}
Order created at: ${order.created}`
            }
        ]
    }

    private subscriptionMetaFields(sub: Subscription, plan: SubscriptionPlan): EmbedFieldData[] {
        return [
            {name: translate('NOTIFICATIONS_SUBSCRIPTION_PACKAGE'), value: plan.basePackage.name, inline: true},
            {
                name: translate('NOTIFICATIONS_SUBSCRIPTION_DETAILS'), value: `Subscription ID: ${sub.id}
Plan ID: ${sub.planId}
PayPal Subscription ID: ${sub.payment.id}
PayPal Product ID: ${plan.payment.productId}
PayPal Plan ID: ${plan.payment.planId}
Price per cycle: ${plan.basePackage.price.currency} ${plan.basePackage.price.amount}
Billing cycle: ${plan.basePackage.subscription}
`
            }
        ]
    }
}
