export interface Perk {
    name: string,
    id: number,
    price: {
        currency: string,
        amount: string,
    },
    type: string,
    amountInDays: number,
    cftools: {
        serverApiId: string,
    }
}

export interface AppConfig {
    app: {
        port: number,
        sessionSecret: string,
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
    perks: Perk[]
}
