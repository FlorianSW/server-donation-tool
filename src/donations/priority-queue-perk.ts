import {CFToolsClient, DuplicateResourceCreation, ServerApiId, SteamId64} from 'cftools-sdk';
import {TranslateParams} from '../translations';
import {Package, Perk, RedeemError} from '../domain/package';
import {ServerNames} from '../domain/app-config';
import {User} from '../domain/user';
import {Order} from '../domain/payment';

export class PriorityQueuePerk implements Perk {
    inPackage: Package;
    type: string;

    readonly cftools: {
        serverApiId: string,
    };
    readonly amountInDays: number;

    constructor(
        private readonly client: CFToolsClient,
        private readonly serverNames: ServerNames,
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
                await this.replacePriorityIfOlder(steamId, order);
                return successParams;
            }
            throw new RedeemError(['PRIORITY_QUEUE_REDEEM_ERROR', {
                params: {
                    serverName: this.serverNames[this.cftools.serverApiId],
                    reason: e.message,
                }
            }]);
        }
        return successParams;
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
        if (item.expiration.getTime() > newExpiration.getTime()) {
            return;
        }
        await this.client.deletePriorityQueue(request);

        return await this.createPriority(steamId, order);
    }

    private expiration(order: Order): Date {
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
PayPal Transaction ID: ${order.transactionId}
PayPal Order ID: ${order.id}
Selected product: ${this.inPackage.name}`
        });
    }
}
