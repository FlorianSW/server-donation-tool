import {CFToolsClient, SteamId64} from 'cftools-sdk';
import {InMemoryCFToolsClient} from './testhelper';
import {WhitelistPerk} from './whitelist-perk';
import {aRedeemedOrder, aPackage, aServerApiId, aSteamId, aUser} from './testdata.spec';
import {RedeemTarget} from '../../domain/package';

describe('WhitelistPerk', () => {
    let client: CFToolsClient;
    let perk: WhitelistPerk;

    beforeEach(() => {
        client = new InMemoryCFToolsClient();
        perk = Object.assign(
            new WhitelistPerk(client as CFToolsClient, {aServerApiId: 'A_NAME'}),
            {
                inPackage: aPackage,
                cftools: {
                    serverApiId: aServerApiId
                },
                amountInDays: 30,
            }
        );
    });

    describe('redeem', () => {
        it('creates whitelist entry', async () => {
            await perk.redeem(RedeemTarget.fromUser(aUser), aRedeemedOrder);

            const result = await client.getWhitelist(SteamId64.of(aSteamId));
            const expiration = result.expiration as Date;
            const expected = new Date();
            expected.setDate(expected.getDate() + perk.amountInDays);
            expect(expiration.toLocaleString().slice(0, -2)).toBe(expected.toLocaleString().slice(0, -2));
            expect(result.comment).toContain('A_PACKAGE');
            expect(result.comment).toContain(aRedeemedOrder.id);
            expect(result.comment).toContain('A_TRANSACTION_ID');
        });

        it('creates permanent whitelist entry', async () => {
            perk = Object.assign(
                new WhitelistPerk(client as CFToolsClient, {aServerApiId: 'A_NAME'}),
                {
                    inPackage: aPackage,
                    cftools: {
                        serverApiId: aServerApiId
                    },
                    permanent: true,
                }
            );
            await perk.redeem(RedeemTarget.fromUser(aUser), aRedeemedOrder);

            const result = await client.getWhitelist(SteamId64.of(aSteamId));
            expect(result.expiration).toContain('Permanent');
        });

        it('does not recreate permanent whitelist', async () => {
            await client.putWhitelist({
                id: SteamId64.of(aSteamId),
                comment: 'A_COMMENT',
                expires: 'Permanent'
            });

            await perk.redeem(RedeemTarget.fromUser(aUser), aRedeemedOrder);

            const result = await client.getWhitelist(SteamId64.of(aSteamId));
            expect(result.expiration).toBe('Permanent');
            expect(result.comment).toBe('A_COMMENT');
        });

        it('does not recreate whitelist which expires after new one', async () => {
            const veryLateExpiration = new Date(9999, 12, 31);
            await client.putWhitelist({
                id: SteamId64.of(aSteamId),
                comment: 'A_COMMENT',
                expires: veryLateExpiration,
            });

            await perk.redeem(RedeemTarget.fromUser(aUser), aRedeemedOrder);

            const result = await client.getWhitelist(SteamId64.of(aSteamId));
            expect(result.expiration).toEqual(veryLateExpiration);
            expect(result.comment).toBe('A_COMMENT');
        });

        it('recreates whitelist when it expires before the new one', async () => {
            const earlyExpiration = new Date(2021, 5, 1);
            await client.putWhitelist({
                id: SteamId64.of(aSteamId),
                comment: 'A_COMMENT',
                expires: earlyExpiration,
            });

            await perk.redeem(RedeemTarget.fromUser(aUser), aRedeemedOrder);

            const result = await client.getWhitelist(SteamId64.of(aSteamId));
            const expiration = result.expiration as Date;
            const expected = new Date();
            expected.setDate(expected.getDate() + perk.amountInDays);
            expect(expiration.toLocaleString().slice(0, -2)).toBe(expected.toLocaleString().slice(0, -2));
            expect(result.comment).toContain('A_PACKAGE');
        });
    });
});
