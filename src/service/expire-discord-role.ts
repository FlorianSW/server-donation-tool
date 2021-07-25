import {DiscordRoleRepository} from '../domain/repositories';
import {Client, DiscordAPIError, GuildMember} from 'discord.js';
import {Logger} from 'winston';

export class ExpireDiscordRole {
    private readonly interval: NodeJS.Timer;

    constructor(
        private readonly repository: DiscordRoleRepository,
        private readonly client: Client,
        private readonly guildId: string,
        private readonly runEvery: number,
        private readonly log: Logger
    ) {
        this.interval = setInterval(this.expire.bind(this), runEvery);
    }

    async expire(): Promise<void> {
        this.log.debug('Start expiring discord roles');
        const guild = await this.client.guilds.fetch(this.guildId);
        const roles = await this.repository.find(new Date());
        for (const role of roles) {
            this.log.info(`Role assignment of role ${role.roleId} for discord user ${role.discordUser} is expired. Removing...`);
            let guildMember: GuildMember;
            try {
                guildMember = await guild.members.fetch(role.discordUser);
            } catch (e) {
                if (e instanceof DiscordAPIError && e.code === 10007) {
                    this.log.info(`Discord member ${role.discordUser} does not exist in guild anymore. Role can not be expired`);
                    await this.repository.delete(role);
                }
                continue;
            }
            await guildMember.roles.remove(role.roleId);
            await this.repository.delete(role);
        }
    }

    async close(): Promise<void> {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
}
