import {CFToolsClient, DuplicateResourceCreation, ServerApiId, SteamId64, TokenExpired} from 'cftools-sdk';
import {translate, TranslateParams} from '../../translations';
import {Package, Perk, RedeemError} from '../../domain/package';
import {ServerNames} from '../../domain/app-config';
import {User} from '../../domain/user';
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

    async redeem(forUser: User, order: Order): Promise<TranslateParams> {
        const steamId = SteamId64.of(forUser.steam.id)

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
        const expiration = new Date(order.created.valueOf());
        expiration.setDate(order.created.getDate() + this.amountInDays);

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
}
