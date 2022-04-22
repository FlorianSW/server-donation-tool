import {ExpiringDiscordRole} from '../domain/repositories';
import {DiscordRoleRecorder} from './discord-role-recorder';
import {EventQueue} from '../adapter/event-queue';
import {DiscordRolePerk} from '../adapter/perk/discord-role-perk';
import {RedeemTarget} from '../domain/package';
import {Client} from 'discord.js';
import {Logger} from 'winston';
import {InMemoryDiscordRoleRepository} from '../adapter/discord-role-repository';
import {asRedeemed, aUser, makeOrder, somePackages, withCreatedDate, withPerks} from '../test-data.spec';

const notExpiring = Object.assign(
    new DiscordRolePerk({} as Client, '11111111', {} as Logger),
    {
        inPackage: somePackages[0],
        roles: ['A_ROLE', 'ANOTHER_ROLE'],
    }
);

const expiring = Object.assign(
    new DiscordRolePerk({} as Client, '11111111', {} as Logger),
    {
        inPackage: somePackages[0],
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
        await recorder.onSuccessfulRedeem(RedeemTarget.fromUser(aUser), makeOrder(withPerks([notExpiring])));

        expect(repository.count()).toBe(0);
    });

    it('records expiring discord role', async () => {
        const d = new Date('2020-11-01T14:52:12Z');
        const order = makeOrder(withCreatedDate(d), asRedeemed(d), withPerks([expiring]));
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
        const d = new Date('2020-11-25T14:52:12Z');
        const order = makeOrder(withCreatedDate(d), asRedeemed(d), withPerks([expiring]));
        await recorder.onSuccessfulRedeem(RedeemTarget.fromUser(aUser), order);

        expect(await repository.find(new Date('2020-11-25T14:52:11Z'))).toHaveLength(0);
    });
});
