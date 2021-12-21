import {ExpiringDiscordRole} from '../domain/repositories';
import {DiscordRoleRecorder} from './discord-role-recorder';
import {EventQueue} from '../adapter/event-queue';
import {Order, Reference} from '../domain/payment';
import {DiscordRolePerk} from '../adapter/perk/discord-role-perk';
import {RedeemTarget} from '../domain/package';
import {Client} from 'discord.js';
import {Logger} from 'winston';
import {InMemoryDiscordRoleRepository} from '../adapter/discord-role-repository';
import {aPackage, aUser} from '../adapter/perk/testdata.spec';
import {FakePayment} from '../adapter/paypal/paypal-payment';

const notExpiring = Object.assign(
    new DiscordRolePerk({} as Client, '11111111', {} as Logger),
    {
        inPackage: aPackage,
        roles: ['A_ROLE', 'ANOTHER_ROLE'],
    }
);

const expiring = Object.assign(
    new DiscordRolePerk({} as Client, '11111111', {} as Logger),
    {
        inPackage: aPackage,
        roles: ['A_ROLE', 'ANOTHER_ROLE'],
        amountInDays: 2,
    }
);

describe('DiscordRoleRecorder', () => {
    let repository: InMemoryDiscordRoleRepository;
    let recorder: DiscordRoleRecorder;

    beforeEach(() => {
        repository = new InMemoryDiscordRoleRepository();
        const events = new EventQueue();
        recorder = new DiscordRoleRecorder(events, repository);
    });

    it('does not record non-expiring discord role', async () => {
        await recorder.onSuccessfulRedeem(RedeemTarget.fromUser(aUser), Order.create(new Date(), {
            id: 'ORDER_ID',
            transactionId: 'TRANSACTION_ID',
            provider: FakePayment.NAME,
        }, new Reference('7592222222222', '11111111111', {
            ...aPackage,
            perks: [notExpiring],
        })));

        expect(repository.count()).toBe(0);
    });

    it('records expiring discord role', async () => {
        const order = Order.create(new Date('2020-11-01T14:52:12Z'), {
            id: 'ORDER_ID',
            transactionId: 'TRANSACTION_ID',
            provider: FakePayment.NAME,
        }, new Reference('7592222222222', '11111111111', {
            ...aPackage,
            perks: [expiring],
        }));
        order.redeemedAt = order.created;
        await recorder.onSuccessfulRedeem(RedeemTarget.fromUser(aUser), order);

        expect(repository.count()).toBe(2);
        expect(await repository.find(new Date('2020-11-03T14:52:13Z'))).toHaveLength(2);
        expect(await repository.find(new Date('2020-11-03T14:52:13Z'))).toContainEqual({
            roleId: 'A_ROLE',
            discordUser: aUser.discord.id,
            expiresAt: expect.any(Date),
        } as ExpiringDiscordRole);
    });

    it('does not return not yet expired roles', async () => {
        const order = Order.create(new Date('2020-11-25T14:52:12Z'), {
            id: 'ORDER_ID',
            transactionId: 'TRANSACTION_ID',
            provider: FakePayment.NAME,
        }, new Reference('7592222222222', '11111111111', {
            ...aPackage,
            perks: [expiring],
        }));
        order.redeemedAt = order.created
        await recorder.onSuccessfulRedeem(RedeemTarget.fromUser(aUser), order);

        expect(await repository.find(new Date('2020-11-25T14:52:11Z'))).toHaveLength(0);
    });
});
