import {Events} from '../domain/events';
import {User} from '../domain/user';
import {Order} from '../domain/payment';
import {DiscordRolePerk} from './perk/discord-role-perk';

export class DiscordRoleRecorder {
    constructor(events: Events, private readonly repository: DiscordRoleRepository) {
        events.on('successfulRedeem', this.onSuccessfulRedeem.bind(this));
    }

    async onSuccessfulRedeem(user: User, order: Order): Promise<void> {
        order.reference.p.perks
            .filter((p) => p instanceof DiscordRolePerk)
            .filter((p: DiscordRolePerk) => p.amountInDays !== undefined)
            .forEach((p: DiscordRolePerk) => {
                const expires = new Date();
                expires.setDate(new Date().getDay() + p.amountInDays);
                p.roles.forEach((r) => {
                    this.repository.save({
                        discordUser: user.discord.id,
                        roleId: r,
                        expiresAt: expires
                    });
                });
            });
    }
}

interface ExpiringDiscordRole {
    discordUser: string,
    roleId: string,
    expiresAt: Date,
}

class DiscordRoleRepository {
    async save(role: ExpiringDiscordRole): Promise<void> {
    }
}
