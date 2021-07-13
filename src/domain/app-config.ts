import {Package} from './package';
import {CFToolsClient} from 'cftools-sdk';
import {Client} from 'discord.js';
import {Notifier} from './notifier';
import {Store} from 'express-session';

export type ServerNames = {
    [serverApiId: string]: string
};

export interface AppConfig {
    app: {
        port: number,
        sessionSecret: string,
        sessionStore: {
            filename: string,
        },
        compressResponse: boolean,
        community?: {
            title?: string,
            logo?: string,
            discord?: string,
        }
    },
    discord: {
        clientId: string,
        clientSecret: string,
        redirectUrl: string,
        bot?: {
            token: string,
            guildId: string,
        }
    },
    steam?: {
        realm: string,
        redirectUrl: string,
        apiKey: string,
    },
    paypal: {
        environment: string,
        clientId: string,
        clientSecret: string,
    },
    cftools: {
        applicationId: string,
        secret: string,
    },
    serverNames: ServerNames,
    packages: Package[],

    cfToolscClient(): CFToolsClient;

    discordClient(): Promise<Client>;

    notifier(): Notifier;

    sessionStore(): Promise<Store>;

    destroy(): void;
}
