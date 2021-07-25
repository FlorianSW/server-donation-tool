import {DiscordRoleRepository} from '../domain/repositories';
import {SQLiteDiscordRoleRepository} from './discord-role-repository';
import Knex from 'knex';
import * as fs from 'fs';

const testDbPath = __dirname + '/discord-role-repository.spec.sqlite';

describe('DiscordRoleRepository', () => {
    let repository: DiscordRoleRepository;

    beforeEach(() => {
        const knex = Knex({
            client: 'sqlite3',
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        repository = new SQLiteDiscordRoleRepository(knex);
    });

    it('persists role', async () => {
        await repository.save({
            roleId: '1111111111',
            discordUser: '22222222222',
            expiresAt: new Date('2025-05-16T14:25:49Z'),
        });

        const roles = await repository.find(new Date('2025-05-16T18:25:49Z'));

        expect(roles).toHaveLength(1)
        expect(roles).toContainEqual({
            roleId: '1111111111',
            discordUser: '22222222222',
            expiresAt: new Date('2025-05-16T14:25:49Z'),
        });
    });

    it('deletes recorded role', async () => {
        let role = {
            roleId: '1111111111',
            discordUser: '22222222222',
            expiresAt: new Date('2025-05-16T14:25:49Z'),
        };
        await repository.save(role);

        await repository.delete(role);

        const roles = await repository.find(new Date('2025-05-16T18:25:49Z'));
        expect(roles).toHaveLength(0);
    });

    afterEach(async () => {
        const repo = repository as SQLiteDiscordRoleRepository;
        await repo.clear();
        await repo.close();
        fs.rmSync(testDbPath);
    });
});
