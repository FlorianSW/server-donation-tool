import {SubscriptionPlanRepository, SubscriptionsRepository} from '../domain/repositories';
import {InMemorySubscriptionsRepository} from '../adapter/subscriptions-repository';
import {InMemorySubscriptionPlanRepository} from '../adapter/subscription-plan-repository';
import {UserData} from './user-data';
import {Subscription} from '../domain/payment';
import {AppConfig} from '../domain/app-config';
import {FakePayment} from '../adapter/paypal/paypal-payment';
import {aPlan, aUser, somePackages} from '../test-data.spec';

describe('UserData', () => {
    const aConfig: AppConfig = {
        app: {
            publicUrl: new URL('http://localhost:8080'),
        }
    } as AppConfig;
    let subRepo: SubscriptionsRepository;
    let planRepo: SubscriptionPlanRepository;
    let service: UserData;

    beforeEach(() => {
        subRepo = new InMemorySubscriptionsRepository();
        planRepo = new InMemorySubscriptionPlanRepository();
        service = new UserData(subRepo, planRepo, aConfig);
    });

    it('has no packages if no subscriptions active', async () => {
        await expect(service.onRefresh(aUser)).resolves.toStrictEqual(aUser);
    });

    it('populates subscriptions', async () => {
        const sub = Subscription.create(aPlan, aUser);
        sub.agreeBilling('A_PAYMENT_ID');
        sub.pay('A_TRANSACTION_ID', FakePayment.NAME, somePackages[0]);
        await subRepo.save(sub);
        await planRepo.save(aPlan);

        await expect(service.onRefresh(aUser)).resolves.toStrictEqual({
            ...aUser,
            subscribedPackages: {
                [somePackages[0].id]: sub.asLink(aConfig).toString(),
            }
        });
    });
});
