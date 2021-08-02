import {DiscordRoleRepository} from '../domain/repositories';
import {Client, DiscordAPIError, GuildMember} from 'discord.js';
import {Logger} from 'winston';
import {inject, singleton} from 'tsyringe';
import {Closeable} from '../index';

@singleton()
export class ExpireDiscordRole implements Closeable {
    private readonly interval: NodeJS.Timer;

    constructor(
        @inject('DiscordRoleRepository') private readonly repository: DiscordRoleRepository,
        @inject('discord.Client') private readonly client: Client,
        @inject('discord.guildId') private readonly guildId: string,
        @inject('discord.runEvery') private readonly runEvery: number,
        @inject('Logger') private readonly log: Logger
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
