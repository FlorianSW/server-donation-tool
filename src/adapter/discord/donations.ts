import {inject, singleton} from 'tsyringe';
import {promisify} from 'util';
import fs from 'fs';
import {Logger} from 'winston';
import {
    ButtonInteraction,
    Client,
    CommandInteraction,
    Interaction,
    MessageSelectOptionData,
    SelectMenuInteraction
} from 'discord.js';
import {AppConfig} from '../../domain/app-config';
import {translate} from '../../translations';
import {Package} from '../../domain/package';

const fileExists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const rmFile = promisify(fs.rm);
const mkdir = promisify(fs.mkdir);

const configPath = './db/config/discord/';
const configFile = 'donation_command';

const PACKAGE_SELECTION = 'packageSelection';
const SELECT_PACKAGE = 'selectPackage';

@singleton()
export class Donations {
    private appCommandId: string;

    constructor(
        @inject('discord.Client') private readonly client: Client,
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('availablePackages') private readonly packages: Package[],
        @inject('Logger') private readonly logger: Logger,
    ) {
        const disabled = !!this.config.discord.commands?.donate.disabled;
        fileExists(configPath + configFile).then(async (exists) => {
            try {
                await mkdir(configPath, {recursive: true});
                if (exists) {
                    this.appCommandId = (await readFile(configPath + configFile)).toString('utf-8');
                    if (disabled) {
                        await this.deleteAppCommand(this.appCommandId, this.config.discord.commands.donate.guildId);
                        await rmFile(configPath + configFile);
                    }
                } else if (disabled) {
                    logger.debug('Donate command not configured, ignoring setup.');
                } else {
                    this.appCommandId = await this.createAppCommand();
                    await writeFile(configPath + configFile, this.appCommandId);
                }
            } catch (e) {
                logger.error('Unknown error while managing Discord app command.', e);
                process.exit(1);
            }
        });

        this.client.on('interactionCreate', this.onInteractionCreate.bind(this));
    }

    private async createAppCommand(): Promise<string> {
        const cmd = await this.client.application.commands.create({
            name: translate('CMD_DONATE_NAME'),
            description: translate('CMD_DONATE_DESCRIPTION'),
            type: 'CHAT_INPUT',
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
        } else {
            console.log(interaction);
            this.logger.error('Received unknown interaction', interaction);
        }
    }

    private async onDonateCommand(interaction: CommandInteraction | ButtonInteraction): Promise<void> {
        const options: MessageSelectOptionData[] = this.packages.map((p) => {
            return {
                label: p.name,
                description: `${p.description} (${p.price.currency} ${p.price.amount})`,
                value: p.id.toString(10),
            };
        });

        const payload = {
            ephemeral: true,
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
        };
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
                content: translate('CMD_DONATE_PACKAGE_DOES_NOT_EXIST_LABEL'),
                components: [{
                    type: 1,
                    components: [{
                        type: 2,
                        label: translate('CMD_DONATE_START_OVER'),
                        customId: PACKAGE_SELECTION,
                        style: 'PRIMARY',
                    }],
                }],
            });
        }

        await interaction.update({
            content: translate('CMD_DONATE_PACKAGE_DETAILS', {
                params: {
                    name: selectedPackage.name,
                    perks: selectedPackage.perks.map((p) => '* ' + p.asShortString()).join('\n'),
                    currency: selectedPackage.price.currency,
                    amount: selectedPackage.price.amount,
                }
            }),
            components: [{
                type: 1,
                components: [{
                    type: 2,
                    label: translate('CMD_DONATE_DONATE'),
                    style: 1,
                    customId: 'donate',
                }, {
                    type: 2,
                    label: translate('CMD_DONATE_SELECT_ANOTHER'),
                    customId: PACKAGE_SELECTION,
                    style: 'PRIMARY',
                }],
            }],
        });
    }
}
