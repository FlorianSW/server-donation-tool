import {Notifier, Type} from '../domain/notifier';
import {Order} from '../domain/payment';
import {User} from '../domain/user';
import {EmbedFieldData, MessageEmbed, WebhookClient} from 'discord.js';
import {translate} from '../translations';
import {RedeemError} from '../domain/package';

export interface DiscordNotification {
    webhookUrl: string,
    username?: string,
    types: Type[],
}

function webhookClient(notification: DiscordNotification): WebhookClient {
    const parts = notification.webhookUrl.split('/');
    return new WebhookClient(parts[parts.length - 2], parts[parts.length - 1]);
}

export class DiscordNotifier implements Notifier {
    constructor(private readonly notifications: DiscordNotification[]) {
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
Transaction ID: ${order.transactionId}
Order created at: ${order.created}`
            }
        ]
    }
}
