import {CalculateDonationTarget, DonationTarget} from './donation-target';
import {AppConfig} from '../domain/app-config';
import {InMemoryOrderRepository} from '../adapter/order-repository';
import {Order, Reference} from '../domain/payment';
import {aPackage} from '../adapter/perk/testdata.spec';

describe('CalculateDonationTarget', () => {
    describe('has monthly target', () => {
        it('returns false when no target defined', () => {
            expect(new CalculateDonationTarget(null, {app: {community: {}}} as AppConfig, [aPackage]).hasMonthlyTarget()).toBe(false);
        });

        it('returns true when target defined', () => {
            expect(new CalculateDonationTarget(null, {app: {community: {donationTarget: {monthly: 10}}}} as AppConfig, [aPackage]).hasMonthlyTarget()).toBe(true);
        });
    });

    describe('monthly', () => {
        it('returns donation target', async () => {
            const r = new InMemoryOrderRepository();
            await r.save(Order.create(new Date(), {
                id: 'AN_ID',
                transactionId: 'AN_ID'
            }, new Reference(null, 'A_DISCORD_ID', aPackage)));
            const s = new CalculateDonationTarget(r, {app: {community: {donationTarget: {monthly: 10}}}} as AppConfig, [aPackage]);

            const result = await s.monthly();

            expect(result).toEqual({
                target: 10,
                currency: '$',
                totalAmount: 1,
                reached: false,
            } as DonationTarget);
        });

        it('defaults to 0', async () => {
            const r = new InMemoryOrderRepository();
            const s = new CalculateDonationTarget(r, {app: {community: {donationTarget: {monthly: 10}}}} as AppConfig, [aPackage]);

            const result = await s.monthly();

            expect(result).toEqual({
                target: 10,
                currency: '$',
                totalAmount: 0,
                reached: false,
            } as DonationTarget);
        });
    });
});
