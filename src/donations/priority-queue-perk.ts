import {CFToolsClient, DuplicateResourceCreation, ServerApiId, SteamId64} from 'cftools-sdk';
import {Package, Perk, ServerNames} from '../app-config';
import {Identifier, Order, RedeemPerk} from './types';
import {TranslateParams} from '../translations';

export class PriorityQueuePerk implements RedeemPerk {
    constructor(private readonly cftools: CFToolsClient, private readonly serverNames: ServerNames) {
    }

    canRedeem(perk: Perk): boolean {
        return perk.type === 'PRIORITY_QUEUE';
    }

    async redeem(p: Package, perk: Perk, id: Identifier, order: Order): Promise<TranslateParams> {
        const steamId = SteamId64.of(id.steamId)

        const successParams: TranslateParams = ['PRIORITY_QUEUE_REDEEM_COMPLETE', {
            params: {
                until: this.expiration(order, perk).toLocaleString(),
                serverName: this.serverNames[perk.cftools.serverApiId],
            }
        }];
        try {
            await this.createPriority(steamId, perk, p, order);
        } catch (e) {
            if (e instanceof DuplicateResourceCreation) {
                await this.replacePriorityIfOlder(steamId, perk, p, order);
                return successParams;
            }
            throw e;
        }
        return successParams;
    }

    private async replacePriorityIfOlder(steamId: SteamId64, perk: Perk, p: Package, order: Order): Promise<void> {
        const newExpiration = this.expiration(order, perk);
        const request = {
            serverApiId: ServerApiId.of(perk.cftools.serverApiId),
            playerId: steamId,
        };
        const item = await this.cftools.getPriorityQueue(request);
        if (!item) {
            return await this.createPriority(steamId, perk, p, order);
        }
        if (item.expiration === 'Permanent') {
            return;
        }
        if (item.expiration.getTime() > newExpiration.getTime()) {
            return;
        }
        await this.cftools.deletePriorityQueue(request);

        return await this.createPriority(steamId, perk, p, order);
    }

    private expiration(order: Order, perk: Perk): Date {
        const orderTime = new Date(order.create_time);
        const expiration = new Date(orderTime.valueOf());
        expiration.setDate(orderTime.getDate() + perk.amountInDays);

        return expiration;
    }

    private async createPriority(steamId: SteamId64, perk: Perk, p: Package, order: Order): Promise<void> {
        await this.cftools.putPriorityQueue({
            serverApiId: ServerApiId.of(perk.cftools.serverApiId),
            id: steamId,
            expires: this.expiration(order, perk),
            comment: `Created by CFTools Server Donation bot.
PayPal Transaction ID: ${order.purchase_units[0]?.payments?.captures[0]?.id}
PayPal Order ID: ${order.id}
Selected product: ${p.name}`
        });
    }
}
