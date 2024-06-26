import {translate, TranslateParams} from '../../translations';
import {Client, DiscordAPIError, Guild, RESTJSONErrorCodes} from 'discord.js';
import {Hints, Login, Package, Perk, RedeemError, RedeemTarget, Refundable} from '../../domain/package';
import {DiscordRole, OwnedPerk, User} from '../../domain/user';
import {Order} from '../../domain/payment';
import {Logger} from 'winston';
import {createHash} from 'crypto';

export class DiscordRolePerk implements Perk, Refundable {
    inPackage: Package;
    type: string;
    readonly roles: string[];
    readonly amountInDays?: number;
    private fingerprint: string;
    private guild: Guild;

    constructor(
        private readonly client: Client,
        private readonly guildId: string,
        private readonly log: Logger,
    ) {
    }

    async initialize(): Promise<void> {
        this.guild = await this.client.guilds.fetch(this.guildId);
        for (const r of this.roles) {
            const role = await this.guild.roles.fetch(r);
            if (role === null) {
                this.log.warn(`Discord role with ID ${r} does not exist in the configured guild.`);
            }
        }
    }

    subjects(): Map<string, string> | null {
        return null;
    }

    async interfaceHints(forUser: User): Promise<Hints> {
        const unknownMember = translate('DISCORD_ROLE_UNKNOWN_MEMBER', {
            params: {
                username: forUser.discord.username,
                discriminator: forUser.discord.discriminator
            }
        });
        const notices: string[] = [unknownMember];
        const guild = await this.client.guilds.fetch(this.guildId);
        try {
            await guild.members.fetch(forUser.discord.id);
        } catch (e) {
            if (e instanceof DiscordAPIError && e.code === RESTJSONErrorCodes.UnknownMember) {
                notices.push(unknownMember);
            } else {
                throw e;
            }
        }
        return {
            notices: notices,
        };
    }

    async redeem(target: RedeemTarget, order: Order): Promise<TranslateParams> {
        const successParams: TranslateParams = ['DISCORD_ROLE_REDEEM_COMPLETE', {
            params: {}
        }];
        const addedRoles: string[] = [];
        try {
            const guild = await this.client.guilds.fetch(this.guildId);
            const guildMember = await guild.members.fetch(target.gameId.discord);
            for (let roleId of this.roles) {
                const alreadyAdded = guildMember.roles.cache.find((r) => r.id === roleId);
                if (!alreadyAdded) {
                    const role = await guild.roles.fetch(roleId);
                    if (!role) {
                        this.log.warn("Discord role " + roleId + " configured for discord role perk, but this role does not exist.")
                        continue
                    }
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

    async refund(forUser: RedeemTarget, order: Order): Promise<void> {
        try {
            const guild = await this.client.guilds.fetch(this.guildId);
            const guildMember = await guild.members.fetch(forUser.gameId.discord);
            for (let roleId of this.roles) {
                await guildMember.roles.remove(roleId);
            }
        } catch (e) {
            throw new RedeemError(['DISCORD_ROLE_REDEEM_ERROR', {
                params: {
                    reason: e.message,
                }
            }]);
        }
    }

    async ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null> {
        try {
            const guildMember = await this.guild.members.fetch(target.gameId.discord);
            return guildMember.roles.cache
                .filter((r) => this.roles.includes(r.id))
                .map((r) => new DiscordRole(r.name));
        } catch (e) {
            throw e;
        }
    }

    asLongString(): string {
        return this.asTranslatedString('PERK_DISCORD_ROLE_DESCRIPTION');
    }

    asShortString(): string {
        return this.asTranslatedString('PERK_DISCORD_ROLE_SHORT');
    }

    id(): string {
        if (!this.fingerprint) {
            const hash = createHash('sha1');
            hash.update(this.type);
            hash.update(this.amountInDays?.toString(10) || 'permanent');
            const r = this.roles.sort();
            for (let role of r) {
                hash.update(role);
            }
            this.fingerprint = hash.digest('hex');
        }
        return this.fingerprint;
    }

    requiresLogins(): Login[] {
        return ['discord'];
    }

    private asTranslatedString(key: string): string {
        return translate(key, {
            params: {
                roles: this.roles.map((r) => {
                    const role = this.guild.roles.cache.get(r);
                    if (role) {
                        return role.name;
                    }
                    return r;
                }).join(', '),
            }
        });
    }
}
