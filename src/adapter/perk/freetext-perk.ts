import {TranslateParams} from '../../translations';
import {Client} from 'discord.js';
import {Package, Perk, RedeemError} from '../../domain/package';
import {User} from '../../domain/user';
import {Order} from '../../domain/payment';

export class FreetextPerk implements Perk {
    inPackage: Package;
    type: string;

    readonly text: string;

    async redeem(forUser: User, order: Order): Promise<TranslateParams> {
        return [this.text, {params: {}}];
    }
}
