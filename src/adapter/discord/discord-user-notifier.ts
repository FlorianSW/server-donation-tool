import {Order, Subscription, SubscriptionPlan} from '../../domain/payment';
import {Client, EmbedFieldData, MessageEmbed} from 'discord.js';
import {translate} from '../../translations';
import {RedeemTarget} from '../../domain/package';
import {DonationEvents} from '../../domain/events';
import {inject, singleton} from 'tsyringe';
import {AppConfig} from '../../domain/app-config';

@singleton()
export class DiscordUserNotifier {
    constructor(@inject('DonationEvents') private readonly events: DonationEvents, @inject('AppConfig') private readonly config: AppConfig, @inject('discord.Client') private readonly client: Client) {
        events.on('failedRedeemPerk', this.onFailedRedeemPerk.bind(this));
        events.on('subscriptionExecuted', this.onSubscriptionExecuted.bind(this));
    }

    async onFailedRedeemPerk(target: RedeemTarget, order: Order): Promise<void> {
        const discordUser = await this.client.users.fetch(order.reference.discordId);
        const embed = new MessageEmbed()
            .setColor('DARK_RED')
            .addFields(this.metaFields(target, order))
            .addField(translate('USER_NOTIFICATIONS_FAILED_REDEEM_RETRY_TITLE'), `[${translate('USER_NOTIFICATIONS_FAILED_REDEEM_RETRY_LINK')}](${order.asLink(this.config)})`, true);

        if (this.config.app.community?.discord) {
            embed.addField(translate('USER_NOTIFICATIONS_DISCORD_LINK'), `[${this.config.app.community.title}](${this.config.app.community.discord})`, true)
        }
        await discordUser.send({
            content: translate('USER_NOTIFICATIONS_FAILED_REDEEM_TEXT'),
            embeds: [embed],
        });
    }

    async onSubscriptionExecuted(target: RedeemTarget, plan: SubscriptionPlan, sub: Subscription, order: Order): Promise<void> {
        const discordUser = await this.client.users.fetch(order.reference.discordId);
        const embed = new MessageEmbed()
            .setColor('DARK_GREEN')
            .addFields(this.metaFields(target, order))
            .addField(translate('USER_NOTIFICATIONS_SUB_TRANSACTION_ID'), order.payment.transactionId, false)
            .addField(translate('USER_NOTIFICATIONS_SUB_DETAILS_LINK'), `[Subscription details](${new URL(`/subscriptions/${sub.id}`, this.config.app.publicUrl).toString()})`, true);

        await discordUser.send({
            content: translate('USER_NOTIFICATIONS_SUB_EXECUTED_TEXT'),
            embeds: [embed],
        });
    }

    private metaFields(target: RedeemTarget, order: Order): EmbedFieldData[] {
        return [
            {name: translate('USER_NOTIFICATIONS_STEAM_ID'), value: target.steamId, inline: true},
            {name: translate('USER_NOTIFICATIONS_PACKAGE'), value: order.reference.p.name, inline: true},
        ]
    }
}
