import {
    CFToolsClient,
    DuplicateResourceCreation,
    PriorityQueueItem,
    ServerApiId,
    SteamId64,
    TokenExpired
} from 'cftools-sdk';
import {translate, TranslateParams} from '../../translations';
import {Hints, Login, Package, Perk, RedeemError, RedeemTarget, Refundable} from '../../domain/package';
import {ServerNames} from '../../domain/app-config';
import {FailedToLoad, OwnedPerk, PriorityQueue, User} from '../../domain/user';
import {Order} from '../../domain/payment';
import {Logger} from 'winston';
import {createHash} from 'crypto';

export class PriorityQueuePerk implements Perk, Refundable {
    inPackage: Package;
    type: string;

    readonly cftools: {
        serverApiId: string | string[],
    };
    readonly amountInDays?: number;
    readonly permanent = false;
    private fingerprint: string;

    constructor(
        private readonly client: CFToolsClient,
        private readonly serverNames: ServerNames,
        private readonly log: Logger,
    ) {
    }

    async redeem(target: RedeemTarget, order: Order): Promise<TranslateParams> {
        const steamId = SteamId64.of(target.gameId.steam);
        const serverId = this.serverApiId(order);

        const successParams: TranslateParams = ['PRIORITY_QUEUE_REDEEM_COMPLETE', {
            params: {
                until: this.expiration(order).toLocaleString(),
                serverName: this.serverNames[serverId.id],
            }
        }];
        try {
            await this.createPriority(serverId, steamId, order);
        } catch (e) {
            if (e instanceof DuplicateResourceCreation) {
                try {
                    await this.replacePriorityIfOlder(serverId, steamId, order);
                } catch (e) {
                    this.throwRedeemError(serverId, e);
                }
                return successParams;
            }
            this.throwRedeemError(serverId, e);
        }
        return successParams;
    }

    private serverApiId(order: Order): ServerApiId {
        let serverId: ServerApiId;
        if (Array.isArray(this.cftools.serverApiId)) {
            if (!order.perkDetails.has(this.id())) {
                throw new Error('perk ' + this.id() + ' requires further details, but order does not contain them');
            }
            const perkServerId = order.perkDetails.get(this.id());
            if (!this.cftools.serverApiId.some((id) => id === perkServerId)) {
                throw new Error('the priority queue perk ' + this.id() + ' does not have a valid server API ID available for selected ' + perkServerId);
            }
            serverId = ServerApiId.of(perkServerId);
        } else {
            serverId = ServerApiId.of(this.cftools.serverApiId);
        }
        return serverId;
    }

    async refund(forUser: RedeemTarget, order: Order): Promise<void> {
        const steamId = SteamId64.of(forUser.gameId.steam);
        const serverId = this.serverApiId(order);
        const request = {
            serverApiId: serverId,
            playerId: steamId,
        };
        const item = await this.client.getPriorityQueue(request);
        if (!item) {
            return;
        }
        if (item.comment.indexOf(order.payment.transactionId) === -1) {
            return;
        }
        await this.client.deletePriorityQueue(request);
    }

    async ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null> {
        if (!target.gameId.steam) {
            return [];
        }
        try {
            const result: OwnedPerk[] = [];
            if (Array.isArray(this.cftools.serverApiId)) {
                for (let id of this.cftools.serverApiId) {
                    result.push(await this.fetchPriorityQueue(SteamId64.of(target.gameId.steam), ServerApiId.of(id)));
                }
            } else {
                result.push(await this.fetchPriorityQueue(SteamId64.of(target.gameId.steam), ServerApiId.of(this.cftools.serverApiId)));
            }
            return result;
        } catch (e) {
            this.log.error(`Could not request Priority queue information for server API ID: ${this.cftools.serverApiId}. Error: ` + e);
            return [new FailedToLoad()];
        }
    }

    asLongString(context: Order | null): string {
        if (context && context.perkDetails.has(this.id()) && Array.isArray(this.cftools.serverApiId)) {
            return this.longStringForSingle(context.perkDetails.get(this.id()));
        } else if (Array.isArray(this.cftools.serverApiId)) {
            return this.longStringForMulti(this.cftools.serverApiId);
        } else {
            return this.longStringForSingle(this.cftools.serverApiId);
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
            if (Array.isArray(this.cftools.serverApiId)) {
                for (let id of this.cftools.serverApiId) {
                    hash.update(id);
                }
            } else {
                hash.update(this.cftools.serverApiId);
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

    subjects(): Map<string, string> | null {
        if (!Array.isArray(this.cftools.serverApiId)) {
            return null;
        }
        const result = new Map();
        for (let serverId of this.cftools.serverApiId) {
            result.set(serverId, this.serverNames[serverId]);
        }
        return result;
    }

    requiresLogins(): Login[] {
        return ['steam'];
    }

    async interfaceHints(forUser: User): Promise<Hints> {
        return {};
    }

    private async fetchPriorityQueue(steamId: SteamId64, server: ServerApiId): Promise<PriorityQueue> {
        try {
            const entry = await this.client.getPriorityQueue({
                playerId: steamId,
                serverApiId: server,
            });
            if (entry === null || this.isExpired(entry)) {
                return null;
            }
            return new PriorityQueue(this.serverNames[server.id] || server.id, entry.expiration);
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

    private throwRedeemError(serverId: ServerApiId, e: Error) {
        if (e instanceof TokenExpired) {
            this.log.error(e.message, e.info, e);
        }
        throw new RedeemError(['PRIORITY_QUEUE_REDEEM_ERROR', {
            params: {
                serverName: this.serverNames[serverId.id],
                reason: e.message,
            }
        }]);
    }

    private async replacePriorityIfOlder(serverId: ServerApiId, steamId: SteamId64, order: Order): Promise<void> {
        const newExpiration = this.expiration(order);
        const request = {
            serverApiId: serverId,
            playerId: steamId,
        };
        const item = await this.client.getPriorityQueue(request);
        if (!item) {
            return await this.createPriority(serverId, steamId, order);
        }
        if (item.expiration === 'Permanent') {
            return;
        }
        if (newExpiration !== 'Permanent' && item.expiration.getTime() > newExpiration.getTime()) {
            return;
        }
        await this.client.deletePriorityQueue(request);

        return await this.createPriority(serverId, steamId, order);
    }

    private expiration(order: Order): Date | 'Permanent' {
        if (this.permanent) {
            return 'Permanent';
        }
        const expiration = new Date(order.firstRedeemed.valueOf());
        expiration.setDate(order.firstRedeemed.getDate() + this.amountInDays);

        return expiration;
    }

    private async createPriority(serverId: ServerApiId, steamId: SteamId64, order: Order): Promise<void> {
        await this.client.putPriorityQueue({
            serverApiId: serverId,
            id: steamId,
            expires: this.expiration(order),
            comment: `Created by CFTools Server Donation bot.
Order ID: ${order.id}
PayPal Transaction ID: ${order.payment.transactionId}
PayPal Order ID: ${order.payment.id}
Selected product: ${this.inPackage.name}`
        });
    }
}
