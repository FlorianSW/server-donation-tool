import {Order} from '../domain/payment';
import {User} from '../domain/user';
import {EmbedFieldData, MessageEmbed, WebhookClient} from 'discord.js';
import {translate} from '../translations';
import {RedeemError} from '../domain/package';
import {DonationEvents} from '../domain/events';
import {inject, singleton} from 'tsyringe';
import {AppConfig} from '../domain/app-config';

export enum Type {
    SUCCESSFUL_REDEEM = 'SUCCESSFUL_REDEEM',
    REDEEM_ERROR = 'REDEEM_ERROR',
    DONATED = 'DONATED',
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
        events.on('successfulRedeem', this.onSuccessfulRedeem.bind(this));
        events.on('failedRedeemPerk', this.onFailedRedeemPerk.bind(this));
    }

    get notifications(): DiscordNotification[] {
        return this.config.discord.notifications;
    }

    async onSuccessfulPayment(user: User, order: Order): Promise<void> {
        this.notifications
            .filter((n) => n.types.includes(Type.DONATED))
            .forEach((d) => {
                webhookClient(d).send({
                    username: d.username || 'Donations',
                    embeds: [
                        new MessageEmbed()
                            .setColor('DARK_BLUE')
                            .setTitle(translate('NOTIFICATIONS_PAYMENT_SUCCESSFUL_TITLE'))
                            .setDescription(translate('NOTIFICATIONS_PAYMENT_SUCCESSFUL_DESCRIPTION'))
                            .addFields(this.metaFields(user, order))
                    ],
                });
            });
    }

    async onSuccessfulRedeem(user: User, order: Order): Promise<void> {
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
                            .addFields(this.metaFields(user, order))
                    ],
                });
            });
    }

    async onFailedRedeemPerk(user: User, order: Order, error: RedeemError): Promise<void> {
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
                            .addFields(this.metaFields(user, order))
                    ],
                });
            });
    }

    private metaFields(user: User, order: Order): EmbedFieldData[] {
        return [
            {
                name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_USERNAME'),
                value: `<@${user.discord.id}> (${user.username})`,
                inline: true
            },
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_DISCORD_ID'), value: user.discord.id, inline: true},
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_STEAM_ID'), value: user.steam.id, inline: true},
            {name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_PACKAGE'), value: order.reference.p.name, inline: true},
            {
                name: translate('NOTIFICATIONS_REDEEM_SUCCESSFUL_TRANSACTION'), value: `Order ID: ${order.id}
PayPal Order ID: ${order.payment.id}
Transaction ID: ${order.payment.transactionId}
Order created at: ${order.created}`
            }
        ]
    }
}
