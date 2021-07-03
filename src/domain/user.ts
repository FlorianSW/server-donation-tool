export interface PriorityQueue {
    active: boolean,
    expires?: Date | 'Permanent'
}

export interface ServerPriorityQueue {
    [key: string]: PriorityQueue
}

export interface User {
    steam: SteamConnection;
    discord: DiscordConnection;
    username: string;
    priorityQueue: ServerPriorityQueue;
    discordRoles: string[];
}

export interface SteamConnection {
    id: string;
}

export interface DiscordConnection {
    id: string;
}
