import {TranslateParams} from '../translations';
import {Order} from './payment';
import {User} from './user';

export interface Perk {
    inPackage: Package;
    type: string;

    redeem(forUser: User, order: Order): Promise<TranslateParams>;

    asTranslatedString(): string;
}

export enum PriceType {
    FIXED = 'FIXED', VARIABLE = 'VARIABLE'
}

export interface Price {
    type: PriceType;
    currency: string;
    amount: string;
}

export class RedeemError extends Error {
    constructor(public readonly params: TranslateParams) {
        super('RedeemError');
        Object.setPrototypeOf(this, RedeemError.prototype);
    }
}

export class Package {
    name: string;
    description?: string;
    id: number;
    price: Price;
    perks: Perk[];
}
