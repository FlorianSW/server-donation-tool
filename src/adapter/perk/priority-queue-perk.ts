import {
    CFToolsClient,
    DuplicateResourceCreation,
    PriorityQueueItem,
    ServerApiId,
    SteamId64,
    TokenExpired
} from 'cftools-sdk';
import {translate, TranslateParams} from '../../translations';
import {Package, Perk, RedeemError, RedeemTarget} from '../../domain/package';
import {ServerNames} from '../../domain/app-config';
import {FailedToLoad, OwnedPerk, PriorityQueue} from '../../domain/user';
import {Order} from '../../domain/payment';
import {Logger} from 'winston';

export class PriorityQueuePerk implements Perk {
    inPackage: Package;
    type: string;

    readonly cftools: {
        serverApiId: string,
    };
    readonly amountInDays?: number;
    readonly permanent = false;

    constructor(
        private readonly client: CFToolsClient,
        private readonly serverNames: ServerNames,
        private readonly log: Logger,
    ) {
    }

    async redeem(target: RedeemTarget, order: Order): Promise<TranslateParams> {
        const steamId = SteamId64.of(target.steamId)

        const successParams: TranslateParams = ['PRIORITY_QUEUE_REDEEM_COMPLETE', {
            params: {
                until: this.expiration(order).toLocaleString(),
                serverName: this.serverNames[this.cftools.serverApiId],
            }
        }];
        try {
            await this.createPriority(steamId, order);
        } catch (e) {
            if (e instanceof DuplicateResourceCreation) {
                try {
                    await this.replacePriorityIfOlder(steamId, order);
                } catch (e) {
                    this.throwRedeemError(e);
                }
                return successParams;
            }
            this.throwRedeemError(e);
        }
        return successParams;
    }

    async ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null> {
        try {
            return [await this.fetchPriorityQueue(SteamId64.of(target.steamId), ServerApiId.of(this.cftools.serverApiId))];
        } catch(e) {
            this.log.error(`Could not request Priority queue information for server API ID: ${this.cftools.serverApiId}. Error: ` + e);
            return [new FailedToLoad()];
        }
    }

    asTranslatedString(): string {
        if (this.permanent) {
            return translate('PERK_PRIORITY_QUEUE_PERMANENT_DESCRIPTION', {
                params: {
                    serverName: this.serverNames[this.cftools.serverApiId],
                }
            });
        }
        return translate('PERK_PRIORITY_QUEUE_DESCRIPTION', {
            params: {
                serverName: this.serverNames[this.cftools.serverApiId],
                amountInDays: this.amountInDays.toString(10),
            }
        })
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

    private throwRedeemError(e: Error) {
        if (e instanceof TokenExpired) {
            this.log.error(e.message, e.info, e);
        }
        throw new RedeemError(['PRIORITY_QUEUE_REDEEM_ERROR', {
            params: {
                serverName: this.serverNames[this.cftools.serverApiId],
                reason: e.message,
            }
        }]);
    }

    private async replacePriorityIfOlder(steamId: SteamId64, order: Order): Promise<void> {
        const newExpiration = this.expiration(order);
        const request = {
            serverApiId: ServerApiId.of(this.cftools.serverApiId),
            playerId: steamId,
        };
        const item = await this.client.getPriorityQueue(request);
        if (!item) {
            return await this.createPriority(steamId, order);
        }
        if (item.expiration === 'Permanent') {
            return;
        }
        if (newExpiration !== 'Permanent' && item.expiration.getTime() > newExpiration.getTime()) {
            return;
        }
        await this.client.deletePriorityQueue(request);

        return await this.createPriority(steamId, order);
    }

    private expiration(order: Order): Date | 'Permanent' {
        if (this.permanent) {
            return 'Permanent';
        }
        const expiration = new Date(order.redeemedAt.valueOf());
        expiration.setDate(order.redeemedAt.getDate() + this.amountInDays);

        return expiration;
    }

    private async createPriority(steamId: SteamId64, order: Order): Promise<void> {
        await this.client.putPriorityQueue({
            serverApiId: ServerApiId.of(this.cftools.serverApiId),
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
