import {NextFunction, Request, Response, Router} from 'express';
import {requireAuthentication} from '../auth';
import {CFToolsClient, PriorityQueueItem, ServerApiId, SteamId64} from 'cftools-sdk';
import {translate} from '../translations';
import {AppConfig, Perk, PriorityQueue} from '../domain';
import {PriorityQueuePerk} from '../donations/priority-queue-perk';

export class StartController {
    public readonly router: Router = Router();

    constructor(private readonly cftools: CFToolsClient, private readonly config: AppConfig) {
        this.router.get('/missingSteamConnection', requireAuthentication, this.missingSteamConnection.bind(this));
        this.router.post('/selectPackage', requireAuthentication, this.selectPackage.bind(this));
        this.router.get('/', requireAuthentication, this.populatePriorityQueue.bind(this), this.startPage.bind(this));
    }

    private async startPage(req: Request, res: Response) {
        const serversWithPrio = Object.entries(req.user.priorityQueue).filter((s: [string, PriorityQueue]) => s[1].active);
        res.render('index', {
            user: req.user,
            serversWithPrio: serversWithPrio,
            availablePackages: this.config.packages,
            step: 'PACKAGE_SELECTION',
            perkToString: this.perkToString.bind(this)
        });
    }

    private perkToString(p: Perk): string {
        if (p instanceof PriorityQueuePerk) {
            return translate('PERK_PRIORITY_QUEUE_DESCRIPTION', {
                params: {
                    serverName: this.config.serverNames[p.cftools.serverApiId],
                    amountInDays: p.amountInDays.toString(10)
                }
            })
        }
    }

    private async selectPackage(req: Request, res: Response) {
        const selectedPackage = this.config.packages.find((p) => p.id === parseInt(req.body.package));
        if (selectedPackage) {
            req.session.selectedPackageId = selectedPackage.id;
            res.redirect('/donate');
        } else {
            res.redirect('/');
        }
    }

    private perks(): Perk[] {
        return this.config.packages.map((p) => p.perks).reduce((l, p) => l.concat(p));
    }

    private async missingSteamConnection(req: Request, res: Response) {
        res.render('missing_steam_connection');
    }

    private async populatePriorityQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
        const steamId = SteamId64.of(req.user.steam.id);
        const servers = new Set(this.perks()
            .filter((p) => p instanceof PriorityQueuePerk)
            .map((p: PriorityQueuePerk) => p.cftools.serverApiId));

        let priority: { [key: string]: any | undefined } = {};
        for (let server of servers) {
            const entry = await this.cftools.getPriorityQueue({
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
}
