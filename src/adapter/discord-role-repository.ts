import {DiscordRoleRepository, ExpiringDiscordRole} from '../domain/repositories';
import Knex from 'knex';
import {inject, singleton} from 'tsyringe';

const tableName = 'expiring_discord_roles';
const columnDiscordUser = 'discord_user';
const columnRoleId = 'role_id';
const columnExpiresAt = 'expires_at';

@singleton()
export class SQLiteDiscordRoleRepository implements DiscordRoleRepository {
    private initialized: Promise<boolean>;

    constructor(@inject('DonationsDB') private readonly con: Knex) {
        this.initialized = new Promise((resolve) => {
            con.schema.hasTable(tableName).then((hasTable) => {
                if (!hasTable) {
                    con.schema.createTable(tableName, (b) => {
                        b.string(columnDiscordUser).index('idx_' + columnDiscordUser);
                        b.string(columnRoleId);
                        b.dateTime(columnExpiresAt).index('idx_' + columnExpiresAt);
                        b.unique([columnDiscordUser, columnRoleId], 'uc_discord_user_role_id');
                    }).then(() => {
                        resolve(true);
                    });
                } else {
                    resolve(true);
                }
            });
        });
    }

    async save(role: ExpiringDiscordRole): Promise<void> {
        await this.initialized;
        // @formatter:off
        await this.con.raw(`REPLACE INTO ${tableName} (${columnDiscordUser}, ${columnRoleId}, ${columnExpiresAt}) VALUES (?, ?, ?)`, [
            role.discordUser, role.roleId, role.expiresAt.getTime()
        ]);
        // @formatter:on
    }

    async delete(role: ExpiringDiscordRole): Promise<void> {
        await this.initialized;
        await this.con.table(tableName).where(columnDiscordUser, role.discordUser).andWhere(columnRoleId, role.roleId).delete();
    }

    async find(expiresBefore: Date): Promise<ExpiringDiscordRole[]> {
        await this.initialized;
        return this.con
            .table(tableName)
            .limit(100)
            .where(columnExpiresAt, '<=', expiresBefore.getTime())
            .then((result) => {
                return result.map((v) => {
                    return {
                        discordUser: v[columnDiscordUser],
                        expiresAt: new Date(v[columnExpiresAt]),
                        roleId: v[columnRoleId],
                    } as ExpiringDiscordRole
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

export class InMemoryDiscordRoleRepository implements DiscordRoleRepository {
    private readonly roles: Map<[string, string], ExpiringDiscordRole> = new Map();

    async close(): Promise<void> {
    }

    async find(expiresBefore: Date): Promise<ExpiringDiscordRole[]> {
        return Array.from(this.roles.values()).filter((r) => r.expiresAt.getTime() <= expiresBefore.getTime());
    }

    async save(role: ExpiringDiscordRole): Promise<void> {
        this.roles.set([role.discordUser, role.roleId], role);
    }

    async delete(role: ExpiringDiscordRole): Promise<void> {
        this.roles.delete([role.discordUser, role.roleId]);
    }

    count(): number {
        return this.roles.size;
    }
}

