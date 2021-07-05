import {TranslateParams} from '../../translations';
import {Client} from 'discord.js';
import {Package, Perk, RedeemError} from '../../domain/package';
import {User} from '../../domain/user';
import {Order} from '../../domain/payment';

export class DiscordRolePerk implements Perk {
    inPackage: Package;
    type: string;

    readonly roles: string[];

    constructor(
        private readonly client: Client,
        private readonly guildId: string,
    ) {
    }

    async redeem(forUser: User, order: Order): Promise<TranslateParams> {
        const successParams: TranslateParams = ['DISCORD_ROLE_REDEEM_COMPLETE', {
            params: {}
        }];
        const addedRoles: string[] = [];
        try {
            const guild = await this.client.guilds.fetch(this.guildId);
            const guildMember = await guild.members.fetch(forUser.discord.id);
            for (let roleId of this.roles) {
                const alreadyAdded = guildMember.roles.cache.find((r) => r.id === roleId);
                if (!alreadyAdded) {
                    const role = await guild.roles.fetch(roleId);
                    await guildMember.roles.add(role);
                    addedRoles.push(role.name);
                } else {
                    addedRoles.push(alreadyAdded.name);
                }
            }
        } catch (e) {
            throw new RedeemError(['DISCORD_ROLE_REDEEM_ERROR', {
                params: {
                    reason: e.message,
                }
            }]);
        }
        successParams[1].params = {
            roles: addedRoles.join(', '),
        };
        return successParams;
    }
}