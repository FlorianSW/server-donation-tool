import {DonationEvents} from '../domain/events';
import {Order} from '../domain/payment';
import {DiscordRolePerk} from '../adapter/perk/discord-role-perk';
import {DiscordRoleRepository, NitradoPriorityPlayerRepository} from '../domain/repositories';
import {inject, singleton} from 'tsyringe';
import {Closeable} from '../index';
import {RedeemTarget} from '../domain/package';
import {NitradoPriorityQueuePerk} from "../adapter/perk/nitrado-priority-queue-perk";

@singleton()
export class NitradoPriorityRecorder implements Closeable {
    constructor(
        @inject('DonationEvents') private readonly events: DonationEvents,
        @inject('NitradoPriorityPlayerRepository') private readonly repository: NitradoPriorityPlayerRepository
    ) {
        events.on('successfulRedeem', this.onSuccessfulRedeem.bind(this));
    }

    async onSuccessfulRedeem(target: RedeemTarget, order: Order): Promise<void> {
        const perks = order.reference.p.perks
            .filter((p) => p instanceof NitradoPriorityQueuePerk)
            .filter((p: NitradoPriorityQueuePerk) => p.amountInDays !== undefined);

        for (const p of perks as NitradoPriorityQueuePerk[]) {
            const expires = new Date(order.firstRedeemed);
            expires.setDate(expires.getDate() + p.amountInDays);
            let serverIds = p.nitrado.serverId;
            if (!Array.isArray(serverIds)) {
                serverIds = [p.nitrado.serverId as string];
            }
            for (const serverId of serverIds) {
                const gameId = p.nitrado.kind === 'xbox' ? target.gameId.xbox : target.gameId.playstation;
                if (!gameId) {
                    continue
                }
                const e = await this.repository.findForPlayer(serverId, gameId);
                for (let nitradoPlayer of e) {
                    await this.repository.delete(nitradoPlayer);
                }
                await this.repository.save({
                    discordUser: target.gameId.discord,
                    player: gameId,
                    serverId: serverId,
                    expiresAt: expires
                });
            }
        }
    }

    async close(): Promise<void> {
        this.events.off('successfulRedeem', this.onSuccessfulRedeem.bind(this));
    }
}
