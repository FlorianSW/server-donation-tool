import {translate} from '../translations';

export class PriorityQueue implements OwnedPerk {
    type = 'PRIORITY_QUEUE';

    constructor(private readonly serverName: string, private readonly expires?: Date | 'Permanent') {
    }

    asString(): string {
        return `${this.serverName} (${translate('PERKS_OWNED_PRIORITY_QUEUE_UNTIL')} ${this.expires.toLocaleString()})`;
    }
}

export class FailedToLoad implements OwnedPerk {
    type = 'FAILED_TO_LOAD';

    asString(): string {
        return translate('PERKS_OWNED_FAILED_TO_LOAD');
    }
}

export class DiscordRole implements OwnedPerk {
    type = 'DISCORD_ROLE';

    constructor(private readonly role: string) {
    }

    asString(): string {
        return translate('PERKS_OWNED_DISCORD_ROLE', {params: {role: this.role}});
    }
}

export interface OwnedPerk {
    type: string;
    asString(): string;
}

export interface User {
    steam?: SteamConnection;
    discord: DiscordConnection;
    username: string;
}

export interface SteamConnection {
    id: string;
    name: string;
    source: 'DISCORD' | 'STEAM';
}

export interface DiscordConnection {
    id: string;
}
