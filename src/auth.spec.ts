import {discordUserCallback} from './auth';
import {ConnectionInfo, Profile} from 'passport-discord';
import {PlayerProfile, SteamClient} from './domain/steam-client';
import DoneCallback = jest.DoneCallback;
import {Logger} from "winston";

class FakeSteamClient implements SteamClient {
    playerProfile(steamId: string): Promise<PlayerProfile | null> {
        return Promise.resolve(null);
    }
}

describe('Auth', () => {
    let profile: Profile;
    let steamClient: SteamClient;
    let logger: Logger;

    beforeEach(() => {
        logger = new Logger();
        profile = {
            connections: [],
            username: 'SOME_USERNAME',
            id: '123456789'
        } as Profile;
        steamClient = new FakeSteamClient();
    });

    it('extracts user information', (done: DoneCallback) => {
        discordUserCallback(steamClient, '', '', profile, logger).then((user) => {
            expect(user.steam).toBeUndefined();
            expect(user.discord.id).toBe('123456789');
            expect(user.username).toBe('SOME_USERNAME');
            done();
        });
    });

    it('extracts steam information', (done: DoneCallback) => {
        profile.connections.push({type: 'steam', id: 'SOME_ID'} as ConnectionInfo);

        discordUserCallback(steamClient, '', '', profile, logger).then((user) => {
            expect(user.steam.id).toEqual('SOME_ID');
            done();
        });
    });
});
