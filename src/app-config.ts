import {CFToolsClient, CFToolsClientBuilder} from 'cftools-sdk';
import {Client} from 'discord.js';
import {AppConfig, ServerNames} from './domain/app-config';
import {Package} from './domain/package';
import {DiscordRolePerk} from './adapter/perk/discord-role-perk';
import {PriorityQueuePerk} from './adapter/perk/priority-queue-perk';
import {Logger} from 'winston';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {DiscordNotification, DiscordNotifier} from './adapter/discord-notifier';
import {NoopNotifier} from './adapter/noop-notifier';
import {Notifier} from './domain/notifier';

class YamlAppConfig implements AppConfig {
    app: { port: number; sessionSecret: string; community: { title: string; logo: string } };
    cftools: { applicationId: string; secret: string };
    discord: {
        clientId: string;
        clientSecret: string;
        redirectUrl: string;
        bot?: {
            token: string,
            guildId: string,
        },
        notifications?: DiscordNotification[]
    };
    steam?: {
        apiKey: string;
        redirectUrl: string;
        realm: string;
    };
    packages: Package[];
    paypal: { clientId: string; clientSecret: string };
    serverNames: ServerNames;

    private logger: Logger;
    private _cfToolsClient: CFToolsClient;
    private _discordClient: Client;
    private _notifier: Notifier;

    cfToolscClient(): CFToolsClient {
        return this._cfToolsClient;
    }

    discordClient(): Promise<Client> {
        if (!this.discord.bot?.token) {
            return Promise.reject('Discord bot not configured');
        }
        return Promise.resolve(this._discordClient);
    }

    notifier(): Notifier {
        return this._notifier;
    }

    async initialize(): Promise<void> {
        this._cfToolsClient = new CFToolsClientBuilder()
            .withCredentials(this.cftools.applicationId, this.cftools.secret)
            .build();
        const hasDiscordPerk = this.packages.find((p) => p.perks.find((perk) => perk.type === 'DISCORD_ROLE'));

        if (this.discord.bot?.token) {
            this._discordClient = new Client({
                ws: {
                    intents: ['GUILD_MEMBERS', 'GUILDS']
                }
            });
            await new Promise(async (resolve, reject) => {
                this._discordClient.on('ready', () => {
                    resolve(undefined);
                });
                this._discordClient.on('error', (error) => {
                    this.logger.error('Error in discord client occurred', error);
                    reject(error);
                });
                await this._discordClient.login(this.discord.bot.token);
            });
        } else if (hasDiscordPerk) {
            throw new Error('At least one discord perk is configured but no valid discord configuration was found.');
        }
        if (this.discord.notifications && this.discord.notifications.length !== 0) {
            this._notifier = new DiscordNotifier(this.discord.notifications);
        } else {
            this._notifier = new NoopNotifier();
        }
    }

    destroy(): void {
        if (this._discordClient) {
            this._discordClient.destroy();
        }
    }
}

export async function parseConfig(logger: Logger): Promise<AppConfig> {
    logger.info('Reading app configuration from config.yml');
    const config = yaml.load(fs.readFileSync('config.yml', 'utf8'));
    const intermediate: YamlAppConfig = Object.assign(new YamlAppConfig(), config, {logger: logger});
    await intermediate.initialize();

    logger.info('Validating package and perk configuration');
    for (const p of intermediate.packages) {
        Object.setPrototypeOf(p, Package.prototype);
        for (let i = 0; i < p.perks.length; i++) {
            const perk = p.perks[i];

            perk.inPackage = p;
            if (perk.type === 'PRIORITY_QUEUE') {
                p.perks[i] = Object.assign(new PriorityQueuePerk(intermediate.cfToolscClient(), intermediate.serverNames), perk);
            } else if (perk.type === 'DISCORD_ROLE') {
                p.perks[i] = Object.assign(new DiscordRolePerk(await intermediate.discordClient(), intermediate.discord.bot.guildId), perk)
            } else {
                throw new Error('No available provider can redeem perk: ' + perk.type);
            }
        }
    }

    return intermediate;
}
