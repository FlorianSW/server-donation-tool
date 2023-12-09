import {CFToolsClient, DuplicateResourceCreation, PriorityQueueItem, ServerApiId, SteamId64} from 'cftools-sdk';
import {translate, TranslateParams} from '../../translations';
import {Hints, Package, Perk, RedeemError, RedeemTarget, Refundable} from '../../domain/package';
import {ServerNames} from '../../domain/app-config';
import {FailedToLoad, OwnedPerk, User, Whitelist} from '../../domain/user';
import {Order} from '../../domain/payment';
import {Logger} from 'winston';
import {createHash} from 'crypto';

export class WhitelistPerk implements Perk, Refundable {
    inPackage: Package;
    type: string;

    readonly cftools: {
        serverApiId: string,
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
        const steamId = SteamId64.of(target.steamId)

        const successParams: TranslateParams = ['WHITELIST_REDEEM_COMPLETE', {
            params: {
                until: this.expiration(order).toLocaleString(),
                serverName: this.serverNames[this.cftools.serverApiId],
            }
        }];
        try {
            await this.createWhitelist(steamId, order);
        } catch (e) {
            if (e instanceof DuplicateResourceCreation) {
                try {
                    await this.replaceWhitelistIfOlder(steamId, order);
                } catch (e) {
                    this.throwRedeemError(e);
                }
                return successParams;
            }
            this.throwRedeemError(e);
        }
        return successParams;
    }

    async refund(forUser: RedeemTarget, order: Order): Promise<void> {
        const steamId = SteamId64.of(forUser.steamId);
        const request = {
            serverApiId: ServerApiId.of(this.cftools.serverApiId),
            playerId: steamId,
        };
        const item = await this.client.getWhitelist(request);
        if (!item) {
            return;
        }
        if (item.comment.indexOf(order.payment.transactionId) === -1) {
            return;
        }
        await this.client.deleteWhitelist(request);
    }

    async ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null> {
        try {
            return [await this.fetchWhitelist(SteamId64.of(target.steamId), ServerApiId.of(this.cftools.serverApiId))];
        } catch (e) {
            this.log.error(`Could not request Whitelist entry information for server API ID: ${this.cftools.serverApiId}. Error: ` + e);
            return [new FailedToLoad()];
        }
    }

    asLongString(): string {
        if (this.permanent) {
            return translate('PERK_WHITELIST_PERMANENT_DESCRIPTION', {
                params: {
                    serverName: this.serverNames[this.cftools.serverApiId],
                }
            });
        }
        return translate('PERK_WHITELIST_DESCRIPTION', {
            params: {
                serverName: this.serverNames[this.cftools.serverApiId],
                amountInDays: this.amountInDays.toString(10),
            }
        });
    }

    asShortString(): string {
        return this.asLongString();
    }

    subjects(): Map<string, string> | null {
        return null;
    }

    async interfaceHints(forUser: User): Promise<Hints> {
        return {};
    }

    id(): string {
        if (!this.fingerprint) {
            const hash = createHash('sha1');
            hash.update(this.type);
            hash.update(this.cftools.serverApiId);
            if (this.amountInDays) {
                hash.update(this.amountInDays.toString(10));
            } else {
                hash.update(this.permanent ? 'permanent' : 'not-permanent')
            }
            this.fingerprint = hash.digest('hex');
        }
        return this.fingerprint
    }

    private async fetchWhitelist(steamId: SteamId64, server: ServerApiId): Promise<Whitelist> {
        try {
            const entry = await this.client.getWhitelist({
                playerId: steamId,
                serverApiId: server,
            });
            if (entry === null || this.isExpired(entry)) {
                return null;
            }
            return new Whitelist(this.serverNames[server.id] || server.id, entry.expiration);
        } catch (e) {
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
        throw new RedeemError(['WHITELIST_REDEEM_ERROR', {
            params: {
                serverName: this.serverNames[this.cftools.serverApiId],
                reason: e.message,
            }
        }]);
    }

    private async replaceWhitelistIfOlder(steamId: SteamId64, order: Order): Promise<void> {
        const newExpiration = this.expiration(order);
        const request = {
            serverApiId: ServerApiId.of(this.cftools.serverApiId),
            playerId: steamId,
        };
        const item = await this.client.getWhitelist(request);
        if (!item) {
            return await this.createWhitelist(steamId, order);
        }
        if (item.expiration === 'Permanent') {
            return;
        }
        if (newExpiration !== 'Permanent' && item.expiration.getTime() > newExpiration.getTime()) {
            return;
        }
        await this.client.deleteWhitelist(request);

        return await this.createWhitelist(steamId, order);
    }

    private expiration(order: Order): Date | 'Permanent' {
        if (this.permanent) {
            return 'Permanent';
        }
        const expiration = new Date(order.firstRedeemed.valueOf());
        expiration.setDate(order.firstRedeemed.getDate() + this.amountInDays);

        return expiration;
    }

    private async createWhitelist(steamId: SteamId64, order: Order): Promise<void> {
        await this.client.putWhitelist({
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
