import {
    Ban,
    CFToolsClient,
    CFToolsId,
    DeleteBanRequest,
    DeleteBansRequest,
    DeletePriorityQueueRequest,
    DeleteWhitelistRequest,
    DuplicateResourceCreation,
    GameLabsActionRequest,
    GameServerItem,
    GameSession,
    GenericId,
    GetGameServerDetailsRequest,
    GetLeaderboardRequest,
    GetPlayerDetailsRequest,
    GetPriorityQueueRequest,
    GetServerInfoRequest,
    GetWhitelistRequest,
    HealPlayerRequest,
    LeaderboardItem,
    ListBansRequest,
    ListGameSessionsRequest,
    Player,
    PriorityQueueItem,
    PutBanRequest,
    PutPriorityQueueItemRequest,
    PutWhitelistItemRequest,
    ServerInfo,
    SpawnItemRequest,
    TeleportPlayerRequest,
    WhitelistItem
} from 'cftools-sdk';

export class InMemoryCFToolsClient implements CFToolsClient {
    private priorityQueueItems: Map<string, PriorityQueueItem> = new Map();
    private whitelistItems: Map<string, WhitelistItem> = new Map();

    gameLabsAction(request: GameLabsActionRequest): Promise<void> {
        return Promise.resolve(undefined);
    }

    healPlayer(request: HealPlayerRequest): Promise<void> {
        return Promise.resolve(undefined);
    }

    killPlayer(request: HealPlayerRequest): Promise<void> {
        return Promise.resolve(undefined);
    }

    getServerInfo(request: GetServerInfoRequest): Promise<ServerInfo> {
        return Promise.resolve(undefined);
    }

    listGameSessions(request: ListGameSessionsRequest): Promise<GameSession[]> {
        return Promise.resolve([]);
    }

    spawnItem(request: SpawnItemRequest): Promise<void> {
        return Promise.resolve(undefined);
    }

    teleport(request: TeleportPlayerRequest): Promise<void> {
        return Promise.resolve(undefined);
    }

    deleteBan(request: DeleteBanRequest): Promise<void> {
        return Promise.resolve(undefined);
    }

    deleteBans(request: DeleteBansRequest): Promise<void> {
        return Promise.resolve(undefined);
    }

    deletePriorityQueue(id: GenericId | DeletePriorityQueueRequest): Promise<void> {
        if ('playerId' in id) {
            this.priorityQueueItems.delete(id.playerId.id);
        } else {
            this.priorityQueueItems.delete(id.id);
        }
        return Promise.resolve(undefined);
    }

    deleteWhitelist(id: GenericId | DeleteWhitelistRequest): Promise<void> {
        if ('playerId' in id) {
            this.whitelistItems.delete(id.playerId.id);
        } else {
            this.whitelistItems.delete(id.id);
        }
        return Promise.resolve(undefined);
    }

    getGameServerDetails(request: GetGameServerDetailsRequest): Promise<GameServerItem> {
        return Promise.resolve(undefined);
    }

    getLeaderboard(request: GetLeaderboardRequest): Promise<LeaderboardItem[]> {
        return Promise.resolve([]);
    }

    getPlayerDetails(id: GenericId | GetPlayerDetailsRequest): Promise<Player> {
        return Promise.resolve(undefined);
    }

    getPriorityQueue(id: GenericId | GetPriorityQueueRequest): Promise<PriorityQueueItem | null> {
        let item: PriorityQueueItem | undefined;
        if ('playerId' in id) {
            item = this.priorityQueueItems.get(id.playerId.id);
        } else {
            item = this.priorityQueueItems.get(id.id);
        }
        return Promise.resolve(item);
    }

    getWhitelist(id: GenericId | GetWhitelistRequest): Promise<WhitelistItem | null> {
        let item: WhitelistItem | undefined;
        if ('playerId' in id) {
            item = this.whitelistItems.get(id.playerId.id);
        } else {
            item = this.whitelistItems.get(id.id);
        }
        return Promise.resolve(item);
    }

    listBans(request: ListBansRequest): Promise<Ban[]> {
        return Promise.resolve([]);
    }

    putBan(request: PutBanRequest): Promise<void> {
        return Promise.resolve(undefined);
    }

    async putPriorityQueue(request: PutPriorityQueueItemRequest): Promise<void> {
        const item = await this.getPriorityQueue(request.id);
        if (item) {
            throw new DuplicateResourceCreation('http://localhost:8081');
        }
        this.priorityQueueItems.set(request.id.id, {
            createdBy: CFToolsId.of('123456789'),
            expiration: request.expires || 'Permanent',
            comment: request.comment,
            created: new Date(),
        });
        return Promise.resolve(undefined);
    }

    async putWhitelist(request: PutWhitelistItemRequest): Promise<void> {
        const item = await this.getWhitelist(request.id);
        if (item) {
            throw new DuplicateResourceCreation('http://localhost:8081');
        }
        this.whitelistItems.set(request.id.id, {
            createdBy: CFToolsId.of('123456789'),
            expiration: request.expires || 'Permanent',
            comment: request.comment,
            created: new Date(),
        });
        return Promise.resolve(undefined);
    }

    resolve(id: GenericId | { playerId: GenericId; }): Promise<CFToolsId> {
        return Promise.resolve(undefined);
    }
}
