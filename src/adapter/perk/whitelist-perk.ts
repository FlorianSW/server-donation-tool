import {CFToolsClient, DuplicateResourceCreation, ServerApiId, SteamId64} from 'cftools-sdk';
import {translate, TranslateParams} from '../../translations';
import {Package, Perk, RedeemError, RedeemTarget} from '../../domain/package';
import {ServerNames} from '../../domain/app-config';
import {User} from '../../domain/user';
import {Order} from '../../domain/payment';

export class WhitelistPerk implements Perk {
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
        const expiration = new Date(order.created.valueOf());
        expiration.setDate(order.created.getDate() + this.amountInDays);

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

    asTranslatedString(): string {
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
        })
    }
}
