import {inject, singleton} from 'tsyringe';
import {OrderRepository} from '../domain/repositories';
import {AppConfig} from '../domain/app-config';

export interface DonationTarget {
    currency: string;
    totalAmount: number;
    target: number;
    reached: boolean;
}

function currencyMapping(currency: string) {
    switch (currency) {
        case 'USD':
            return '$';
        case 'EUR':
        case 'EURO':
            return '€';
        default:
            return currency;
    }
}

@singleton()
export class CalculateDonationTarget {
    private readonly monthlyTarget: number;

    constructor(@inject('OrderRepository') private readonly repository: OrderRepository, @inject('AppConfig') config: AppConfig) {
        this.monthlyTarget = config.app.community.donationTarget?.monthly;
    }

    hasMonthlyTarget(): boolean {
        return this.monthlyTarget !== undefined;
    }

    async monthly(): Promise<DonationTarget> {
        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
        const orders = await this.repository.findCreatedAfter(startOfMonth);
        const totalDonations = orders.map((o) => parseFloat(o.reference.p.price.amount)).reduce((pv, cv) => pv + cv);

        return {
            currency: currencyMapping(orders[0].reference.p.price.currency),
            target: this.monthlyTarget,
            totalAmount: totalDonations,
            reached: totalDonations >= this.monthlyTarget,
        };
    }
}
