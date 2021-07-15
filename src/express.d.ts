import {User as DomainUser} from './domain/user';
import {Price} from './domain/package';

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
        };
        afterLoginTarget?: string;
        lastOrder?: {
            id: string,
            transactionId: string,
        };
    }
}
