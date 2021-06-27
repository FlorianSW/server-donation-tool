import {AppConfig} from '../app-config';
import {NextFunction, Request, Response, Router} from 'express';
import {requireAuthentication} from '../auth';
import {CFToolsClient, PriorityQueueItem, ServerApiId, SteamId64} from 'cftools-sdk';

export class StartController {
    public readonly router: Router = Router();

    constructor(private readonly cftools: CFToolsClient, private readonly config: AppConfig) {
        this.router.get('/', requireAuthentication, this.populatePriorityQueue.bind(this), this.startPage.bind(this));
    }

    private async startPage(req: Request, res: Response) {
        // @ts-ignore
        const availablePerks = this.config.perks.filter((p) => !req.user.priorityQueue[p.cftools.serverApiId].active);
        // @ts-ignore
        const serversWithPrio = Object.entries(req.user.priorityQueue).filter((s: [string, object]) => s[1].active);
        res.render('index', {
            user: req.user,
            serversWithPrio: serversWithPrio,
            availablePerks: availablePerks,
            step: 'PERK_SELECTION',
        });
    }

    private async populatePriorityQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
        // @ts-ignore
        const steamId = SteamId64.of(req.user.steam.id);
        const servers = new Set(this.config.perks.map((p) => p.cftools.serverApiId));

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
        // @ts-ignore
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
