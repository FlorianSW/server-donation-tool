import {User as DomainUser} from './domain';
import {Package} from './app-config';

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
        selectedPackage: Package;
        afterLoginTarget: string;
    }
}
