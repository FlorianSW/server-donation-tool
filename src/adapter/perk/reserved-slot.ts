import {translate, TranslateParams} from '../../translations';
import {Hints, Login, Package, Perk, RedeemError, RedeemTarget} from '../../domain/package';
import {AppConfig, ServerNames} from '../../domain/app-config';
import {Order} from '../../domain/payment';
import * as https from 'https';
import {OwnedPerk, User} from '../../domain/user';
import {createHash} from 'crypto';

interface CreateReservedSlotRequest {
    data: {
        type: 'reservedSlot',
        meta: { [key: string]: string },
        attributes: {
            expires: string,
            identifiers: {
                type: 'steamID',
                identifier: string,
                manual: true
            }[],
        },
        relationships: {
            servers: {
                data: {
                    type: 'server',
                    id: string,
                }[],
            },
            organization: {
                data: {
                    type: 'organization',
                    id: string,
                },
            },
        },
    },
}

export class ReservedSlotPerk implements Perk {
    inPackage: Package;
    type: string;

    readonly battlemetrics: {
        organizationId: string,
        serverId: string,
    };
    readonly amountInDays?: number;
    readonly permanent = false;

    private fingerprint: string;

    constructor(
        private readonly serverNames: ServerNames,
        private readonly config: AppConfig,
    ) {
    }

    async redeem(target: RedeemTarget, order: Order): Promise<TranslateParams> {
        const successParams: TranslateParams = ['RESERVED_SLOT_REDEEM_COMPLETE', {
            params: {
                until: this.expiration(order).toLocaleString(),
                serverName: this.serverNames[this.battlemetrics.serverId],
            }
        }];

        try {
            await this.createReservedSlot(target, order);
        } catch (e) {
            this.throwRedeemError(e);
        }
        return successParams;
    }

    async ownedBy(target: RedeemTarget): Promise<OwnedPerk[] | null> {
        return null;
    }

    asLongString(): string {
        if (this.permanent) {
            return translate('PERK_RESERVED_SLOT_PERMANENT_DESCRIPTION', {
                params: {
                    serverName: this.serverNames[this.battlemetrics.serverId],
                }
            });
        }
        return translate('PERK_RESERVED_SLOT_DESCRIPTION', {
            params: {
                serverName: this.serverNames[this.battlemetrics.serverId],
                amountInDays: this.amountInDays.toString(10),
            }
        });
    }

    asShortString(): string {
        return this.asLongString();
    }

    subjects(): Map<string, string> | null {
        return null;
    }

    async interfaceHints(forUser: User): Promise<Hints> {
        return {};
    }

    id(): string {
        if (!this.fingerprint) {
            const hash = createHash('sha1');
            hash.update(this.type);
            hash.update(this.battlemetrics.organizationId);
            hash.update(this.battlemetrics.serverId);
            if (this.amountInDays) {
                hash.update(this.amountInDays.toString(10));
            } else {
                hash.update(this.permanent ? 'permanent' : 'not-permanent')
            }
            this.fingerprint = hash.digest('hex');
        }
        return this.fingerprint;
    }

    requiresLogins(): Login[] {
        return ['steam'];
    }

    private createReservedSlot(target: RedeemTarget, order: Order): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = https.request('https://api.battlemetrics.com/reserved-slots', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + this.config.battlemetrics.access_token,
                    'Content-Type': 'application/json',
                },
            }, (res) => {
                if (res.statusCode === 201) {
                    resolve();
                } else {
                    reject(new Error(res.statusCode.toString(10)));
                }
            });

            req.on('error', (e) => {
                reject(e);
            });

            req.write(JSON.stringify({
                data: {
                    type: 'reservedSlot',
                    meta: {
                        orderId: order.id,
                    },
                    attributes: {
                        expires: this.expiration(order)?.toISOString(),
                        identifiers: [{
                            type: 'steamID',
                            identifier: target.gameId.steam,
                            manual: true
                        }]
                    },
                    relationships: {
                        servers: {
                            data: [{
                                type: 'server',
                                id: '' + this.battlemetrics.serverId
                            }]
                        },
                        organization: {
                            data: {
                                type: 'organization',
                                id: '' + this.battlemetrics.organizationId
                            }
                        }
                    }
                }
            } as CreateReservedSlotRequest));
            req.end();
        });
    }

    private throwRedeemError(e: Error) {
        throw new RedeemError(['RESERVED_SLOT_REDEEM_ERROR', {
            params: {
                serverName: this.serverNames[this.battlemetrics.serverId],
                reason: e.message,
            }
        }]);
    }

    private expiration(order: Order): Date | null {
        if (this.permanent) {
            return null;
        }
        const expiration = new Date(order.firstRedeemed.valueOf());
        expiration.setDate(order.firstRedeemed.getDate() + this.amountInDays);

        return expiration;
    }
}
