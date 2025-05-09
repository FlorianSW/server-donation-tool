import {Order, Subscription, SubscriptionPlan} from '../../domain/payment';
import {APIEmbedField, Colors, EmbedBuilder, WebhookClient} from 'discord.js';
import {translate} from '../../translations';
import {Perk, RedeemError, RedeemTarget} from '../../domain/package';
import {DonationEvents} from '../../domain/events';
import {inject, singleton} from 'tsyringe';
import {AppConfig} from '../../domain/app-config';

export enum Type {
    SUCCESSFUL_REDEEM = 'SUCCESSFUL_REDEEM',
    SUCCESSFUL_REFUND = 'SUCCESSFUL_REFUND',
    REDEEM_ERROR = 'REDEEM_ERROR',
    REFUND_ERROR = 'REFUND_ERROR',
    DONATED = 'DONATED',
    DONATED_PUBLIC = 'DONATED_PUBLIC',
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
    return new WebhookClient({url: notification.webhookUrl});
}

@singleton()
export class DiscordNotifier {
    constructor(@inject('DonationEvents') readonly events: DonationEvents, @inject('AppConfig') private readonly config: AppConfig) {
        events.on('successfulPayment', this.onSuccessfulPayment.bind(this));
        events.on('successfulRefund', this.onSuccessfulRefund.bind(this));
        events.on('subscriptionCreated', this.onSubscriptionCreated.bind(this));
        events.on('subscriptionCancelled', this.onSubscriptionCancelled.bind(this));
        events.on('subscriptionExecuted', this.onSubscriptionExecuted.bind(this));
        events.on('successfulRedeem', this.onSuccessfulRedeem.bind(this));
        events.on('failedRedeemPerk', this.onFailedRedeemPerk.bind(this));
        events.on('failedRefundPerk', this.failedRefundPerk.bind(this));
    }

    get notifications(): DiscordNotification[] {
        return this.config.discord.notifications;
    }

    async onSuccessfulPayment(target: RedeemTarget, order: Order): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.DONATED))
            .forEach((d) => {
                const embed = new EmbedBuilder()
                    .setColor(Colors.DarkBlue)
                    .setTitle(translate('NOTIFICATIONS_PAYMENT_SUCCESSFUL_TITLE'))
                    .setDescription(translate('NOTIFICATIONS_PAYMENT_SUCCESSFUL_DESCRIPTION'))
                    .addFields(this.donatorMetaFields(target))
                    .addFields(this.orderMetaFields(order));

                if (order.customMessage) {
                    embed.addFields([{
                        name: translate('NOTIFICATIONS_PAYMENT_SUCCESSFUL_CUSTOM_MESSAGE'),
                        value: order.customMessage
                    }]);
                }
                webhookClient(d).send({
                    username: d.username || 'Donations',
                    embeds: [embed],
                });
            });
        this.notifications
            .filter((n) => n.types.includes(Type.DONATED_PUBLIC))
            .forEach((d) => {
                const embed = new EmbedBuilder()
                    .setColor(Colors.Green)
                    .setTitle(translate('NOTIFICATIONS_PAYMENT_SUCCESSFUL_TITLE'))
                    .setURL(this.config.app.publicUrl.toString())
                    .setFooter({text: 'Server Donation Tool by FlorianSW'})
                    .setDescription(translate('NOTIFICATIONS_PAYMENT_SUCCESSFUL_PUBLIC_DESCRIPTION', {
                        params: {
                            user: `<@${target.gameId.discord}> ${target.username ? `(${target.username})` : ''}`,
                            username: target.username || '',
                            userId: target.gameId.discord,
                            package: order.reference.p.name,
                            price: `${order.reference.p.price.currency} ${order.reference.p.price.amount}`,
                        }
                    }));

                webhookClient(d).send({
                    username: d.username || 'Donations',
                    embeds: [embed],
                });
            });
    }

    async onSuccessfulRefund(target: RedeemTarget, order: Order): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.SUCCESSFUL_REFUND))
            .forEach((d) => {
                const embed = new EmbedBuilder()
                    .setColor(Colors.DarkGrey)
                    .setTitle(translate('NOTIFICATIONS_REFUND_SUCCESSFUL_TITLE'))
                    .setDescription(translate('NOTIFICATIONS_REFUND_SUCCESSFUL_DESCRIPTION'))
                    .addFields(this.donatorMetaFields(target))
                    .addFields(this.orderMetaFields(order));

                webhookClient(d).send({
                    username: d.username || 'Donation Refunds',
                    embeds: [embed],
                });
            });
    }

    async onSubscriptionCreated(target: RedeemTarget, plan: SubscriptionPlan, sub: Subscription): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.SUBSCRIPTION_CREATED))
            .forEach((d) => {
                const embed = new EmbedBuilder()
                    .setColor(Colors.DarkBlue)
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
                const embed = new EmbedBuilder()
                    .setColor(Colors.DarkRed)
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
                const embed = new EmbedBuilder()
                    .setColor(Colors.DarkGreen)
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

    async onSuccessfulRedeem(target: RedeemTarget, order: Order, perks: Perk[]): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.SUCCESSFUL_REDEEM))
            .forEach((d) => {
                webhookClient(d).send({
                    username: d.username || 'Donations',
                    embeds: [
                        new EmbedBuilder()
                            .setColor(Colors.DarkGreen)
                            .setTitle(translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_TITLE'))
                            .setDescription(translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_DESCRIPTION'))
                            .addFields(this.donatorMetaFields(target))
                            .addFields(this.orderMetaFields(order, perks))
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
                        new EmbedBuilder()
                            .setColor(Colors.DarkRed)
                            .setTitle(translate('NOTIFICATIONS_REDEEM_ERROR_TITLE'))
                            .setDescription(translate(...error.params))
                            .addFields(this.donatorMetaFields(target))
                            .addFields(this.orderMetaFields(order))
                            .addFields([{
                                name: translate('NOTIFICATIONS_REDEEM_ERROR_RETRY_TITLE'),
                                value: `[${translate('NOTIFICATIONS_REDEEM_ERROR_RETRY_LINK')}](${order.asLink(this.config)})`,
                                inline: true,
                            }])
                    ],
                });
            });
    }

    async failedRefundPerk(target: RedeemTarget, order: Order, error: RedeemError): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.REFUND_ERROR))
            .forEach((d) => {
                webhookClient(d).send({
                    username: d.username || 'Donation Refund Errors',
                    embeds: [
                        new EmbedBuilder()
                            .setColor(Colors.Yellow)
                            .setTitle(translate('NOTIFICATIONS_REFUND_ERROR_TITLE'))
                            .setDescription(translate(...error.params))
                            .addFields(this.donatorMetaFields(target))
                            .addFields(this.orderMetaFields(order))
                    ],
                });
            });
    }

    private donatorMetaFields(target: RedeemTarget): APIEmbedField[] {
        return [
            {
                name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_USERNAME'),
                value: `<@${target.gameId.discord}> ${target.username ? `(${target.username})` : ''}`,
                inline: true
            },
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_DISCORD_ID'), value: target.gameId.discord, inline: true},
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_STEAM_ID'), value: target.gameId.steam || 'Not defined', inline: true},
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_PLAYSTATION'), value: target.gameId.playstation || 'Not defined', inline: true},
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_XBOX'), value: target.gameId.xbox || 'Not defined', inline: true}
        ];
    }

    private orderMetaFields(order: Order, perks: Perk[] = []): APIEmbedField[] {
        let redeemedPerks = '';
        if (perks.length !== 0) {
            redeemedPerks = `Redeemed perks: ${perks.map((p) => p.asShortString(order))}`;
        }
        return [
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_PACKAGE'), value: order.reference.p.name, inline: true},
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_PAYED_PRICE'), value: `${order.reference.p.price.amount} ${order.reference.p.price.currency}`, inline: true},
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_TYPE'), value: order.reference.type, inline: true},
            {
                name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_TRANSACTION'), value: `Order ID: ${order.id}
Payment Order ID: ${order.payment.id} (${order.payment.provider})
Transaction ID: ${order.payment.transactionId}
Order created at: ${order.created}
Perks: ${order.reference.p.perks.map((p) => p.asShortString(order)).join(', ')}
${redeemedPerks}`
            }
        ]
    }

    private subscriptionMetaFields(sub: Subscription, plan: SubscriptionPlan): APIEmbedField[] {
        return [
            {name: translate('NOTIFICATIONS_SUBSCRIPTION_PACKAGE'), value: plan.basePackage.name, inline: true},
            {
                name: translate('NOTIFICATIONS_SUBSCRIPTION_DETAILS'), value: `Subscription ID: ${sub.id}
Plan ID: ${sub.planId}
Provider Subscription ID: ${sub.payment.id}
Provider Product ID: ${plan.payment.productId}
Provider Plan ID: ${plan.payment.planId}
Price per cycle: ${plan.basePackage.price.currency} ${plan.basePackage.price.amount}
Billing cycle: ${plan.basePackage.subscription}
`
            }
        ]
    }
}
