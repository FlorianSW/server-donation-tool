import {inject, singleton} from 'tsyringe';
import {OrderRepository} from '../domain/repositories';
import {AppConfig} from '../domain/app-config';
import {Order} from '../domain/payment';
import {config} from 'winston';
import {Package} from '../domain/package';

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
    private readonly defaultCurrency: string;

    constructor(@inject('OrderRepository') private readonly repository: OrderRepository, @inject('AppConfig') config: AppConfig, @inject('availablePackages') packages: Package[]) {
        this.monthlyTarget = config.app.community.donationTarget?.monthly;
        this.defaultCurrency = packages[0].price.currency;
    }

    hasMonthlyTarget(): boolean {
        return this.monthlyTarget !== undefined;
    }

    async monthly(): Promise<DonationTarget> {
        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
        const orders = await this.repository.findCreatedAfter(startOfMonth);
        const totalDonations = orders.map((o) => parseFloat(o.reference.p.price.amount)).reduce((pv, cv) => pv + cv, 0);

        return {
            currency: currencyMapping(this.currency(orders)),
            target: this.monthlyTarget,
            totalAmount: totalDonations,
            reached: totalDonations >= this.monthlyTarget,
        };
    }

    private currency(orders: Order[]): string {
        if (orders.length === 0) {
            return this.defaultCurrency;
        }
        return orders[0].reference.p.price.currency;
    }
}
