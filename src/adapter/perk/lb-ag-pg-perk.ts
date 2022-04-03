import {translate, TranslateParams} from '../../translations';
import {Hints, Package, Perk, RedeemError, RedeemTarget} from '../../domain/package';
import {FailedToLoad, OwnedPerk, PrefixGroupMember, User} from '../../domain/user';
import {Order} from '../../domain/payment';
import {Logger} from 'winston';
import {createHash} from 'crypto';
import fetch, {Response} from 'node-fetch';
import {AppConfig, LbAgPgServer} from '../../domain/app-config';

export class LbMasterAdvancedGroupPrefixGroupPerk implements Perk {
    inPackage: Package;
    type: string;
    readonly servers: string[];
    readonly prefixGroup: {
        name: string;
        index: number;
    }
    private fingerprint: string;

    constructor(private readonly log: Logger, private readonly config: AppConfig) {
    }

    subjects(): Map<string, string> {
        if (this.servers.length === 1) {
            return null;
        }

        const result = new Map<string, string>();
        for (let serverId of this.servers) {
            const server = this.config.lb_ag_pg[serverId];
            if (!server) {
                continue;
            }
            result.set(serverId, server.serverName);
        }
        return result;
    }

    async interfaceHints(forUser: User): Promise<Hints> {
        return {};
    }

    async redeem(target: RedeemTarget, order: Order): Promise<TranslateParams> {
        let server: LbAgPgServer = this.config.lb_ag_pg[this.servers[0]];
        if (this.servers.length > 1) {
            const serverId = order.perkDetails.get(this.id());
            server = this.config.lb_ag_pg[serverId];
            if (!server) {
                throw new Error('the lb_ag_pg perk ' + this.id() + ' does not have a valid server for selected ID ' + serverId);
            }
        }
        try {
            await this.uidRequest(server, target.steamId, 'PUT');

            return ['LB_AG_PG_REDEEM_COMPLETE', {
                params: {
                    serverName: server.serverName,
                    pgName: this.prefixGroup.name,
                }
            }];
        } catch (e) {
            this.log.error('Could not setup in-game tag. Error: ' + e);
            throw new RedeemError(['LB_AG_PG_REDEEM_ERROR', {
                params: {
                    serverName: server.serverName,
                    pgName: this.prefixGroup.name,
                    reason: e.message,
                }
            }]);
        }
    }

    async ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null> {
        const result: OwnedPerk[] = [];
        for (let serverId of this.servers) {
            const server = this.config.lb_ag_pg[serverId];
            if (!server) {
                continue;
            }
            try {
                await this.uidRequest(server, target.steamId, 'GET');
                result.push(new PrefixGroupMember(this.prefixGroup.name, server.serverName));
            } catch (e) {
                if (e.status === 404) {
                    continue;
                }
                this.log.error('Could not load in-game tag. Error: ' + e);
                result.push(new FailedToLoad());
            }
        }

        return result;
    }

    asLongString(context: Order | null): string {
        if (this.servers.length === 1) {
            return this.longStringForSingle(this.servers[0]);
        } else if (context && context.perkDetails.has(this.id())) {
            return this.longStringForSingle(context.perkDetails.get(this.id()));
        } else {
            return this.longStringForMulti(this.servers);
        }
    }

    longStringForSingle(id: string): string {
        const server = this.config.lb_ag_pg[id];
        if (!server) {
            return 'Configuration error: Server with ID ' + id + ' not configured in lg_ag_pg.';
        }
        return translate('PERK_LB_AG_PG_DESCRIPTION', {
            params: {
                serverName: server.serverName,
                pgName: this.prefixGroup.name,
            }
        });
    }

    longStringForMulti(id: string[]): string {
        return translate('PERK_LB_AG_PG_DESCRIPTION_MULTI', {
            params: {
                serverNames: id.map((s) => this.config.lb_ag_pg[s]?.serverName).join(', '),
                pgName: this.prefixGroup.name,
            }
        });
    }

    asShortString(context: Order | null): string {
        return this.asLongString(context);
    }

    id(): string {
        if (!this.fingerprint) {
            const hash = createHash('sha1');
            hash.update(this.type);
            hash.update(this.prefixGroup.name);
            hash.update(this.prefixGroup.index.toString(10));
            for (let id of this.servers) {
                hash.update(id);
            }
            this.fingerprint = hash.digest('hex');
        }
        return this.fingerprint;
    }

    private async uidRequest(server: LbAgPgServer, uid: string, method: 'GET' | 'PUT' = 'GET'): Promise<Response> {
        const url = new URL(`/api/prefixGroups/${this.prefixGroup.index}/${uid}`, server.apiUrl);
        const response
            = await fetch(url.toString(), {
            method: method,
            headers: {
                Authorization: `Bearer ${server.apiKey}`,
            }
        });
        if (response.status === 204) {
            return response;
        }
        throw {
            status: response.status,
            message: 'Unexpected status code: ' + response.status,
        };
    }
}
