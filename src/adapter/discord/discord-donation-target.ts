import {inject, singleton} from 'tsyringe';
import {DonationEvents} from '../../domain/events';
import {AppConfig} from '../../domain/app-config';
import {Client, Message, MessageEmbed} from 'discord.js';
import {Logger} from 'winston';
import {Closeable} from '../../index';
import {translate} from '../../translations';
import {CalculateDonationTarget} from '../../service/donation-target';

const PROGRESS_LENGTH = 45;

@singleton()
export class DiscordDonationTarget implements Closeable {
    private message: Message;

    constructor(
        @inject('DonationEvents') private readonly events: DonationEvents,
        @inject('AppConfig') private readonly config: AppConfig,
        @inject(CalculateDonationTarget) private readonly target: CalculateDonationTarget,
        @inject('discord.Client') private readonly client: Client,
        @inject('Logger') logger: Logger
    ) {
        if (config.app.community.donationTarget.discordChannelId) {
            client.channels.fetch(config.app.community.donationTarget.discordChannelId).then(async (c) => {
                if (c.isText()) {
                    const messages = await c.messages.fetch({limit: 100});
                    const message = messages.find((m) => m.author.id === client.user.id);
                    if (target.hasMonthlyTarget()) {
                        if (message) {
                            logger.debug(`Selected ${message.id} as target message`);
                            this.message = message;
                        } else {
                            logger.info('Did not find donation target message for updates, hence creating a new one');
                            this.message = await c.send(new MessageEmbed().setTitle(translate('DONATION_TARGET_DISCORD_TITLE')));
                        }
                        this.events.on('successfulPayment', this.updateDonationTargetMessage.bind(this));
                        await this.updateDonationTargetMessage();
                    } else if (message) {
                        await message.delete({reason: 'Donation target not configured anymore.'});
                    }
                } else {
                    logger.warn('Can not use non-text based channel for donation target messages.');
                }
            });
        }
    }

    async close(): Promise<void> {
        this.events.off('successfulPayment', this.updateDonationTargetMessage.bind(this));
    }

    private async updateDonationTargetMessage() {
        const target = await this.target.monthly();
        const embed = new MessageEmbed().setTitle(translate('DONATION_TARGET_DISCORD_TITLE'));
        let squares;
        let msgKey;
        if (target.reached) {
            squares = PROGRESS_LENGTH;
            msgKey = 'DONATION_TARGET_REACHED';
            embed.setColor('DARK_GREEN');
        } else {
            msgKey = 'DONATION_TARGET_CLAIM';
            const percentageReached = target.totalAmount / target.target * 100;
            squares = Math.ceil(percentageReached * PROGRESS_LENGTH / 100);
            if (percentageReached <= 50) {
                embed.setColor('DARK_RED');
            } else if (percentageReached <= 85) {
                embed.setColor('YELLOW');
            } else {
                embed.setColor('DARK_GREEN');
            }
        }
        const dashes = PROGRESS_LENGTH - squares;
        embed.setDescription(`${translate(msgKey, {
            params: {
                totalAmount: target.totalAmount.toString(10),
                currency: target.currency,
                target: target.target.toString(10),
            }
        })}

\`0${target.currency} [${'□'.repeat(squares)}${'-'.repeat(dashes)}] ${target.target}${target.currency}\``)
            .setURL(this.config.app.publicUrl)
            .setFooter('Server Donation Tool made by FlorianSW')
            .addField(translate('DONATION_TARGET_CALL_TO_ACTION_TITLE'), `[${translate('DONATION_TARGET_CALL_TO_ACTION_LINK')}](${this.config.app.publicUrl})`);

        if (this.config.logoUrl(true)) {
            embed.setImage(this.config.logoUrl(true));
        }

        await this.message.edit(embed);
    }
}
