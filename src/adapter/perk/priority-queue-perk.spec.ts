import {PriorityQueuePerk} from './priority-queue-perk';
import {CFToolsClient, SteamId64} from 'cftools-sdk';
import {InMemoryCFToolsClient} from './testhelper';
import {User} from '../../domain/user';
import {Package, PriceType} from '../../domain/package';
import {Order, Reference} from '../../domain/payment';

const aSteamId = '76561198012102485';
const aServerApiId = 'c10a80c6-ad46-477e-971d-614370ec173e';
const aUser: User = {
    steam: {
        id: aSteamId,
        source: 'DISCORD',
        name: 'Test',
    },
    discord: {
        id: '',
    },
    username: 'A_USERNAME',
};
const aPackage: Package = {
    id: 1,
    perks: [],
    name: 'A_PACKAGE',
    price: {
        type: PriceType.FIXED,
        currency: 'USD',
        amount: '1.00'
    }
};
const anOrder: Order = {
    id: 'SOME_ORDER_ID',
    created: new Date(),
    transactionId: 'A_TRANSACTION_ID',
    reference: new Reference(aSteamId, aPackage),
};

describe('PriorityQueuePerk', () => {
    let client: CFToolsClient;
    let perk: PriorityQueuePerk;

    beforeEach(() => {
        client = new InMemoryCFToolsClient();
        perk = Object.assign(
            new PriorityQueuePerk(client as CFToolsClient, {aServerApiId: 'A_NAME'}),
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
        it('creates priority queue entry', async () => {
            await perk.redeem(aUser, anOrder);

            const result = await client.getPriorityQueue(SteamId64.of(aSteamId));
            const expiration = result.expiration as Date;
            const expected = new Date();
            expected.setDate(expected.getDate() + perk.amountInDays);
            expect(expiration.toLocaleString().slice(0, -2)).toBe(expected.toLocaleString().slice(0, -2));
            expect(result.comment).toContain('A_PACKAGE');
            expect(result.comment).toContain('SOME_ORDER_ID');
            expect(result.comment).toContain('A_TRANSACTION_ID');
        });

        it('creates permanent priority queue entry', async () => {
            perk = Object.assign(
                new PriorityQueuePerk(client as CFToolsClient, {aServerApiId: 'A_NAME'}),
                {
                    inPackage: aPackage,
                    cftools: {
                        serverApiId: aServerApiId
                    },
                    permanent: true,
                }
            );
            await perk.redeem(aUser, anOrder);

            const result = await client.getPriorityQueue(SteamId64.of(aSteamId));
            expect(result.expiration).toContain('Permanent');
        });

        it('does not recreate permanent priority queue', async () => {
            await client.putPriorityQueue({
                id: SteamId64.of(aSteamId),
                comment: 'A_COMMENT',
                expires: 'Permanent'
            });

            await perk.redeem(aUser, anOrder);

            const result = await client.getPriorityQueue(SteamId64.of(aSteamId));
            expect(result.expiration).toBe('Permanent');
            expect(result.comment).toBe('A_COMMENT');
        });

        it('does not recreate priority queue which expires after new one', async () => {
            const veryLateExpiration = new Date(9999, 12, 31);
            await client.putPriorityQueue({
                id: SteamId64.of(aSteamId),
                comment: 'A_COMMENT',
                expires: veryLateExpiration,
            });

            await perk.redeem(aUser, anOrder);

            const result = await client.getPriorityQueue(SteamId64.of(aSteamId));
            expect(result.expiration).toEqual(veryLateExpiration);
            expect(result.comment).toBe('A_COMMENT');
        });

        it('recreates priority queue when it expires before the new one', async () => {
            const earlyExpiration = new Date(2021, 5, 1);
            await client.putPriorityQueue({
                id: SteamId64.of(aSteamId),
                comment: 'A_COMMENT',
                expires: earlyExpiration,
            });

            await perk.redeem(aUser, anOrder);

            const result = await client.getPriorityQueue(SteamId64.of(aSteamId));
            const expiration = result.expiration as Date;
            const expected = new Date();
            expected.setDate(expected.getDate() + perk.amountInDays);
            expect(expiration.toLocaleString().slice(0, -2)).toBe(expected.toLocaleString().slice(0, -2));
            expect(result.comment).toContain('A_PACKAGE');
        });
    });
});
