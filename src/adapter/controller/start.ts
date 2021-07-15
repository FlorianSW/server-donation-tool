import {NextFunction, Request, Response, Router} from 'express';
import {requireAuthentication} from '../../auth';
import {PriorityQueueItem, ServerApiId, SteamId64} from 'cftools-sdk';
import {translate} from '../../translations';
import {Guild} from 'discord.js';
import {AppConfig} from '../../domain/app-config';
import {PriorityQueue} from '../../domain/user';
import {Package, Perk, Price, PriceType} from '../../domain/package';
import {PriorityQueuePerk} from '../perk/priority-queue-perk';
import {DiscordRolePerk} from '../perk/discord-role-perk';
import {FreetextPerk} from '../perk/freetext-perk';
import {Logger} from 'winston';

export class StartController {
    public readonly router: Router = Router();

    constructor(private readonly config: AppConfig, private readonly log: Logger) {
        this.router.post('/selectPackage', requireAuthentication, this.selectPackage.bind(this));
        this.router.get('/', requireAuthentication, this.populatePriorityQueue.bind(this), this.populateDiscordRoles.bind(this), this.startPage.bind(this));
    }

    private async startPage(req: Request, res: Response) {
        const serversWithPrio = Object.entries(req.user.priorityQueue).filter((s: [string, PriorityQueue]) => s[1].active);
        const client = await this.config.discordClient();
        const guild = await client.guilds.fetch(this.config.discord.bot.guildId);
        res.render('index', {
            user: req.user,
            serversWithPrio: serversWithPrio,
            availablePackages: this.config.packages,
            step: 'PACKAGE_SELECTION',
            perkToString: this.perkToString.bind(this, guild)
        });
    }

    private perkToString(guild: Guild, p: Perk): string {
        if (p instanceof PriorityQueuePerk) {
            return translate('PERK_PRIORITY_QUEUE_DESCRIPTION', {
                params: {
                    serverName: this.config.serverNames[p.cftools.serverApiId],
                    amountInDays: p.amountInDays.toString(10)
                }
            });
        } else if (p instanceof DiscordRolePerk) {
            return translate('PERK_DISCORD_ROLE_DESCRIPTION', {
                params: {
                    roles: p.roles.map((r) => guild.roles.cache.get(r).name).join(', '),
                }
            });
        } else if (p instanceof FreetextPerk) {
            return p.text;
        }
    }

    private price(req: Request, pack: Package): Price {
        const price = pack.price;
        if (req.body[`price-${pack.id}`]) {
            if (pack.price.type === PriceType.FIXED) {
                throw Error('VariablePriceForFixedPackage');
            } else {
                price.amount = req.body[`price-${pack.id}`].replace(',', '.');
            }
        }
        return price;
    }

    private async selectPackage(req: Request, res: Response) {
        const selectedPackage = this.config.packages.find((p) => p.id === parseInt(req.body.package));
        if (!selectedPackage) {
            res.redirect('/');
        }

        try {
            req.session.selectedPackage = {
                id: selectedPackage.id,
                price: this.price(req, selectedPackage),
            };
            res.redirect('/donate');
        } catch (e) {
            if (e.message === 'VariablePriceForFixedPackage') {
                this.log.warn(`Discord user ${req.user.discord.id} requested variable price for fixed package.`);
                res.redirect('/');
            } else {
                throw e;
            }
        }
    }

    private perks(): Perk[] {
        return this.config.packages.map((p) => p.perks).reduce((l, p) => l.concat(p));
    }

    private async populatePriorityQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
        const steamId = SteamId64.of(req.user.steam.id);
        const servers = new Set(this.perks()
            .filter((p) => p instanceof PriorityQueuePerk)
            .map((p: PriorityQueuePerk) => p.cftools.serverApiId));

        let priority: { [key: string]: any | undefined } = {};
        for (let server of servers) {
            const entry = await this.config.cfToolscClient().getPriorityQueue({
                playerId: steamId,
                serverApiId: ServerApiId.of(server),
            });
            if (entry === null) {
                priority[server] = {
                    active: false,
                };
                continue;
            }
            priority[server] = {
                active: !this.isExpired(entry),
                expires: entry.expiration,
            }
        }
        req.user.priorityQueue = priority;
        next();
    }

    private isExpired(p: PriorityQueueItem): boolean {
        if (p.expiration === 'Permanent') {
            return false;
        }
        return p.expiration.getTime() <= new Date().getTime();
    }

    private async populateDiscordRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
        const client = await this.config.discordClient();
        const guild = await client.guilds.fetch(this.config.discord.bot.guildId);
        const guildMember = await guild.members.fetch(req.user.discord.id);
        const perkRoles = this.perks()
            .filter((p) => p instanceof DiscordRolePerk)
            .map((p) => (p as DiscordRolePerk).roles)
            .reduce((l, p) => l.concat(p));

        req.user.discordRoles = guildMember.roles.cache.filter((r) => perkRoles.includes(r.id)).map((r) => r.name);
        next();
    }
}
