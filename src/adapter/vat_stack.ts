import {VATRate, VATs} from '../domain/vat';
import {Price} from '../domain/package';
import {inject, singleton} from 'tsyringe';
import {AppConfig} from '../domain/app-config';
import fetch from 'node-fetch';

interface VATStackRate {
    categories: {
        eservice?: number;
    };
    country_code: string;
    country_name: string;
    standard_rate: number;
}

function toVATRate(r: VATStackRate, p?: Price): VATRate {
    let amount = '0.00';
    if (p) {
        const priceTag = parseFloat(p.amount);
        const taxRate = r.categories?.eservice || r.standard_rate;
        const tax =priceTag * (taxRate / 100);
        amount = tax.toFixed(2)
    }
    return {
        countryCode: r.country_code,
        rate: r.categories?.eservice || r.standard_rate,
        amount,
        countryName: r.country_name,
    }
}

@singleton()
export class VATStack implements VATs {
    private readonly publicKey: string;
    private cachedRates: VATStackRate[] | undefined = undefined;

    constructor(@inject('AppConfig') config: AppConfig) {
        this.publicKey = config.vats.vatStack.publicKey;
    }

    async countries(price?: Price): Promise<VATRate[]> {
        const rates = await this.resolveRates();
        return rates.map((r) => toVATRate(r, price));
    }

    async forCountry(price: Price, countryCode: string): Promise<VATRate> {
        const rates = await this.resolveRates();
        return toVATRate(rates.find((r) => r.country_code === countryCode), price);
    }

    private async resolveRates(): Promise<VATStackRate[]> {
        if (this.cachedRates === undefined) {
            const res = await fetch('https://api.vatstack.com/v1/rates?member_state=true', {
                headers: {
                    'X-API-KEY': this.publicKey,
                }
            });
            if (res.status !== 200) {
                throw new Error('Could not retrieve VAT rates from VATStack: ' + res.status);
            }
            const body: { rates: VATStackRate[] } = await res.json();
            this.cachedRates = body.rates;
        }
        return this.cachedRates;
    }
}

@singleton()
export class NoOpVats implements VATs {
    async countries(price?: Price): Promise<VATRate[]> {
        return [];
    }

    async forCountry(price: Price, countryCode: string): Promise<VATRate> {
        return undefined;
    }
}
