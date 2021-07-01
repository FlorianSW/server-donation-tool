import {TranslateParams} from './translations';
import {CFToolsClient} from 'cftools-sdk';

export interface Perk {
    inPackage: Package;
    type: string;

    redeem(forUser: User, order: Order): Promise<TranslateParams>
}

export class Package {
    name: string;
    id: number;
    price: {
        currency: string,
        amount: string,
    };
    perks: Perk[];
}

export type ServerNames = {
    [serverApiId: string]: string
};

export interface AppConfig {
    app: {
        port: number,
        sessionSecret: string,
        community: {
            title: string,
            logo: string,
        }
    },
    discord: {
        clientId: string,
        clientSecret: string,
        redirectUrl: string,
    },
    paypal: {
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
}

export interface Order {
    id: string,
    create_time: string,
    purchase_units: {
        payments?: {
            captures: {
                id: string
            }[]
        }
    }[]
}

export interface PriorityQueue {
    active: boolean,
    expires?: Date | 'Permanent'
}

export interface ServerPriorityQueue {
    [key: string]: PriorityQueue
}

export interface User {
    steam: SteamConnection;
    username: string;
    priorityQueue: ServerPriorityQueue;
}

export interface SteamConnection {
    id: string;
}
