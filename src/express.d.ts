import {User as DomainUser} from './domain/user';
import {DonationType, PerkDetails, Price} from './domain/package';
import {VATRate} from './domain/vat';

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
            perkDetails: PerkDetails;
            type: DonationType;
        };
        vat?: VATRate,
        afterLoginTarget?: string;
        lastOrder?: {
            id: string,
            transactionId: string,
        };
    }
}
