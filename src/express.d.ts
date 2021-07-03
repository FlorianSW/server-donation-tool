import {User as DomainUser} from './domain/user';

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
        selectedPackageId: number;
        afterLoginTarget: string;
    }
}
