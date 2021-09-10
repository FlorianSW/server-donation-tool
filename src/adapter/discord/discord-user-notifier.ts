import {Order} from '../../domain/payment';
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
        events.on('successfulSubscriptionExecution', this.successfulSubscriptionExecution.bind(this));
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
            embed: embed
        });
    }

    async successfulSubscriptionExecution(target: RedeemTarget, order: Order): Promise<void> {
        const discordUser = await this.client.users.fetch(order.reference.discordId);
        const embed = new MessageEmbed()
            .setColor('DARK_GREEN')
            .addFields(this.metaFields(target, order))
            .addField(translate('USER_NOTIFICATIONS_SUB_TRANSACTION_ID'), order.payment.transactionId, false);

        await discordUser.send({
            content: translate('USER_NOTIFICATIONS_SUB_EXECUTED_TEXT'),
            embed: embed
        });
    }

    private metaFields(target: RedeemTarget, order: Order): EmbedFieldData[] {
        return [
            {name: translate('USER_NOTIFICATIONS_STEAM_ID'), value: target.steamId, inline: true},
            {name: translate('USER_NOTIFICATIONS_PACKAGE'), value: order.reference.p.name, inline: true},
        ]
    }
}