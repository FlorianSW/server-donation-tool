import {User as DomainUser} from './domain/user';
import {DonationType, Price} from './domain/package';

declare global {
    namespace Express {
        export interface User extends DomainUser {
        }

        export interface Request {
            user?: User;
        }
    }
}

declare module 'express-session' {
    interface SessionData {
        selectedPackage: {
            id: number;
            price: Price;
            forAccount: string | undefined;
            perkDetails: Map<string, string>;
            type: DonationType;
        };
        afterLoginTarget?: string;
        lastOrder?: {
            id: string,
            transactionId: string,
        };
    }
}
