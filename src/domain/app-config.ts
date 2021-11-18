import {DiscordNotification} from '../adapter/discord/discord-notifier';
import {PathLike} from 'fs';

export type ServerNames = {
    [serverApiId: string]: string
};

export interface AppConfig {
    app: {
        port: number,
        publicUrl: URL,
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
            donationTarget?: {
                discordChannelId: string,
                monthly?: number,
            },
        },
        googleAnalytics?: {
            trackingId: string,
        },
        privacyPolicy: {
            partials: PathLike[]
        },
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
        manageWebhook: boolean,
    },
    stripe?: {
        secretKey: string,
        publishableKey: string,
    },
    battlemetrics: {
        access_token: string,
    },
    cftools: {
        applicationId: string,
        secret: string,
    },
    serverNames: ServerNames,

    logoUrl(absolute?: boolean): string;
}
