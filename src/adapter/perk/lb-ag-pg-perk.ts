import {translate, TranslateParams} from '../../translations';
import {Package, Perk, RedeemError, RedeemTarget} from '../../domain/package';
import {FailedToLoad, OwnedPerk, PrefixGroupMember} from '../../domain/user';
import {Order} from '../../domain/payment';
import {Logger} from 'winston';
import {createHash} from 'crypto';
import fetch, {Response} from 'node-fetch';

export class LbMasterAdvancedGroupPrefixGroupPerk implements Perk {
    inPackage: Package;
    type: string;
    readonly apiUrl: string;
    readonly apiKey: string;
    readonly serverName: string;
    readonly prefixGroup: {
        name: string,
        index: number,
    };
    private fingerprint: string;

    constructor(private readonly log: Logger) {
    }

    subjects(): Map<string, string> {
        return null;
    }

    async redeem(target: RedeemTarget, order: Order): Promise<TranslateParams> {
        try {
            await this.uidRequest(target.steamId, 'PUT');

            return ['LB_AG_PG_REDEEM_COMPLETE', {
                params: {
                    serverName: this.serverName,
                    pgName: this.prefixGroup.name,
                }
            }];
        } catch (e) {
            this.log.error('Could not setup in-game tag. Error: ' + e);
            throw new RedeemError(['LB_AG_PG_REDEEM_ERROR', {
                params: {
                    serverName: this.serverName,
                    pgName: this.prefixGroup.name,
                    reason: e.message,
                }
            }]);
        }
    }

    async ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null> {
        try {
            await this.uidRequest(target.steamId, 'PUT');

            return [new PrefixGroupMember(this.prefixGroup.name, this.serverName)];
        } catch (e) {
            if (e.status === 404) {
                return [];
            } else {
                this.log.error('Could not load in-game tag. Error: ' + e);
            }
        }
        return [new FailedToLoad()];
    }

    asLongString(): string {
        return this.asTranslatedString('PERK_LB_AG_PG_DESCRIPTION');
    }

    asShortString(): string {
        return this.asTranslatedString('PERK_LB_AG_PG_SHORT');
    }

    id(): string {
        if (!this.fingerprint) {
            const hash = createHash('sha1');
            hash.update(this.type);
            hash.update(this.serverName);
            hash.update(this.prefixGroup.name);
            hash.update(this.prefixGroup.index.toString(10));
            hash.update(this.apiUrl);
            this.fingerprint = hash.digest('hex');
        }
        return this.fingerprint;
    }

    private async uidRequest(uid: string, method: 'GET' | 'PUT' = 'GET'): Promise<Response> {
        const url = new URL(`/api/prefixGroups/${this.prefixGroup.index}/${uid}`, this.apiUrl);
        const response
            = await fetch(url.toString(), {
            method: method,
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
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

    private asTranslatedString(key: string): string {
        return translate(key, {
            params: {
                serverName: this.serverName,
                pgName: this.prefixGroup.name,
            }
        });
    }
}
