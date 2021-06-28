export interface Perk {
    type: string,
    amountInDays: number,
    cftools?: {
        serverApiId: string,
    }
}

export interface Package {
    name: string,
    id: number,
    price: {
        currency: string,
        amount: string,
    },
    perks: Perk[]
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
}
