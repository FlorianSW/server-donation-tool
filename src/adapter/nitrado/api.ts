export class NitradoApi {
    constructor(private readonly token: string) {
    }

    public async priorityQueueMembers(serverId: string): Promise<string[]> {
        const res = await fetch(`https://api.nitrado.net/services/${serverId}/gameservers`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        if (res.status !== 200) {
            throw new Error('Could not fetch priority queue members from Nitrado API. Status Code: ' + res.status);
        }
        const data: NitradoResponse<GameserverResponse> = await res.json();
        return data.data['gameserver'].settings.general.priority.split('\r\n');
    }

    public async putPriorityQueue(serverId: string, userId: string): Promise<void> {
        const current = await this.priorityQueueMembers(serverId);
        if (!current.includes(userId)) {
            current.push(userId);
        }
        await this.persistPriorityQueue(serverId, current);
    }

    public async deletePriorityQueue(serverId: string, userId: string): Promise<void> {
        let current = await this.priorityQueueMembers(serverId);
        if (current.includes(userId)) {
            current.splice(current.indexOf(userId), 1);
        }
        await this.persistPriorityQueue(serverId, current);
    }

    private async persistPriorityQueue(serverId: string, list: string[]): Promise<void> {
        const res = await fetch(`https://api.nitrado.net/services/${serverId}/gameservers/settings`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                category: 'general',
                key: 'priority',
                value: list.join('\r\n'),
            }),
        });
        if (res.status !== 200) {
            throw new Error('Could not put priority queue members using Nitrado API. Status Code: ' + res.status);
        }
    }
}

interface NitradoResponse<T> {
    status: 'success' | string,
    data: {
        [k: string]: T,
    }
}

interface GameserverResponse {
    settings: {
        general: {
            priority: string,
        },
    },
}

export class NoopNitradoApi {
    public async priorityQueueMembers(serverId: string): Promise<string[]> {
        return [];
    }

    public async putPriorityQueue(serverId: string, userId: string): Promise<void> {
    }

    public async deletePriorityQueue(serverId: string, userId: string): Promise<void> {
    }
}
