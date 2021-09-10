import {TranslateParams} from '../../translations';
import {Package, Perk, RedeemTarget} from '../../domain/package';
import {User} from '../../domain/user';
import {Order} from '../../domain/payment';

export class FreetextPerk implements Perk {
    inPackage: Package;
    type: string;

    readonly text: string;

    async redeem(target: RedeemTarget, order: Order): Promise<TranslateParams> {
        return ['FREETEXT_TEXT', {params: {text: this.text}}];
    }

    asTranslatedString(): string {
        return this.text;
    }
}
