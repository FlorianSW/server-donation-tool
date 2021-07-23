import {CFToolsClient, CFToolsClientBuilder} from 'cftools-sdk';
import {Client} from 'discord.js';
import {AppConfig, ServerNames} from './domain/app-config';
import {Package, PriceType} from './domain/package';
import {DiscordRolePerk} from './adapter/perk/discord-role-perk';
import {PriorityQueuePerk} from './adapter/perk/priority-queue-perk';
import {Logger} from 'winston';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {DiscordNotification, DiscordNotifier} from './adapter/discord-notifier';
import {FreetextPerk} from './adapter/perk/freetext-perk';
import session, {Store} from 'express-session';
import {StoreFactory} from 'connect-session-knex';
import Knex from 'knex';
import {Environment} from './adapter/paypal-payment';
import settings from './translations';
import {Events, EventSource} from './domain/events';
import {EventQueue} from './adapter/event-queue';

const initSessionStore = require('connect-session-knex');
const sessionStore: StoreFactory = initSessionStore(session);

function isWebUrl(urlAsString: string): boolean {
    try {
        const url = new URL(urlAsString);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

class YamlAppConfig implements AppConfig {
    app: {
        port: number;
        sessionSecret: string;
        sessionStore: {
            filename: string;
        },
        compressResponse: boolean;
        language?: string;
        community: {
            title: string;
            logo: string;
            discord?: string;
        }
    };
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
    paypal: {
        environment: Environment;
        clientId: string;
        clientSecret: string
    };
    serverNames: ServerNames;

    private logger: Logger;
    private _cfToolsClient: CFToolsClient;
    private _discordClient: Client;
    private _notifier: DiscordNotifier | undefined;
    private _eventQueue: Events & EventQueue = new EventQueue();

    cfToolscClient(): CFToolsClient {
        return this._cfToolsClient;
    }

    discordClient(): Promise<Client> {
        if (!this.discord.bot?.token) {
            return Promise.reject('Discord bot not configured');
        }
        return Promise.resolve(this._discordClient);
    }

    eventSource(): EventSource {
        return this._eventQueue;
    }

    async initialize(): Promise<void> {
        this._cfToolsClient = new CFToolsClientBuilder()
            .withCredentials(this.cftools.applicationId, this.cftools.secret)
            .build();
        this.assertValidPackages();
        await this.configureDiscord();

        if (this.app.community?.discord && !this.app.community.discord.startsWith('http')) {
            this.logger.warn('Community Discord link needs to be an absolute URL. This is invalid: ' + this.app.community.discord);
            this.app.community.discord = '';
        }

        if (this.steam !== undefined && (!this.steam.realm || !this.steam.apiKey || !this.steam.redirectUrl)) {
            throw new Error('Not all required configuration for Steam login are set. Refer to the documentation to fix this error.');
        }

        if (this.paypal.environment === undefined) {
            this.logger.warn('PayPal environment not set. Sandbox credentials are assumed, which might not be intended.');
            this.paypal.environment = Environment.SANDBOX;
        }

        if (this.app.language) {
            settings.language = this.app.language;
        }
    }

    async sessionStore(): Promise<Store> {
        this.logger.info('Initializing session store');
        if (!this.app.sessionSecret || this.app.sessionSecret.length === 0) {
            throw new Error('app.sessionSecret can not be an empty string. Choose an individual, random, secure string');
        }
        const knex = Knex({
            client: 'sqlite3',
            connection: {
                filename: this.app.sessionStore.filename,
            },
            useNullAsDefault: true,
        });
        const result = await knex.raw('PRAGMA journal_mode=WAL;');
        const journalMode = result[0]?.journal_mode;
        if (journalMode !== 'wal') {
            this.logger.warn(`Could not set session store's journal mode to WAL, which might decrease performance on multiple concurrent requests. Store runs in mode: ${journalMode}`);
        }
        return new sessionStore({
            knex: knex
        });
    }

    logoUrl(): string {
        if (!this.app.community?.logo) {
            return;
        }
        if (isWebUrl(this.app.community.logo)) {
            return this.app.community.logo;
        }
        return `/assets/custom/${this.app.community?.logo}`;
    }

    destroy(): void {
        if (this._discordClient) {
            this._discordClient.destroy();
        }
    }

    private assertValidPackages() {
        const packageIds = new Set<number>();
        this.packages.forEach((p) => {
            if (p.price.type === undefined) {
                p.price.type = PriceType.FIXED;
            }
            if (p.perks === undefined) {
                p.perks = [];
            }
            if (packageIds.has(p.id)) {
                throw new Error('Package ID ' + p.id + ' is configured multiple times. Each package needs to have a unique ID.');
            }
            packageIds.add(p.id);
        });
    }

    private async configureDiscord() {
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
            this._notifier = new DiscordNotifier(this._eventQueue, this.discord.notifications);
        }
    }
}

function warnYamlNumber(name: string, value: string) {
    return `Found ${name} to be a number (${value}), which is most likely not the same representation as you assume. Please change the config to be a string (wrapped in ').`;
}

export async function parseConfig(logger: Logger): Promise<AppConfig> {
    logger.info('Reading app configuration from config.yml');
    const config = yaml.load(fs.readFileSync('config.yml', 'utf8'));
    const intermediate: YamlAppConfig = Object.assign(new YamlAppConfig(), config, {logger: logger});
    await intermediate.initialize();

    if (typeof intermediate.discord.clientId === 'number') {
        logger.warn(warnYamlNumber('discord client ID', intermediate.discord.clientId));
    }
    if (typeof intermediate.discord.bot.guildId === 'number') {
        logger.warn(warnYamlNumber('discord bot GuildID', intermediate.discord.bot.guildId));
    }
    logger.info('Validating package and perk configuration');
    for (const p of intermediate.packages) {
        Object.setPrototypeOf(p, Package.prototype);
        for (let i = 0; i < p.perks.length; i++) {
            const perk = p.perks[i];

            perk.inPackage = p;
            if (perk.type === 'PRIORITY_QUEUE') {
                p.perks[i] = Object.assign(new PriorityQueuePerk(intermediate.cfToolscClient(), intermediate.serverNames), perk);
            } else if (perk.type === 'DISCORD_ROLE') {
                const discordPerk: DiscordRolePerk = Object.assign(new DiscordRolePerk(await intermediate.discordClient(), intermediate.discord.bot.guildId, logger), perk);
                discordPerk.roles.forEach((r) => {
                    if (typeof r === 'number') {
                        logger.warn(warnYamlNumber(`discord role perk role`, r));
                    }
                });
                await discordPerk.initialize();
                p.perks[i] = discordPerk;
            } else if (perk.type === 'FREETEXT_ONLY') {
                p.perks[i] = Object.assign(new FreetextPerk(), perk);
            } else {
                throw new Error('No available provider can redeem perk: ' + perk.type);
            }
        }
    }

    return intermediate;
}
