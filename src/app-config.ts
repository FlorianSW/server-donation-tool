import {PriorityQueuePerk} from './donations/priority-queue-perk';
import {CFToolsClient, CFToolsClientBuilder} from 'cftools-sdk';
import {Client} from 'discord.js';
import {DiscordRolePerk} from './donations/discord-role-perk';
import {AppConfig, ServerNames} from './domain/app-config';
import {Package} from './domain/package';

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
        }
    };
    packages: Package[];
    paypal: { clientId: string; clientSecret: string };
    serverNames: ServerNames;

    private _cfToolsClient: CFToolsClient;
    private _discordClient: Client;

    cfToolscClient(): CFToolsClient {
        return this._cfToolsClient;
    }

    discordClient(): Promise<Client> {
        if (!this.discord.bot?.token) {
            return Promise.reject('Discord bot not configured');
        }
        return Promise.resolve(this._discordClient);
    }

    async initialize(): Promise<void> {
        this._cfToolsClient = new CFToolsClientBuilder()
            .withCredentials(this.cftools.applicationId, this.cftools.secret)
            .build();
        const hasDiscordPerk = this.packages.find((p) => p.perks.find((perk) => perk instanceof DiscordRolePerk));

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
                    console.log('Error in discord client occurred', error);
                    reject(error);
                });
                await this._discordClient.login(this.discord.bot.token);
            });
        } else if (hasDiscordPerk) {
            throw new Error('At least one discord perk is configured but no valid discord configuration was found.');
        }
    }

    destroy(): void {
        if (this._discordClient) {
            this._discordClient.destroy();
        }
    }
}

export async function parseConfig(config: Object): Promise<AppConfig> {
    const intermediate = Object.assign(new YamlAppConfig(), config);
    await intermediate.initialize();

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
