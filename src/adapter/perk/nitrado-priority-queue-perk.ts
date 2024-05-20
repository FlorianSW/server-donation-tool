import {translate, TranslateParams} from '../../translations';
import {Hints, Login, Package, Perk, RedeemError, RedeemTarget, Refundable} from '../../domain/package';
import {ServerNames} from '../../domain/app-config';
import {FailedToLoad, OwnedPerk, PriorityQueue} from '../../domain/user';
import {Order} from '../../domain/payment';
import {Logger} from 'winston';
import {createHash} from 'crypto';
import {NitradoApi} from "../nitrado/api";
import {inject} from "tsyringe";
import {NitradoPriorityPlayerRepository} from "../../domain/repositories";

export class NitradoPriorityQueuePerk implements Perk, Refundable {
    inPackage: Package;
    type: string;

    readonly nitrado: {
        serverId: string | string[],
        kind?: 'playstation' | 'xbox',
    };
    readonly amountInDays?: number;
    readonly permanent = false;
    private fingerprint: string;

    constructor(
        private readonly client: NitradoApi,
        private readonly serverNames: ServerNames,
        @inject("NitradoPriorityPlayerRepository") private readonly repo: NitradoPriorityPlayerRepository,
        private readonly log: Logger,
    ) {
    }

    private gameId(target: RedeemTarget): string | undefined {
        if (this.nitrado.kind === 'xbox') {
            return target.gameId.xbox;
        }
        return target.gameId.playstation;
    }

    async redeem(target: RedeemTarget, order: Order): Promise<TranslateParams> {
        const serverId = this.serverApiId(order);
        const successParams: TranslateParams = ['PRIORITY_QUEUE_REDEEM_COMPLETE', {
            params: {
                until: this.expiration(order).toLocaleString(),
                serverName: this.serverNames[serverId],
            }
        }];
        try {
            await this.createPriority(this.serverApiId(order), this.gameId(target));
        } catch (e) {
            this.throwRedeemError(serverId, e);
        }
        return successParams;
    }

    private serverApiId(order: Order): string {
        if (Array.isArray(this.nitrado.serverId)) {
            if (!order.perkDetails.has(this.id())) {
                throw new Error('perk ' + this.id() + ' requires further details, but order does not contain them');
            }
            const perkServerId = order.perkDetails.get(this.id());
            if (!this.nitrado.serverId.some((id) => id === perkServerId)) {
                throw new Error('the priority queue perk ' + this.id() + ' does not have a valid server API ID available for selected ' + perkServerId);
            }
            return perkServerId;
        } else {
            return this.nitrado.serverId;
        }
    }

    async refund(forUser: RedeemTarget, order: Order): Promise<void> {
        const serverId = this.serverApiId(order);
        const item = await this.client.priorityQueueMembers(serverId);
        if (!item) {
            return;
        }
        await this.client.deletePriorityQueue(serverId, this.gameId(forUser));
    }

    async ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null> {
        const gameId = this.gameId(target);
        if (!gameId) {
            return [];
        }
        try {
            const result: OwnedPerk[] = [];
            if (Array.isArray(this.nitrado.serverId)) {
                for (let id of this.nitrado.serverId) {
                    result.push(await this.fetchPriorityQueue(gameId, id));
                }
            } else {
                result.push(await this.fetchPriorityQueue(gameId, this.nitrado.serverId));
            }
            return result;
        } catch (e) {
            this.log.error(`Could not request Priority queue information for server API ID: ${this.nitrado.serverId}. Error: ` + e);
            return [new FailedToLoad()];
        }
    }

    asLongString(context: Order | null): string {
        if (context && context.perkDetails.has(this.id()) && Array.isArray(this.nitrado.serverId)) {
            return this.longStringForSingle(context.perkDetails.get(this.id()));
        } else if (Array.isArray(this.nitrado.serverId)) {
            return this.longStringForMulti(this.nitrado.serverId);
        } else {
            return this.longStringForSingle(this.nitrado.serverId);
        }
    }

    longStringForSingle(id: string): string {
        if (this.permanent) {
            return translate('PERK_PRIORITY_QUEUE_PERMANENT_DESCRIPTION', {
                params: {
                    serverName: this.serverNames[id],
                }
            });
        }
        return translate('PERK_PRIORITY_QUEUE_DESCRIPTION', {
            params: {
                serverName: this.serverNames[id],
                amountInDays: this.amountInDays.toString(10),
            }
        });
    }

    longStringForMulti(id: string[]): string {
        if (this.permanent) {
            return translate('PERK_PRIORITY_QUEUE_MULTI_PERMANENT_DESCRIPTION', {
                params: {
                    serverNames: id.map((s) => this.serverNames[s]).join(', '),
                }
            });
        }
        return translate('PERK_PRIORITY_QUEUE_MULTI_DESCRIPTION', {
            params: {
                serverNames: id.map((s) => this.serverNames[s]).join(', '),
                amountInDays: this.amountInDays.toString(10),
            }
        });
    }

    asShortString(context: Order | null): string {
        return this.asLongString(context);
    }

    id(): string {
        if (!this.fingerprint) {
            const hash = createHash('sha1');
            hash.update(this.type);
            if (Array.isArray(this.nitrado.serverId)) {
                for (let id of this.nitrado.serverId) {
                    hash.update(id);
                }
            } else {
                hash.update(this.nitrado.serverId);
            }
            if (this.amountInDays) {
                hash.update(this.amountInDays.toString(10));
            } else {
                hash.update(this.permanent ? 'permanent' : 'not-permanent')
            }
            this.fingerprint = hash.digest('hex');
        }
        return this.fingerprint;
    }

    requiresLogins(): Login[] {
        return [this.nitrado.kind || 'playstation'];
    }

    subjects(): Map<string, string> | null {
        if (!Array.isArray(this.nitrado.serverId)) {
            return null;
        }
        const result = new Map();
        for (let serverId of this.nitrado.serverId) {
            result.set(serverId, this.serverNames[serverId]);
        }
        return result;
    }

    async interfaceHints(): Promise<Hints> {
        return {};
    }

    private async fetchPriorityQueue(gameId: string, server: string): Promise<PriorityQueue> {
        try {
            const entry = await this.client.priorityQueueMembers(server);
            if (!entry.includes(gameId)) {
                return null;
            }
            const e = await this.repo.findForPlayer(server, gameId);
            e.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
            return new PriorityQueue(this.serverNames[server], e[0]?.expiresAt || 'Permanent');
        } catch (e) {
            this.log.error(`Could not request Priority queue information for server API ID: ${server}. Error: ` + e);
            throw e;
        }
    }

    private throwRedeemError(serverId: string, e: Error) {
        throw new RedeemError(['PRIORITY_QUEUE_REDEEM_ERROR', {
            params: {
                serverName: this.serverNames[serverId],
                reason: e.message,
            }
        }]);
    }

    private expiration(order: Order): Date | 'Permanent' {
        if (this.permanent) {
            return 'Permanent';
        }
        const expiration = new Date(order.firstRedeemed.valueOf());
        expiration.setDate(order.firstRedeemed.getDate() + this.amountInDays);

        return expiration;
    }

    private async createPriority(serverId: string, steamId: string): Promise<void> {
        await this.client.putPriorityQueue(serverId, steamId);
    }
}
