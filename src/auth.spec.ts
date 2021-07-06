import {discordUserCallback} from './auth';
import DoneCallback = jest.DoneCallback;
import {ConnectionInfo, Profile} from 'passport-discord';

describe('Auth', () => {
    let profile: Profile;

    beforeEach(() => {
        profile = {
            connections: [],
            username: 'SOME_USERNAME',
            id: '123456789'
        } as Profile;
    });

    it('extracts user information', (done: DoneCallback) => {
        discordUserCallback('', '', profile, (error, user) => {
            expect(user.steam).toBeUndefined();
            expect(user.discord.id).toBe('123456789');
            expect(user.username).toBe('SOME_USERNAME');
            expect(user.discordRoles).toEqual([]);
            expect(user.priorityQueue).toEqual({});
            done();
        });
    });

    it('extracts steam information', (done: DoneCallback) => {
        profile.connections.push({type: 'steam', id: 'SOME_ID'} as ConnectionInfo);

        discordUserCallback('', '', profile, (error, user) => {
            expect(user.steam.id).toEqual('SOME_ID');
            done();
        });
    });
});
