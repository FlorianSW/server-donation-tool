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
        const orderTime = new Date(order.create_time);
        const expiration = new Date(orderTime.valueOf());
        expiration.setDate(orderTime.getDate() + perk.amountInDays);

        const successParams: TranslateParams = ['PRIORITY_QUEUE_REDEEM_COMPLETE', {
            params: {
                until: expiration.toLocaleString(),
                serverName: this.serverNames[perk.cftools.serverApiId],
            }
        }];
        try {
            await this.cftools.putPriorityQueue({
                serverApiId: ServerApiId.of(perk.cftools.serverApiId),
                id: SteamId64.of(id.steamId),
                expires: expiration,
                comment: `Created by CFTools Server Donation bot.
PayPal Transaction ID: ${order.purchase_units[0]?.payments?.captures[0]?.id}
PayPal Order ID: ${order.id}
Selected product: ${p.name}`
            });
        } catch (e) {
            if (e instanceof DuplicateResourceCreation) {
                return successParams;
            }
            throw e;
        }
        return successParams;
    }
}
