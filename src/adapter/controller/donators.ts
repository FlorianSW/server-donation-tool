import {requireAuthentication} from '../../auth';
import {Request, Response, Router} from 'express';
import {Package, Perk, RedeemTarget} from '../../domain/package';
import {AppConfig} from '../../domain/app-config';
import {OwnedPerk} from '../../domain/user';
import {DiscordAPIError, RESTJSONErrorCodes} from 'discord.js';
import {inject, singleton} from 'tsyringe';

@singleton()
export class DonatorsController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('packages') private readonly packages: Package[],
    ) {
        this.router.get('/api/donators/@me/perks', requireAuthentication, this.listOwnedPerks.bind(this));
    }

    private perks(): Perk[] {
        return this.packages.map((p) => p.perks).reduce((l, p) => l.concat(p));
    }

    private async listOwnedPerks(req: Request, res: Response): Promise<void> {
        try {
            const owned = await Promise.all(this.perks().map((p) => p.ownedBy(RedeemTarget.fromUser(req.user))));

            res.status(200).json(owned
                .reduce((l, p) => l.concat(p))
                .filter((o) => !!o)
                .filter((p, idx, self) => self.findIndex((o) => p.equals(o)) === idx)
                .map((p: OwnedPerk) => ({
                    type: p.type,
                    text: p.asString(),
                })));
        } catch (e) {
            if (e instanceof DiscordAPIError && e.code === RESTJSONErrorCodes.UnknownMember && this.config.app.community?.discord) {
                res.redirect(this.config.app.community.discord);
                return;
            }
            throw e;
        }
    }
}
