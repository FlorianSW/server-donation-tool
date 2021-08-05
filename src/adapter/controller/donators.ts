import {requireAuthentication} from '../../auth';
import {Request, Response, Router} from 'express';
import {Package, Perk} from '../../domain/package';
import {AppConfig} from '../../domain/app-config';
import {Logger} from 'winston';
import {DiscordRole, FailedToLoad, OwnedPerk, PriorityQueue} from '../../domain/user';
import {PriorityQueuePerk} from '../perk/priority-queue-perk';
import {CFToolsClient, PriorityQueueItem, ServerApiId, SteamId64} from 'cftools-sdk';
import {Client, Constants, DiscordAPIError} from 'discord.js';
import {DiscordRolePerk} from '../perk/discord-role-perk';
import {inject, singleton} from 'tsyringe';

@singleton()
export class DonatorsController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('packages') private readonly packages: Package[],
        @inject('CFToolsClient') private readonly cftoolsClient: CFToolsClient,
        @inject('discord.Client') private readonly discordClient: Client,
        @inject('Logger') private readonly log: Logger
    ) {
        this.router.get('/api/donators/@me/perks', requireAuthentication, this.listOwnedPerks.bind(this));
    }

    private perks(type: any): Perk[] {
        return this.packages.map((p) => p.perks).reduce((l, p) => l.concat(p)).filter((p) => p instanceof type);
    }

    private async fetchPriorityQueue(req: Request, server: string): Promise<PriorityQueue> {
        try {
            const entry = await this.cftoolsClient.getPriorityQueue({
                playerId: SteamId64.of(req.user.steam.id),
                serverApiId: ServerApiId.of(server),
            });
            if (entry === null || this.isExpired(entry)) {
                return null;
            }
            return new PriorityQueue(this.config.serverNames[server] || server, entry.expiration);
        } catch (e) {
            this.log.error(`Could not request Priority queue information for server API ID: ${server}. Error: ` + e);
            throw e;
        }
    }

    private isExpired(p: PriorityQueueItem): boolean {
        if (p.expiration === 'Permanent') {
            return false;
        }
        return p.expiration.getTime() <= new Date().getTime();
    }

    private async listOwnedPerks(req: Request, res: Response): Promise<void> {
        const servers = [...new Set(this.perks(PriorityQueuePerk)
            .map((p: PriorityQueuePerk) => p.cftools.serverApiId)
        )];
        const priorityQueue: OwnedPerk[] = (await Promise.all(
            servers.map(async (server) => {
                try {
                    return await this.fetchPriorityQueue(req, server)
                } catch (e) {
                    return new FailedToLoad();
                }
            })
        )).filter((p) => !!p);

        const guild = await this.discordClient.guilds.fetch(this.config.discord.bot.guildId);
        let guildMember;
        try {
            guildMember = await guild.members.fetch(req.user.discord.id);
        } catch (e) {
            if (e instanceof DiscordAPIError && e.code === Constants.APIErrors.UNKNOWN_MEMBER && this.config.app.community?.discord) {
                res.redirect(this.config.app.community.discord);
                return;
            }
            throw e;
        }

        const perkRoles = this.perks(DiscordRolePerk)
            .map((p) => (p as DiscordRolePerk).roles)
            .reduce((l, p) => l.concat(p));
        const discordRoles = guildMember.roles.cache
            .filter((r) => perkRoles.includes(r.id))
            .map((r) => new DiscordRole(r.name));

        res.status(200).json([...priorityQueue, ...discordRoles].map((p: OwnedPerk) => {
            return {
                type: p.type,
                text: p.asString(),
            }
        }));
    }
}
