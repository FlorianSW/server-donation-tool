import {Price} from './package';

export class VATRate {
    constructor(public readonly countryCode: string, public readonly rate: number, public readonly countryName?: string, public readonly displayName?: string) {
    }

    public amount(p: Price): string {
        const priceTag = parseFloat(p.amount);
        const tax = priceTag * (this.rate / 100);
        return tax.toFixed(2);
    }

    static fromValueObject(v?: VATRate | undefined): VATRate | undefined {
        if (v) {
            return new VATRate(v.countryCode, v.rate, v.countryName, v.displayName);
        }
        return undefined;
    }
}

export interface VATs {
    countries(price?: Price): Promise<VATRate[]>

    forCountry(price: Price, countryCode: string): Promise<VATRate>
}
