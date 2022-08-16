import {Price} from './package';

export interface VATRate {
    countryCode: string
    countryName: string
    displayName: string,
    rate: number
    amount: string
}

export interface VATs {
    countries(price?: Price): Promise<VATRate[]>

    forCountry(price: Price, countryCode: string): Promise<VATRate>
}
