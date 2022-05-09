import {TranslateParams} from '../translations';
import {Order, Reference} from './payment';
import {OwnedPerk, User} from './user';

export interface Perk {
    inPackage: Package;
    type: string;

    redeem(forUser: RedeemTarget, order: Order): Promise<TranslateParams>;

    interfaceHints(forUser: User): Promise<Hints>;

    subjects(): Map<string, string> | null;

    ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null>;

    asLongString(context?: Order | undefined): string;

    asShortString(context?: Order | undefined): string;

    id(): string;
}

export interface Refundable {
    refund(forUser: RedeemTarget, order: Order): Promise<void>;
}

export function isRefundable(object: any): object is Refundable {
    return 'refund' in object;
}

export interface Hints {
    notices?: string[];
}

export type PerkDetails = { [key: string]: string };

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

    public static fromReference(ref: Reference): RedeemTarget {
        return new RedeemTarget(ref.steamId, ref.discordId, '');
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
    payment?: {
        name: string;
    }
    id: number;
    disabled?: boolean;
    subscription?: SubscriptionCycle | undefined;
    price: Price;
    perks: Perk[];
}
