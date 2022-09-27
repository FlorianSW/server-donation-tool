import {InMemoryOrderRepository} from '../adapter/order-repository';
import {makeOrder, withVat} from '../test-data.spec';
import {OrderBreakdown, OrderOverview} from './order-overview';

describe('OrderOverview', () => {
    describe('monthlyOverview', () => {
        it('returns donation target', async () => {
            const r = new InMemoryOrderRepository();
            const o = makeOrder()
            await r.save(o);
            const o2 = makeOrder(withVat());
            await r.save(o2);
            const s = new OrderOverview(r);

            const now = new Date();
            const result = await s.monthlyOverview(now.getUTCFullYear(), now.getMonth() + 1);

            expect(result).toEqual({
                totalVat: parseFloat(o.vat.amount(o.reference.p.price)),
                totalRevenue: parseFloat(o.reference.p.price.amount) + parseFloat(o2.reference.p.price.amount),
                totalOrders: 2,
                vatByCountry: {
                    [o.vat.countryCode]: parseFloat(o.vat.amount(o.reference.p.price)),
                },
            } as OrderBreakdown);
        });
    });
});
