import {TranslateParams} from '../../translations';
import {Package, Perk, RedeemTarget} from '../../domain/package';
import {OwnedPerk, User} from '../../domain/user';
import {Order} from '../../domain/payment';

export class FreetextPerk implements Perk {
    inPackage: Package;
    type: string;

    readonly text: string;

    async redeem(target: RedeemTarget, order: Order): Promise<TranslateParams> {
        return ['FREETEXT_TEXT', {params: {text: this.text}}];
    }

    async ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null> {
        return null;
    }

    asLongString(): string {
        return this.text;
    }

    asShortString(): string {
        return this.text;
    }
}
