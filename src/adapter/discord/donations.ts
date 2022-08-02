import {inject, injectAll, singleton} from 'tsyringe';
import {Logger} from 'winston';
import {
    ApplicationCommandType,
    ButtonInteraction,
    ButtonStyle,
    Client, Colors,
    CommandInteraction, EmbedBuilder,
    Interaction, InteractionReplyOptions, InteractionUpdateOptions, MessageEditOptions, SelectMenuComponentOptionData,
    SelectMenuInteraction
} from 'discord.js';
import {AppConfig} from '../../domain/app-config';
import {translate} from '../../translations';
import {Package} from '../../domain/package';
import {DeferredPaymentOrder, Order, Payment, PaymentOrder, Reference} from '../../domain/payment';
import {OrderRepository} from '../../domain/repositories';

const PACKAGE_SELECTION = 'packageSelection';
const SELECT_PACKAGE = 'selectPackage';
const DONATE_MONEY = 'donate';

@singleton()
export class Donations {
    private appCommandId: string;

    constructor(
        @inject('discord.Client') private readonly client: Client,
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('availablePackages') private readonly packages: Package[],
        @inject('OrderRepository') private readonly repo: OrderRepository,
        @injectAll('Payment') private readonly payments: Payment[],
        @inject('Logger') private readonly logger: Logger,
    ) {
        this.manageAppCommand().then(() => {
            this.client.on('interactionCreate', this.onInteractionCreate.bind(this));
        });
    }

    private async manageAppCommand() {
        const guildId = this.config.discord.commands?.donate?.guildId;
        const disabled = this.config.discord.commands?.donate?.disabled ?? false;
        if (!guildId) {
            return;
        }
        const commands = await this.client.application.commands.fetch({
            guildId: guildId,
        });
        const command = commands.find((c) => c.name === translate('CMD_DONATE_NAME'));

        try {
            if (command) {
                this.appCommandId = command.id;
                if (disabled) {
                    await this.deleteAppCommand(this.appCommandId, this.config.discord.commands.donate.guildId);
                }
            } else if (disabled) {
                this.logger.debug('Donate command not configured, ignoring setup.');
            } else {
                this.appCommandId = await this.createAppCommand();
            }
        } catch (e) {
            this.logger.error('Unknown error while managing Discord app command.', e);
            process.exit(1);
        }
    }

    private async createAppCommand(): Promise<string> {
        const cmd = await this.client.application.commands.create({
            name: translate('CMD_DONATE_NAME'),
            description: translate('CMD_DONATE_DESCRIPTION'),
            type: ApplicationCommandType.ChatInput,
        }, this.config.discord.commands.donate.guildId);

        return cmd.id;
    }

    private async deleteAppCommand(id: string, guildId: string): Promise<void> {
        await this.client.application.commands.delete(id, guildId);
    }

    private async onInteractionCreate(interaction: Interaction): Promise<void> {
        if (interaction.isCommand() && interaction.commandName === translate('CMD_DONATE_NAME')) {
            await this.onDonateCommand(interaction);
        } else if (interaction instanceof SelectMenuInteraction && interaction.customId === SELECT_PACKAGE) {
            await this.onPackageSelect(interaction);
        } else if (interaction instanceof ButtonInteraction && interaction.customId === PACKAGE_SELECTION) {
            await this.onDonateCommand(interaction);
        } else if (interaction instanceof ButtonInteraction && interaction.customId.startsWith(DONATE_MONEY)) {
            await this.onDonateMoney(interaction);
        } else {
            this.logger.error('Received unknown interaction', interaction);
        }
    }

    private async onDonateCommand(interaction: CommandInteraction | ButtonInteraction): Promise<void> {
        const options: SelectMenuComponentOptionData[] = this.packages
            .filter((p) => p.perks.every((p) => p.subjects() === null))
            .map((p) => {
                return {
                    label: p.name,
                    description: `${p.description} (${p.price.currency} ${p.price.amount})`,
                    value: p.id.toString(10),
                };
            });

        const embeds: EmbedBuilder[] = [];
        if (this.packages.length !== options.length) {
            embeds.push(new EmbedBuilder().setDescription(translate('CMD_DONATE_HIDDEN_PACKAGES', {params: {fullSite: this.config.app.publicUrl.toString()}})))
        }

        const payload = {
            ephemeral: true,
            embeds: embeds,
            content: translate('CMD_DONATE_INTRO', {params: {name: interaction.user.username}}),
            components: [{
                type: 1,
                components: [{
                    type: 3,
                    label: translate('CMD_DONATE_PACKAGE_LABEL'),
                    customId: SELECT_PACKAGE,
                    options: options,
                }],
            }],
        } as InteractionReplyOptions & InteractionUpdateOptions;
        if (interaction instanceof ButtonInteraction) {
            await interaction.update(payload);
        } else {
            await interaction.reply(payload);
        }
    }

    private async onPackageSelect(interaction: SelectMenuInteraction): Promise<void> {
        const packageId = parseInt(interaction.values[0]);
        const selectedPackage = this.packages.find((p) => p.id === packageId);
        if (!selectedPackage) {
            await interaction.update({
                embeds: [],
                content: translate('CMD_DONATE_PACKAGE_DOES_NOT_EXIST_LABEL'),
                components: [{
                    type: 1,
                    components: [{
                        type: 2,
                        label: translate('CMD_DONATE_START_OVER'),
                        customId: PACKAGE_SELECTION,
                        style: ButtonStyle.Primary,
                    }],
                }],
            });
            return;
        }

        const buttons = this.payments.map((p) => ({
            type: 2,
            label: translate('PAYMENT_METHOD_' + p.provider().branding.name.toUpperCase()),
            customId: withPrefix(withPrefix(p.provider().branding.name, packageId.toString(10)), DONATE_MONEY),
            style: 'PRIMARY',
        }));

        await interaction.update({
            embeds: [this.buildPackageDetails(selectedPackage)],
            content: null,
            components: [{
                type: 1,
                components: [
                    ...buttons,
                    {
                        type: 2,
                        label: translate('CMD_DONATE_SELECT_ANOTHER'),
                        customId: PACKAGE_SELECTION,
                        style: 'PRIMARY',
                    }
                ],
            }],
        });
    }

    private buildPackageDetails(selectedPackage: Package): EmbedBuilder {
        return new EmbedBuilder()
            .setColor(Colors.DarkBlue)
            .setDescription(translate('CMD_DONATE_PACKAGE_DETAILS_TITLE', {params: {name: selectedPackage.name}}))
            .addFields([{
                name: translate('CMD_DONATE_PACKAGE_DETAILS_PERKS'),
                value: selectedPackage.perks.map((p) => '* ' + p.asShortString()).join('\n'),
            }, {
                name: translate('CMD_DONATE_PACKAGE_DETAILS_PRICE'),
                value: `${selectedPackage.price.currency} ${selectedPackage.price.amount}`,
                inline: true,
            }]);
    }

    private async onDonateMoney(interaction: ButtonInteraction): Promise<void> {
        const data = dropPrefix(interaction.customId).split('#');
        const packageId = parseInt(data[0]);
        const selectedPackage = this.packages.find((p) => p.id === packageId);
        if (!selectedPackage) {
            await interaction.update({
                embeds: [],
                content: translate('CMD_DONATE_PACKAGE_DOES_NOT_EXIST_LABEL'),
                components: [{
                    type: 1,
                    components: [{
                        type: 2,
                        label: translate('CMD_DONATE_START_OVER'),
                        customId: PACKAGE_SELECTION,
                        style: ButtonStyle.Primary,
                    }],
                }],
            });
            return;
        }
        const providerName = data[1];
        const provider = this.payments.find((p) => p.provider().branding.name === providerName);

        const order = Order.createDeferred(new Date(), new Reference(null, interaction.user.id, selectedPackage), '');
        const paymentOrder = await provider.createPaymentOrder({
            candidateOrderId: order.id,
            successUrl: new URL('/donate/' + order.id + '?provider=' + provider.provider().branding.name, this.config.app.publicUrl),
            cancelUrl: new URL('/donate/' + order.id + '/cancel?&provider=' + provider.provider().branding.name, this.config.app.publicUrl),
            forPackage: selectedPackage,
            steamId: null,
            discordId: interaction.user.id,
        });
        order.paymentIntent({
            id: paymentOrder.id,
            transactionId: paymentOrder.transactionId,
            provider: provider.provider().branding.name,
        });

        await this.repo.save(order);
        await interaction.update({
            embeds: [this.buildPackageDetails(selectedPackage)],
            content: null,
            components: [{
                type: 1,
                components: [{
                    type: 2,
                    url: (paymentOrder as PaymentOrder & DeferredPaymentOrder).paymentUrl,
                    label: translate('CMD_DONATE_DONATE'),
                    style: ButtonStyle.Link,
                }],
            }],
        });
    }
}

function withPrefix(v: string, p: string): string {
    return `${p}#${v}`;
}

function dropPrefix(v: string): string {
    const values = v.split('#');
    if (values.length === 1) {
        return v;
    }
    return values.splice(1, values.length).join('#');
}
