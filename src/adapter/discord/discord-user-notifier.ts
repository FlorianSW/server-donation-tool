import {Order, Subscription, SubscriptionPlan} from '../../domain/payment';
import {APIEmbedField, Client, Colors, EmbedBuilder} from 'discord.js';
import {translate} from '../../translations';
import {RedeemTarget} from '../../domain/package';
import {DonationEvents} from '../../domain/events';
import {inject, singleton} from 'tsyringe';
import {AppConfig} from '../../domain/app-config';
import {Logger} from 'winston';

@singleton()
export class DiscordUserNotifier {
    constructor(
        @inject('DonationEvents') private readonly events: DonationEvents,
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('discord.Client') private readonly client: Client,
        @inject('Logger') private readonly logger: Logger,
    ) {
        events.on('failedRedeemPerk', this.onFailedRedeemPerk.bind(this));
        events.on('subscriptionExecuted', this.onSubscriptionExecuted.bind(this));
    }

    async onFailedRedeemPerk(target: RedeemTarget, order: Order): Promise<void> {
        const discordUser = await this.client.users.fetch(order.reference.gameId.discord);
        const embed = new EmbedBuilder()
            .setColor(Colors.DarkRed)
            .addFields(this.metaFields(target, order))
            .addFields([{
                name: translate('USER_NOTIFICATIONS_FAILED_REDEEM_RETRY_TITLE'),
                value: `[${translate('USER_NOTIFICATIONS_FAILED_REDEEM_RETRY_LINK')}](${order.asLink(this.config)})`,
                inline: true,
            }]);

        if (this.config.app.community?.discord) {
            embed.addFields([{
                name: translate('USER_NOTIFICATIONS_DISCORD_LINK'),
                value: `[${this.config.app.community.title}](${this.config.app.community.discord})`,
                inline: true,
            }])
        }
        try {
            await discordUser.send({
                content: translate('USER_NOTIFICATIONS_FAILED_REDEEM_TEXT'),
                embeds: [embed],
            });
        } catch (e) {
            this.logger.warn('Could not send failed redeem message to ' + order.reference.gameId.discord, e);
        }
    }

    async onSubscriptionExecuted(target: RedeemTarget, plan: SubscriptionPlan, sub: Subscription, order: Order): Promise<void> {
        const discordUser = await this.client.users.fetch(order.reference.gameId.discord);
        const embed = new EmbedBuilder()
            .setColor(Colors.DarkGreen)
            .addFields(this.metaFields(target, order))
            .addFields([{
                name: translate('USER_NOTIFICATIONS_SUB_TRANSACTION_ID'),
                value: order.payment.transactionId,
                inline: false
            }, {
                name: translate('USER_NOTIFICATIONS_SUB_DETAILS_LINK'),
                value: `[Subscription details](${new URL(`/subscriptions/${sub.id}`, this.config.app.publicUrl).toString()})`,
                inline: true,
            }]);

        try {
            await discordUser.send({
                content: translate('USER_NOTIFICATIONS_SUB_EXECUTED_TEXT'),
                embeds: [embed],
            });
        } catch (e) {
            this.logger.error('Could not send subscription executed message to ' + order.reference.gameId.discord, e);
        }
    }

    private metaFields(target: RedeemTarget, order: Order): APIEmbedField[] {
        return [
            {name: translate('USER_NOTIFICATIONS_STEAM_ID'), value: target.gameId.steam || 'Not defined', inline: true},
            {name: translate('USER_NOTIFICATIONS_PLAYSTATION'), value: target.gameId.playstation || 'Not defined', inline: true},
            {name: translate('USER_NOTIFICATIONS_XBOX'), value: target.gameId.xbox || 'Not defined', inline: true},
            {name: translate('USER_NOTIFICATIONS_PACKAGE'), value: order.reference.p.name, inline: true},
        ]
    }
}
