import { ExpiringDiscordRole } from '../domain/repositories';
import { DiscordRoleRecorder } from './discord-role-recorder';
import { EventQueue } from '../adapter/event-queue';
import { DiscordRolePerk } from '../adapter/perk/discord-role-perk';
import { RedeemTarget } from '../domain/package';
import { Client } from 'discord.js';
import { Logger } from 'winston';
import { InMemoryDiscordRoleRepository } from '../adapter/discord-role-repository';
import {
    asRedeemed,
    aUser,
    makeOrder,
    somePackages,
    withCreatedDate,
    withPerks
} from '../test-data.spec';

const MOCK_CLIENT = {} as Client;
const MOCK_LOGGER = {} as Logger;
const TEST_USER = aUser;

const NOT_EXPIRING_ROLE = new DiscordRolePerk(MOCK_CLIENT, '11111111', MOCK_LOGGER);
Object.assign(NOT_EXPIRING_ROLE, {
    inPackage: somePackages[0],
    roles: ['A_ROLE', 'ANOTHER_ROLE']
});

const EXPIRING_ROLE = new DiscordRolePerk(MOCK_CLIENT, '11111111', MOCK_LOGGER);
Object.assign(EXPIRING_ROLE, {
    inPackage: somePackages[0],
    roles: ['A_ROLE', 'ANOTHER_ROLE'],
    amountInDays: 2
});

describe('DiscordRoleRecorder', () => {
    let repository: InMemoryDiscordRoleRepository;
    let recorder: DiscordRoleRecorder;
    const redemptionDate = new Date('2020-11-01T14:52:12Z');
    const expiringDate = new Date('2020-11-03T14:52:13Z');

    beforeEach(() => {
        repository = new InMemoryDiscordRoleRepository();
        const events = new EventQueue();
        recorder = new DiscordRoleRecorder(events, repository);
    });

    it('does not record non-expiring discord role', async () => {
        const order = makeOrder(withPerks([NOT_EXPIRING_ROLE]));
        await recorder.onSuccessfulRedeem(RedeemTarget.fromUser(TEST_USER), order);

        expect(repository.count()).toBe(0);
    });

    it('records expiring discord role', async () => {
        const order = makeOrder(
            withCreatedDate(redemptionDate),
            asRedeemed(redemptionDate),
            withPerks([EXPIRING_ROLE])
        );
        await recorder.onSuccessfulRedeem(RedeemTarget.fromUser(TEST_USER), order);

        expect(repository.count()).toBe(2);
        const foundRoles = await repository.find(expiringDate);
        expect(foundRoles).toHaveLength(2);
        expect(foundRoles).toContainEqual({
            roleId: 'A_ROLE',
            discordUser: TEST_USER.discord.id,
            expiresAt: expect.any(Date)
        } as ExpiringDiscordRole);
    });

    it('does not return roles that have not yet expired', async () => {
        const order = makeOrder(
            withCreatedDate(redemptionDate),
            asRedeemed(redemptionDate),
            withPerks([EXPIRING_ROLE])
        );
        await recorder.onSuccessfulRedeem(RedeemTarget.fromUser(TEST_USER), order);

        const notExpiredRoles = await repository.find(new Date('2020-11-01T14:52:11Z'));
        expect(notExpiredRoles).toHaveLength(0);
    });
});
