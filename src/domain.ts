export interface PriorityQueue {
    active: boolean,
    expires?: Date | 'Permanent'
}

export interface ServerPriorityQueue {
    [key: string]: PriorityQueue
}

export interface User {
    steam: SteamConnection;
    username: string;
    priorityQueue: ServerPriorityQueue;
}

export interface SteamConnection {
    id: string;
}
