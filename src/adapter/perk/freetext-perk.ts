import {TranslateParams} from '../../translations';
import {Hints, Package, Perk, RedeemTarget} from '../../domain/package';
import {OwnedPerk, User} from '../../domain/user';
import {Order} from '../../domain/payment';
import {createHash} from 'crypto';

export class FreetextPerk implements Perk {
    inPackage: Package;
    type: string;

    readonly text: string;
    private fingerprint: string;

    async redeem(target: RedeemTarget, order: Order): Promise<TranslateParams> {
        return ['FREETEXT_TEXT', {params: {text: this.text}}];
    }

    subjects(): Map<string, string> | null {
        return null;
    }

    async interfaceHints(forUser: User): Promise<Hints> {
        return {};
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

    id(): string {
        if (!this.fingerprint) {
            const hash = createHash('sha1');
            hash.update(this.type);
            hash.update(this.text);
            this.fingerprint = hash.digest('hex');
        }
        return this.fingerprint;
    }
}
