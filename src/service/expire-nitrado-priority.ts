import {DiscordRoleRepository, NitradoPriorityPlayerRepository} from '../domain/repositories';
import {Client, DiscordAPIError, GuildMember} from 'discord.js';
import {Logger} from 'winston';
import {inject, singleton} from 'tsyringe';
import {Closeable} from '../index';
import {NitradoApi} from "../adapter/nitrado/api";

@singleton()
export class ExpireNitradoPriority implements Closeable {
    private readonly interval: NodeJS.Timer;

    constructor(
        @inject('NitradoPriorityPlayerRepository') private readonly repository: NitradoPriorityPlayerRepository,
        @inject('NitradoApi') private readonly client: NitradoApi,
        @inject('nitrado.runEvery') runEvery: number,
        @inject('Logger') private readonly log: Logger
    ) {
        this.interval = setInterval(this.expire.bind(this), runEvery);
    }

    async expire(): Promise<void> {
        this.log.debug('Start expiring nitrado priority');
        const players = await this.repository.find(new Date());
        for (const player of players) {
            this.log.info(`Nitrado priority of ${player.player} for server ${player.serverId} is expired. Removing...`);
            await this.client.deletePriorityQueue(player.serverId, player.player);
            await this.repository.delete(player);
        }
    }

    async close(): Promise<void> {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
}
