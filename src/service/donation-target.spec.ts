import {CalculateDonationTarget, DonationTarget} from './donation-target';
import {AppConfig} from '../domain/app-config';
import {InMemoryOrderRepository} from '../adapter/order-repository';
import {makeOrder, somePackages} from '../test-data.spec';

describe('CalculateDonationTarget', () => {
    describe('has monthly target', () => {
        it('returns false when no target defined', () => {
            expect(new CalculateDonationTarget(null, {app: {community: {}}} as AppConfig, [somePackages[0]]).hasMonthlyTarget()).toBe(false);
        });

        it('returns true when target defined', () => {
            expect(new CalculateDonationTarget(null, {app: {community: {donationTarget: {monthly: 10}}}} as AppConfig, [somePackages[0]]).hasMonthlyTarget()).toBe(true);
        });
    });

    describe('monthly', () => {
        it('returns donation target', async () => {
            const r = new InMemoryOrderRepository();
            await r.save(makeOrder());
            const s = new CalculateDonationTarget(r, {app: {community: {donationTarget: {monthly: 20}}}} as AppConfig, [somePackages[0]]);

            const result = await s.monthly();

            expect(result).toEqual({
                target: 20,
                currency: '$',
                totalAmount: 10,
                reached: false,
            } as DonationTarget);
        });

        it('defaults to 0', async () => {
            const r = new InMemoryOrderRepository();
            const s = new CalculateDonationTarget(r, {app: {community: {donationTarget: {monthly: 10}}}} as AppConfig, [somePackages[0]]);

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
