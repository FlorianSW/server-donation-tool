import {translate} from '../translations';

export class PriorityQueue implements OwnedPerk {
    type = 'PRIORITY_QUEUE';

    constructor(private readonly serverName: string, private readonly expires?: Date | 'Permanent') {
    }

    asString(): string {
        return `${this.serverName} (${translate('PERKS_OWNED_PRIORITY_QUEUE_UNTIL')} ${this.expires.toLocaleString()})`;
    }

    equals(other: OwnedPerk): boolean {
        if (other.type !== this.type) {
            return false;
        }
        return this.serverName === (other as PriorityQueue).serverName;
    }
}

export class Whitelist implements OwnedPerk {
    type = 'WHITELIST';

    constructor(private readonly serverName: string, private readonly expires?: Date | 'Permanent') {
    }

    asString(): string {
        return `${this.serverName} (${translate('PERKS_OWNED_WHITELIST_UNTIL')} ${this.expires.toLocaleString()})`;
    }

    equals(other: OwnedPerk): boolean {
        if (other.type !== this.type) {
            return false;
        }
        return this.serverName === (other as Whitelist).serverName;
    }
}

export class FailedToLoad implements OwnedPerk {
    type = 'FAILED_TO_LOAD';

    asString(): string {
        return translate('PERKS_OWNED_FAILED_TO_LOAD');
    }

    equals(other: OwnedPerk): boolean {
        return false;
    }
}

export class DiscordRole implements OwnedPerk {
    type = 'DISCORD_ROLE';

    constructor(private readonly role: string) {
    }

    asString(): string {
        return translate('PERKS_OWNED_DISCORD_ROLE', {params: {role: this.role}});
    }

    equals(other: OwnedPerk): boolean {
        if (other.type !== this.type) {
            return false;
        }
        return this.role === (other as DiscordRole).role;
    }
}

export class PrefixGroupMember implements OwnedPerk {
    type = 'LB_AG_PREFIX_GROUP_MEMBER';

    constructor(private readonly pgName: string, private readonly serverName: string) {
    }

    asString(): string {
        return translate('PERKS_OWNED_LB_AG_PREFIX_GROUP_MEMBER', {params: {pgName: this.pgName, serverName: this.serverName}});
    }

    equals(other: OwnedPerk): boolean {
        if (other.type !== this.type) {
            return false;
        }
        const o = other as PrefixGroupMember;
        return this.pgName === o.pgName && this.serverName === o.serverName;
    }
}

export interface OwnedPerk {
    type: string;

    asString(): string;

    equals(other: OwnedPerk): boolean;
}

export interface User {
    steam?: SteamConnection;
    discord: DiscordConnection;
    username: string;
    subscribedPackages: { [packageId: number]: string };
}

export interface SteamConnection {
    id: string;
    name: string;
    source: 'DISCORD' | 'STEAM';
}

export interface DiscordConnection {
    id: string;
}
