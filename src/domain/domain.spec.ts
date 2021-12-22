import {Subscription} from './payment';
import {aPackage, aPlan, aUser} from '../adapter/perk/testdata.spec';
import {FakePayment} from '../adapter/paypal/paypal-payment';

describe('Subscriptions', () => {
    describe('isActive', () => {
        it('is active when pending', () => {
            expect(Subscription.create(aPlan, aUser).isActive()).toBe(true);
        });

        it('is active when active', () => {
            const subscription = Subscription.create(aPlan, aUser);

            subscription.agreeBilling('A_PAYMENT_ID');
            subscription.pay('A_TRANSACTION_ID', FakePayment.NAME, aPackage);

            expect(subscription.isActive()).toBe(true);
        });

        it('is not active when cancelled', () => {
            const subscription = Subscription.create(aPlan, aUser);

            subscription.cancel();

            expect(subscription.isActive()).toBe(false);
        });
    });
});
