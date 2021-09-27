import {TranslateParams} from '../translations';
import {Order} from './payment';
import {OwnedPerk, User} from './user';

export interface Perk {
    inPackage: Package;
    type: string;

    redeem(forUser: RedeemTarget, order: Order): Promise<TranslateParams>;

    ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null>;

    asLongString(): string;

    asShortString(): string;
}

export class RedeemTarget {
    constructor(
        public readonly steamId: string,
        public readonly discordId: string,
        public readonly username?: string,
    ) {
    }

    public static fromUser(user: User): RedeemTarget {
        return new RedeemTarget(user.steam.id, user.discord.id, user.username);
    }
}

export enum PriceType {
    FIXED = 'FIXED', VARIABLE = 'VARIABLE'
}

export interface Price {
    type: PriceType;
    currency: string;
    amount: string;
}

export enum DonationType {
    OneTime = 'one-time', Subscription = 'subscription'
}

export class RedeemError extends Error {
    constructor(public readonly params: TranslateParams) {
        super('RedeemError');
        Object.setPrototypeOf(this, RedeemError.prototype);
    }
}

export enum SubscriptionCycle {
    MONTHLY = 'monthly'
}

export class Package {
    name: string;
    description?: string;
    id: number;
    disabled?: boolean;
    subscription?: SubscriptionCycle | undefined;
    price: Price;
    perks: Perk[];
}
