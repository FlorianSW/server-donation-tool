import {inject, singleton} from 'tsyringe';
import {OrderRepository} from '../domain/repositories';
import {Order} from '../domain/payment';

export interface OrderBreakdown {
    totalOrders: number,
    totalRevenue: number,
    totalVat: number,
    vatByCountry: { [countryCode: string]: number },
}

@singleton()
export class OrderOverview {

    constructor(@inject('OrderRepository') private readonly repository: OrderRepository) {
    }

    async monthlyOverview(): Promise<OrderBreakdown> {
        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
        const endOfMonth = new Date(startOfMonth.getTime());
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        const result = {
            totalOrders: 0,
            totalRevenue: 0,
            totalVat: 0,
            vatByCountry: {},
        } as OrderBreakdown;
        await this.repository.findCreatedPages(startOfMonth, endOfMonth, (o: Order[]) => {
            o.forEach((order: Order) => {
                result.totalOrders += 1;
                result.totalRevenue += parseFloat(order.reference.p.price.amount);
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
