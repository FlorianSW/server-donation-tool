import {Knex} from 'knex';
import {inject, singleton} from 'tsyringe';
import {Properties} from '../domain/app-config';
import {Closeable} from '../index';

const tableName = 'properties';
const columnKey = 'key';
const columnValue = 'value';

function composite(context: string, key: string): string {
    return context + '#' + key;
}

@singleton()
export class SQLitePropertiesRepository implements Properties, Closeable {
    private initialized: Promise<boolean>;

    constructor(@inject('DonationsDB') private readonly con: Knex) {
        this.initialized = new Promise((resolve) => {
            con.schema.hasTable(tableName).then(async (hasTable) => {
                if (!hasTable) {
                    con.schema.createTable(tableName, (b) => {
                        b.string(columnKey).primary('key');
                        b.binary(columnValue);
                    }).then(() => {
                        resolve(true);
                    });
                } else {
                    resolve(true);
                }
            });
        });
    }

    async find(context: string, key: string): Promise<any | null> {
        await this.initialized;
        return this.con.table(tableName).limit(1).where(columnKey, composite(context, key)).then((result) => {
            if (result.length === 0) {
                return null;
            }
            return result[0][columnValue];
        });
    }

    async set(context: string, key: string, value: any): Promise<void> {
        await this.initialized;
        // @formatter:off
        await this.con.raw(`REPLACE INTO ${tableName} (${columnKey}, ${columnValue}) VALUES (?, ?)`, [
            composite(context, key), value
        ]);
        // @formatter:on
    }

    async delete(context: string, key: string): Promise<void> {
        await this.initialized;
        await this.con.table(tableName).where(columnKey, composite(context, key)).delete();
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

export class InMemoryProperties implements Properties {
    private readonly properties: Map<string, any> = new Map();

    async find(context: string, key: string): Promise<any | null> {
        return this.properties.get(context + '#' + key);
    }

    async set(context: string, key: string, value: any): Promise<void> {
        this.properties.set(context + '#' + key, value);
    }

    async delete(context: string, key: string): Promise<void> {
        this.properties.delete(context + '#' + key);
    }
}

