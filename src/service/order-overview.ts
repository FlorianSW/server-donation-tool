import {inject, singleton} from 'tsyringe';
import {OrderRepository} from '../domain/repositories';
import {Order} from '../domain/payment';

export interface OrderBreakdown {
    currency: string,
    totalOrders: number,
    totalRevenue: number,
    totalVat: number,
    vatByCountry: { [countryCode: string]: number },
    startOfMonth: Date,
    endOfMonth: Date,
}

@singleton()
export class OrderOverview {

    constructor(@inject('OrderRepository') private readonly repository: OrderRepository) {
    }

    async monthlyOverview(month: number, year: number): Promise<OrderBreakdown> {
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
        const endOfMonth = new Date(startOfMonth.getTime());
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        const result = {
            currency: '',
            totalOrders: 0,
            totalRevenue: 0,
            totalVat: 0,
            vatByCountry: {},
            startOfMonth: startOfMonth,
            endOfMonth: endOfMonth,
        } as OrderBreakdown;
        await this.repository.findCreatedPages(startOfMonth, endOfMonth, (o: Order[]) => {
            o.forEach((order: Order) => {
                result.totalOrders += 1;
                result.totalRevenue += parseFloat(order.reference.p.price.amount);
                result.currency = order.reference.p.price.currency;
                if (order.vat) {
                    const vat = parseFloat(order.vat.amount(order.reference.p.price));
                    result.totalVat += vat;
                    if (!result.vatByCountry[order.vat.countryCode]) {
                        result.vatByCountry[order.vat.countryCode] = 0;
                    }
                    result.vatByCountry[order.vat.countryCode] += vat;
                }
            });
            return true;
        });
        return result;
    }
}
