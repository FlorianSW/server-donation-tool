import {translate, TranslateParams} from '../../translations';
import {Client, Guild} from 'discord.js';
import {Package, Perk, RedeemError} from '../../domain/package';
import {User} from '../../domain/user';
import {Order} from '../../domain/payment';

export class DiscordRolePerk implements Perk {
    inPackage: Package;
    type: string;

    readonly roles: string[];
    private guild: Guild;

    constructor(
        private readonly client: Client,
        private readonly guildId: string,
    ) {
    }

    async initialize(): Promise<void> {
        this.guild = await this.client.guilds.fetch(this.guildId);
        for (const r of this.roles) {
            await this.guild.roles.fetch(r);
        }
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

    asTranslatedString(): string {
        return translate('PERK_DISCORD_ROLE_DESCRIPTION', {
            params: {
                roles: this.roles.map((r) => {
                    const role = this.guild.roles.cache.get(r);
                    if (role) {
                        return role.name;
                    }
                    return r;
                }).join(', '),
            }
        })
    }
}
