export interface PlayerProfile {
    avatar?: string;
}

export interface SteamClient {
    playerProfile(steamId: string): Promise<PlayerProfile | null>
}
