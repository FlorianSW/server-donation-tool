import {RedeemPackage} from './redeem-package';
import {InMemoryOrderRepository} from '../adapter/order-repository';
import {EventQueue} from '../adapter/event-queue';
import winston from 'winston';
import {anOrder, aUser, makeOrder, withPerks} from '../test-data.spec';
import {Hints, Package, Perk, RedeemTarget, Refundable} from '../domain/package';
import {Order, OrderStatus} from '../domain/payment';
import {OwnedPerk, User} from '../domain/user';
import {TranslateParams} from '../translations';
import {OrderRepository} from '../domain/repositories';

describe('RedeemPackage', () => {
    let repo: OrderRepository;
    let service: RedeemPackage;

    beforeEach(() => {
        repo = new InMemoryOrderRepository();
        service = new RedeemPackage(repo, new EventQueue(), winston.createLogger());
    });

    describe('redeem', () => {
        it('redeems each perk of the package to the target', async () => {
            const target = RedeemTarget.fromUser(aUser);
            const perk = new FakePerk();

            const result = await service.redeem(anOrder, target, [perk]);

            expect(result.errors).toHaveLength(0);
            expect(result.success).toHaveLength(1);
            const o = await perk.ownedBy(target);
            expect(o).toHaveLength(1);
            expect(o[0].type).toBe(new FakeOwnedPerk().type);
        });

        it('marks order as redeemed', async () => {
            const order = makeOrder();
            await repo.save(order);

            await service.redeem(order, RedeemTarget.fromUser(aUser), [new FakePerk()]);

            const o = await repo.find(order.id);
            expect(o.redeemedAt).not.toBeNull();
            expect(o.redeemedAt.getTime()).toBeCloseTo(new Date().getTime(), -1);
        });
    });

    describe('refund', () => {
        it('refunds refundable perks', async () => {
            const perk = new FakePerk();
            const target = RedeemTarget.fromUser(aUser);
            const order = makeOrder(withPerks([perk]));
            await repo.save(order);
            await service.redeem(order, target, [perk]);

            await service.refund(order, target);

            expect(await perk.ownedBy(target)).toBeNull();
        });

        it('marks order as refunded', async () => {
            const order = makeOrder();
            await repo.save(order);

            await service.refund(order, RedeemTarget.fromUser(aUser));

            const o = await repo.find(order.id);
            expect(o.status).toEqual(OrderStatus.REFUNDED);
            expect(o.refundedAt).not.toBeNull();
            expect(o.refundedAt.getTime()).toBeCloseTo(new Date().getTime(), -2);
        });
    });
});

class FakePerk implements Perk, Refundable {
    inPackage: Package;
    type: string = 'FAKE_PERK';
    private readonly owned: Set<RedeemTarget> = new Set<RedeemTarget>();

    asLongString(context?: Order | undefined): string {
        return 'FAKE_PERK';
    }

    asShortString(context?: Order | undefined): string {
        return this.asLongString(context);
    }

    id(): string {
        return 'SOME_ID';
    }

    async interfaceHints(forUser: User): Promise<Hints> {
        return null;
    }

    async ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null> {
        if (this.owned.has(target)) {
            return [new FakeOwnedPerk()];
        }
        return null;
    }

    async redeem(forUser: RedeemTarget, order: Order): Promise<TranslateParams> {
        this.owned.add(forUser);
        return ['FAKE_PERK', {params: {}}];
    }

    subjects(): Map<string, string> | null {
        return undefined;
    }

    async refund(forUser: RedeemTarget, order: Order): Promise<void> {
        this.owned.delete(forUser);
    }
}

class FakeOwnedPerk implements OwnedPerk {
    type: string = 'FAKE_OWNED';

    asString(): string {
        return 'FAKE_OWNED';
    }

    equals(other: OwnedPerk): boolean {
        return other.type === this.type;
    }
}
