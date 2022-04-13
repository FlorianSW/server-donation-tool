import Knex from 'knex';
import * as fs from 'fs';
import {Properties} from '../domain/app-config';
import {SQLitePropertiesRepository} from './properties-repository';

const testDbPath = __dirname + '/properties-repository.spec.sqlite';
const context = 'test';

describe('PropertiesRepository', () => {
    let repository: Properties;

    beforeEach(() => {
        const knex = Knex({
            client: 'sqlite3',
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        repository = new SQLitePropertiesRepository(knex);
    });

    describe('persists proerpties', () => {
        it('persists property', async () => {
            await repository.set(context, 'SOME_KEY', 'SOME_VALUE');

            expect(await repository.find(context, 'SOME_KEY')).toEqual('SOME_VALUE');
        });

        it('persists integer property', async () => {
            await repository.set(context, 'SOME_KEY', 100);

            expect(await repository.find(context, 'SOME_KEY')).toEqual(100);
        });

        it('does not overwrite same key and another context', async () => {
            await repository.set(context, 'SOME_KEY', 'SOME_VALUE');
            await repository.set('another-context', 'SOME_KEY', 'ANOTHER_VALUE');

            expect(await repository.find(context, 'SOME_KEY')).toEqual('SOME_VALUE');
            expect(await repository.find('another-context', 'SOME_KEY')).toEqual('ANOTHER_VALUE');
        });
    });

    it('null on missing property', async () => {
        expect(await repository.find(context, 'SOME_KEY')).toBeNull();
    });

    it('deletes property', async () => {
        await repository.set(context, 'SOME_KEY', 'SOME_VALUE');

        await repository.delete(context, 'SOME_KEY');

        expect(await repository.find(context, 'SOME_KEY')).toBeNull();
    });

    afterEach(async () => {
        const repo = repository as SQLitePropertiesRepository;
        await repo.clear();
        await repo.close();
        fs.rmSync(testDbPath);
    });
});
