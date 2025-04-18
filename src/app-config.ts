import {CFToolsClientBuilder} from 'cftools-sdk';
import {Client, GatewayIntentBits} from 'discord.js';
import {AppConfig, LbAgPgServer, ServerNames} from './domain/app-config';
import {Package, PriceType} from './domain/package';
import {DiscordRolePerk} from './adapter/perk/discord-role-perk';
import {PriorityQueuePerk} from './adapter/perk/priority-queue-perk';
import {Logger} from 'winston';
import * as fs from 'fs';
import {PathLike} from 'fs';
import * as yaml from 'js-yaml';
import {DiscordNotification, DiscordNotifier} from './adapter/discord/discord-notifier';
import {FreetextPerk} from './adapter/perk/freetext-perk';
import session from 'express-session';
import {Knex, knex} from 'knex';
import {Environment} from './adapter/paypal/paypal-payment';
import settings from './translations';
import {DiscordRoleRecorder} from './service/discord-role-recorder';
import {ExpireDiscordRole} from './service/expire-discord-role';
import {container, instanceCachingFactory} from 'tsyringe';
import {DiscordDonationTarget} from './adapter/discord/discord-donation-target';
import {CleanupOrder} from './service/cleanup-order';
import {WhitelistPerk} from './adapter/perk/whitelist-perk';
import {DiscordUserNotifier} from './adapter/discord/discord-user-notifier';
import {ReservedSlotPerk} from './adapter/perk/reserved-slot';
import {LbMasterAdvancedGroupPrefixGroupPerk} from './adapter/perk/lb-ag-pg-perk';
import {NoOpVats, VATStack} from './adapter/vat_stack';
import {NitradoPriorityQueuePerk} from "./adapter/perk/nitrado-priority-queue-perk";
import {NitradoApi, NoopNitradoApi} from "./adapter/nitrado/api";
import {ExpireNitradoPriority} from "./service/expire-nitrado-priority";
import {NitradoPriorityRecorder} from "./service/nitrado-priority-recorder";

const initSessionStore = require('connect-session-knex');
const sessionStore = initSessionStore(session);

function isWebUrl(urlAsString: string): boolean {
    try {
        const url = new URL(urlAsString);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

async function enableSqLiteWal(knex: Knex, log: Logger): Promise<void> {
    const result = await knex.raw('PRAGMA journal_mode=WAL;');
    const journalMode = result[0]?.journal_mode;
    if (journalMode !== 'wal') {
        log.warn(`Could not set journal mode to WAL, which might decrease performance on multiple concurrent requests. Store runs in mode: ${journalMode}`);
    }
}

class YamlAppConfig implements AppConfig {
    app: {
        port: number;
        publicUrl: URL;
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
            donationTarget?: {
                discordChannelId: string;
                monthly?: number;
            };
        };
        googleAnalytics?: {
            trackingId: string;
        };
        privacyPolicy: {
            partials: PathLike[];
        };
        orders: {
            redeemCooldownHours: number;
        };
    };
    cftools: { applicationId: string; secret: string };
    nitrado?: { token: string, expirePriorityEvery?: number };
    lb_ag_pg: { [serverId: string]: LbAgPgServer };
    discord: {
        clientId: string;
        clientSecret: string;
        redirectUrl: string;
        bot?: {
            token: string,
            guildId: string,
            expireRolesEvery?: number,
        },
        notifications?: DiscordNotification[],
        commands?: {
            donate?: {
                disabled: boolean;
                guildId: string;
            }
        },
        roleMapping: {
            auditor: string[];
        },
    };
    vats?: {
        enabled: boolean;
        vatStack?: {
            publicKey: string;
        };
    };
    steam?: {
        apiKey: string;
        redirectUrl: string;
        realm: string;
    };
    battlemetrics?: {
        access_token: string;
    };
    packages: Package[];
    paypal: {
        environment: Environment;
        clientId: string;
        clientSecret: string;
        manageWebhook: boolean;
    };
    stripe?: {
        secretKey: string;
        manageWebhook: boolean;
    };
    serverNames: ServerNames;
    packageCategories: string[];

    private logger: Logger;

    async initialize(): Promise<void> {
        container.registerInstance('CFToolsClient', new CFToolsClientBuilder()
            .withCredentials(this.cftools.applicationId, this.cftools.secret)
            .withCache()
            .build());
        container.register('DonationsDB', {
            useFactory: instanceCachingFactory((c) => {
                const client = knex({
                    client: 'sqlite3',
                    connection: {
                        filename: './db/donations.sqlite',
                    },
                    useNullAsDefault: true,
                });
                enableSqLiteWal(client, c.resolve('Logger'));
                return client;
            })
        });
        if (this.nitrado?.token) {
            container.registerInstance('NitradoApi', new NitradoApi(this.nitrado.token));
        } else {
            container.registerInstance('NitradoApi', new NoopNitradoApi());
        }

        this.assertValidPackages();
        await this.configureSessionStore();
        await this.configureDiscord();
        await this.configureVats();
        await this.configureExpiringDiscordRoles();
        await this.configureExpiringNitradoPlayers();
        await this.configureOrders();
        container.resolve(DiscordDonationTarget);

        if (this.app.community?.discord && !this.app.community.discord.startsWith('http')) {
            this.logger.warn('Community Discord link needs to be an absolute URL. This is invalid: ' + this.app.community.discord);
            this.app.community.discord = '';
        }

        if (this.steam !== undefined && (!this.steam.realm || !this.steam.apiKey || !this.steam.redirectUrl)) {
            throw new Error('Not all required configuration for Steam login are set. Refer to the documentation to fix this error.');
        }

        if (this.paypal) {
            if (this.paypal.environment === undefined) {
                this.logger.warn('PayPal environment not set. Sandbox credentials are assumed, which might not be intended.');
                this.paypal.environment = Environment.SANDBOX;
            }
            if (this.paypal.manageWebhook === undefined) {
                this.paypal.manageWebhook = true;
            }
        }

        if (this.app.language) {
            settings.language = this.app.language;
        }
        if (!this.packageCategories) {
            this.packageCategories = [];
        }
        if (!this.app.privacyPolicy?.partials) {
            this.app.privacyPolicy = {
                partials: [
                    './document-partials/privacy-policy/intro.txt',
                    './document-partials/privacy-policy/server-logs.txt',
                    './document-partials/privacy-policy/cookies.txt',
                    './document-partials/privacy-policy/cftools.txt',
                    './document-partials/privacy-policy/personal-data.txt',
                ]
            }
            if (this.app.googleAnalytics?.trackingId) {
                this.app.privacyPolicy.partials.push('./document-partials/privacy-policy/google-analytics.txt');
            }
            if (this.paypal) {
                this.app.privacyPolicy.partials.push('./document-partials/privacy-policy/paypal.txt');
            }
            if (this.stripe) {
                this.app.privacyPolicy.partials.push('./document-partials/privacy-policy/stripe.txt');
            }
        }
        this.app.publicUrl = new URL(this.discord.redirectUrl.replace('/auth/discord/callback', ''));
        if (!this.app.orders || !this.app.orders.redeemCooldownHours) {
            this.app.orders = {
                redeemCooldownHours: 1,
            };
        }
    }

    logoUrl(absolute?: boolean): string {
        if (!this.app.community?.logo) {
            return;
        }
        if (isWebUrl(this.app.community.logo)) {
            return this.app.community.logo;
        }
        if (absolute) {
            const logoUrl = new URL(`/assets/custom/${this.app.community?.logo}`, this.app.publicUrl);
            return logoUrl.toString();
        }
        return `/assets/custom/${this.app.community?.logo}`;
    }

    private async configureSessionStore(): Promise<void> {
        this.logger.info('Initializing session store');
        if (!this.app.sessionSecret || this.app.sessionSecret.length === 0) {
            throw new Error('app.sessionSecret can not be an empty string. Choose an individual, random, secure string');
        }
        const client = knex({
            client: 'sqlite3',
            connection: {
                filename: this.app.sessionStore.filename,
            },
            useNullAsDefault: true,
        });
        await enableSqLiteWal(client, this.logger);
        container.registerInstance('sessionStore', new sessionStore({
            knex: client
        }));
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
            const client = new Client({
                intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
            });
            await new Promise(async (resolve, reject) => {
                client.on('ready', () => {
                    resolve(undefined);
                });
                client.on('error', (error) => {
                    this.logger.error('Error in discord client occurred', error);
                    reject(error);
                });
                await client.login(this.discord.bot.token);
            });
            container.registerInstance('discord.Client', client);
            container.registerInstance('Closeable', {
                close: () => client.destroy()
            });
        } else if (hasDiscordPerk) {
            throw new Error('At least one discord perk is configured but no valid discord configuration was found.');
        }

        if (this.discord.notifications && this.discord.notifications.length !== 0) {
            container.resolve(DiscordNotifier);
        }
        container.resolve(DiscordUserNotifier);
    }

    private async configureVats() {
        if (this.vats?.enabled === true && this.vats.vatStack?.publicKey !== undefined) {
            container.registerSingleton('VATs', VATStack);
        } else {
            container.registerSingleton('VATs', NoOpVats);
        }
    }

    private async configureExpiringDiscordRoles(): Promise<void> {
        container.register('discord.guildId', {
            useValue: this.discord.bot.guildId,
        });
        container.register('discord.runEvery', {
            useValue: this.discord.bot.expireRolesEvery || 60 * 60 * 1000,
        });
        container.resolve(DiscordRoleRecorder);
        container.resolve(ExpireDiscordRole);
    }

    private async configureExpiringNitradoPlayers(): Promise<void> {
        container.register('nitrado.runEvery', {
            useValue: this.nitrado?.expirePriorityEvery || 60 * 60 * 1000,
        });
        container.resolve(NitradoPriorityRecorder);
        container.resolve(ExpireNitradoPriority);
    }

    private async configureOrders(): Promise<void> {
        container.register('packages', {
            useValue: this.packages,
        });
        container.register('availablePackages', {
            useValue: this.packages.filter((p) => !p.disabled),
        });
        container.resolve(CleanupOrder);
    }
}

function warnYamlNumber(name: string, value: string) {
    return `Found ${name} to be a number (${value}), which is most likely not the same representation as you assume. Please change the config to be a string (wrapped in ').`;
}

export async function parseConfig(logger: Logger): Promise<AppConfig> {
    logger.info('Reading app configuration from config.yml');
    const config = yaml.load(fs.readFileSync('config.yml', 'utf8'));
    const intermediate: YamlAppConfig = Object.assign(new YamlAppConfig(), config, {logger: logger});
    container.registerInstance('AppConfig', intermediate);
    await intermediate.initialize();

    if (typeof intermediate.discord.clientId === 'number') {
        logger.warn(warnYamlNumber('discord client ID', intermediate.discord.clientId));
    }
    if (typeof intermediate.discord.bot.guildId === 'number') {
        logger.warn(warnYamlNumber('discord bot GuildID', intermediate.discord.bot.guildId));
    }
    if (typeof intermediate.discord.roleMapping?.auditor === 'string') {
        intermediate.discord.roleMapping.auditor = [intermediate.discord.roleMapping.auditor];
    }
    if (intermediate.app.orders.redeemCooldownHours < 1 || intermediate.app.orders.redeemCooldownHours % 1 !== 0) {
        throw new Error('orders.redeemCooldownHours need to be a positive number greater than 1.')
    }
    logger.info('Validating package and perk configuration');
    for (const p of intermediate.packages) {
        Object.setPrototypeOf(p, Package.prototype);
        for (let i = 0; i < p.perks.length; i++) {
            const perk = p.perks[i];

            perk.inPackage = p;
            if (perk.type === 'PRIORITY_QUEUE') {
                p.perks[i] = Object.assign(new PriorityQueuePerk(container.resolve('CFToolsClient'), intermediate.serverNames, logger), perk);
            } else if (perk.type === 'NITRADO_PRIORITY_QUEUE') {
                p.perks[i] = Object.assign(new NitradoPriorityQueuePerk(container.resolve('NitradoApi'), intermediate.serverNames, container.resolve('NitradoPriorityPlayerRepository'), logger), perk);
            } else if (perk.type === 'DISCORD_ROLE') {
                const discordPerk: DiscordRolePerk = Object.assign(new DiscordRolePerk(container.resolve('discord.Client'), intermediate.discord.bot.guildId, logger), perk);
                discordPerk.roles.forEach((r) => {
                    if (typeof r === 'number') {
                        logger.warn(warnYamlNumber(`discord role perk role`, r));
                    }
                });
                await discordPerk.initialize();
                p.perks[i] = discordPerk;
            } else if (perk.type === 'FREETEXT_ONLY') {
                p.perks[i] = Object.assign(new FreetextPerk(), perk);
            } else if (perk.type === 'WHITELIST') {
                p.perks[i] = Object.assign(new WhitelistPerk(container.resolve('CFToolsClient'), intermediate.serverNames, logger), perk);
            } else if (perk.type === 'RESERVED_SLOT') {
                p.perks[i] = Object.assign(new ReservedSlotPerk(intermediate.serverNames, intermediate), perk);
            } else if (perk.type === 'LB_AG_PG') {
                p.perks[i] = Object.assign(new LbMasterAdvancedGroupPrefixGroupPerk(logger, intermediate), perk);
            } else {
                throw new Error('No available provider can redeem perk: ' + perk.type);
            }
        }
    }

    return intermediate;
}
