import {Package, Perk} from '../app-config';
import {TranslateParams} from '../translations';

export interface Order {
    id: string,
    create_time: string,
    purchase_units: {
        payments?: {
            captures: {
                id: string
            }[]
        }
    }[]
}

export interface Identifier {
    steamId: string,
}

export interface RedeemPerk {
    canRedeem(perk: Perk): boolean

    redeem(p: Package, perk: Perk, id: Identifier, order: Order): Promise<TranslateParams>
}

