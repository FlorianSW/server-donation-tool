import {
    DiscordRoleRepository,
    ExpiringDiscordRole,
    NitradoPlayer,
    NitradoPriorityPlayerRepository
} from '../domain/repositories';
import {Knex} from 'knex';
import {inject, singleton} from 'tsyringe';

const tableName = 'expiring_nitrado_priority_queue';
const columnDiscordUser = 'discord_user';
const columnNitradoPlayer = 'nitrado_player';
const columnServerId = 'server_id';
const columnExpiresAt = 'expires_at';

@singleton()
export class SQLiteNitradoPriorityQueueRepository implements NitradoPriorityPlayerRepository {
    private initialized: Promise<boolean>;

    constructor(@inject('DonationsDB') private readonly con: Knex) {
        this.initialized = new Promise((resolve) => {
            con.schema.hasTable(tableName).then((hasTable) => {
                if (!hasTable) {
                    con.schema.createTable(tableName, (b) => {
                        b.string(columnDiscordUser).index('idx_' + columnDiscordUser);
                        b.string(columnNitradoPlayer).index('idx_' + columnNitradoPlayer);
                        b.string(columnServerId);
                        b.dateTime(columnExpiresAt).index('idx_' + columnExpiresAt);
                        b.unique([columnNitradoPlayer, columnServerId], 'uc_nitrado_player_server_id');
                    }).then(() => {
                        resolve(true);
                    });
                } else {
                    resolve(true);
                }
            });
        });
    }

    async save(p: NitradoPlayer): Promise<void> {
        await this.initialized;
        // @formatter:off
        await this.con.raw(`REPLACE INTO ${tableName} (${columnDiscordUser}, ${columnNitradoPlayer}, ${columnServerId}, ${columnExpiresAt}) VALUES (?, ?, ?, ?)`, [
            p.discordUser, p.player, p.serverId, p.expiresAt.getTime(),
        ]);
        // @formatter:on
    }

    async delete(player: NitradoPlayer): Promise<void> {
        await this.initialized;
        await this.con.table(tableName).where(columnNitradoPlayer, player.player).andWhere(columnServerId, player.serverId).delete();
    }

    async find(expiresBefore: Date): Promise<NitradoPlayer[]> {
        await this.initialized;
        return this.con
            .table(tableName)
            .limit(100)
            .where(columnExpiresAt, '<=', expiresBefore.getTime())
            .then((result) => {
                return result.map((v) => {
                    return {
                        discordUser: v[columnDiscordUser],
                        player: v[columnNitradoPlayer],
                        expiresAt: new Date(v[columnExpiresAt]),
                        serverId: v[columnServerId],
                    } as NitradoPlayer
                });
            });
    }

    async clear(): Promise<void> {
        await this.initialized;
        await this.con.table(tableName).truncate();
    }

    async close(): Promise<void> {
        await this.con.destroy();
        this.initialized = undefined;
    }
}

export class InMemoryNitradoRepository implements NitradoPriorityPlayerRepository {
    private readonly roles: Map<[string, string], NitradoPlayer> = new Map();

    async close(): Promise<void> {
    }

    async find(expiresBefore: Date): Promise<NitradoPlayer[]> {
        return Array.from(this.roles.values()).filter((r) => r.expiresAt.getTime() <= expiresBefore.getTime());
    }

    async save(role: NitradoPlayer): Promise<void> {
        this.roles.set([role.player, role.serverId], role);
    }

    async delete(role: NitradoPlayer): Promise<void> {
        this.roles.delete([role.player, role.serverId]);
    }

    count(): number {
        return this.roles.size;
    }
}

