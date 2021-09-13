import {inject, injectable} from 'tsyringe';
import {SubscriptionPlanRepository, SubscriptionsRepository} from '../domain/repositories';
import {User} from '../domain/user';
import {AppConfig} from '../domain/app-config';

@injectable()
export class UserData {
    constructor(
        @inject('SubscriptionsRepository') private readonly subs: SubscriptionsRepository,
        @inject('SubscriptionPlanRepository') private readonly plans: SubscriptionPlanRepository,
        @inject('AppConfig') private readonly config: AppConfig,
    ) {
    }

    async onRefresh(user: User): Promise<User> {
        const active = await this.subs.findActive(user);
        const r: { [packageId: number]: string } = {};
        for (let s of active) {
            const plan = await this.plans.find(s.planId);
            r[plan.basePackage.id] = s.asLink(this.config).toString();
        }
        return {
            ...user,
            subscribedPackages: r,
        };
    }
}
