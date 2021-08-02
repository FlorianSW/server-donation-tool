import {Package} from './package';
import {Store} from 'express-session';
import {DiscordNotification} from '../adapter/discord-notifier';

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
        language?: string,
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
            expireRolesEvery?: number,
        },
        notifications?: DiscordNotification[],
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

    logoUrl(): string;
}
