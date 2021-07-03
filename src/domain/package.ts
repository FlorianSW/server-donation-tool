import {TranslateParams} from '../translations';
import {Order} from './payment';
import {User} from './user';

export interface Perk {
    inPackage: Package;
    type: string;

    redeem(forUser: User, order: Order): Promise<TranslateParams>
}

export class RedeemError extends Error {
    constructor(public readonly params: TranslateParams) {
        super('RedeemError');
        Object.setPrototypeOf(this, RedeemError.prototype);
    }
}

export class Package {
    name: string;
    id: number;
    price: {
        currency: string,
        amount: string,
    };
    perks: Perk[];
}
