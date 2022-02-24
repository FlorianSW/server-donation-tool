import {PlayerProfile, SteamClient} from '../domain/steam-client';
import {inject, injectable} from 'tsyringe';
import {AppConfig} from '../domain/app-config';
import fetch, {Response} from 'node-fetch';

interface GetPlayerSummaries {
    response: {
        players: {
            steamid: string,
            avatar: string,
            avatarmedium: string,
            avatarfull: string,
        }[],
    }
}

@injectable()
export class HttpSteamClient implements SteamClient {
    private readonly apiKey: string | undefined;

    constructor(@inject('AppConfig') config: AppConfig) {
        this.apiKey = config.steam?.apiKey;
    }

    async playerProfile(steamId: string): Promise<PlayerProfile | null> {
        if (!this.apiKey) {
            return undefined;
        }

        const response: Response = await fetch(`http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(this.apiKey)}&steamids=${encodeURIComponent(steamId)}`);
        if (response.status !== 200) {
            return undefined;
        }
        const summaries: GetPlayerSummaries = await response.json();
        if (summaries.response.players.length !== 1) {
            return undefined;
        }
        const player = summaries.response.players[0];
        if (player.avatarfull) {
            return {
                avatar: player.avatarfull,
            };
        } else if (player.avatarmedium) {
            return {
                avatar: player.avatarmedium,
            };
        } else if (player.avatar) {
            return {
                avatar: player.avatar,
            };
        } else {
            return {};
        }
    }
}
