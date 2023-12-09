import {DonationEvents} from '../domain/events';
import {Order} from '../domain/payment';
import {DiscordRolePerk} from '../adapter/perk/discord-role-perk';
import {DiscordRoleRepository} from '../domain/repositories';
import {inject, singleton} from 'tsyringe';
import {Closeable} from '../index';
import {RedeemTarget} from '../domain/package';

@singleton()
export class DiscordRoleRecorder implements Closeable {
    constructor(@inject('DonationEvents') private readonly events: DonationEvents, @inject('DiscordRoleRepository') private readonly repository: DiscordRoleRepository) {
        events.on('successfulRedeem', this.onSuccessfulRedeem.bind(this));
    }

    async onSuccessfulRedeem(target: RedeemTarget, order: Order): Promise<void> {
        const perks = order.reference.p.perks
            .filter((p) => p instanceof DiscordRolePerk)
            .filter((p: DiscordRolePerk) => p.amountInDays !== undefined);

        for (const p of perks as DiscordRolePerk[]) {
            const expires = new Date(order.firstRedeemed);
            expires.setDate(expires.getDate() + p.amountInDays);
            for (const r of p.roles) {
                await this.repository.save({
                    discordUser: target.discordId,
                    roleId: r,
                    expiresAt: expires
                });
            }
        }
    }

    async close(): Promise<void> {
        this.events.off('successfulRedeem', this.onSuccessfulRedeem.bind(this));
    }
}
