import {AppConfig, Package, ServerNames} from './domain';
import {PriorityQueuePerk} from './donations/priority-queue-perk';
import {CFToolsClient, CFToolsClientBuilder} from 'cftools-sdk';

class YamlAppConfig implements AppConfig {
    app: { port: number; sessionSecret: string; community: { title: string; logo: string } };
    cftools: { applicationId: string; secret: string };
    discord: { clientId: string; clientSecret: string; redirectUrl: string };
    packages: Package[];
    paypal: { clientId: string; clientSecret: string };
    serverNames: ServerNames;

    cfToolscClient(): CFToolsClient {
        return new CFToolsClientBuilder()
            .withCredentials(this.cftools.applicationId, this.cftools.secret)
            .build();
    }

}

export function parseConfig(config: Object): AppConfig {
    const intermediate = Object.assign(new YamlAppConfig(), config);

    intermediate.packages.forEach((p) => {
        Object.setPrototypeOf(p, Package.prototype);
        for (let i = 0; i < p.perks.length; i++) {
            const perk = p.perks[i];

            perk.inPackage = p;
            if (perk.type === 'PRIORITY_QUEUE') {
                p.perks[i] = Object.assign(new PriorityQueuePerk(intermediate.cfToolscClient(), intermediate.serverNames), perk);
            } else {
                throw new Error('No available provider can redeem perk: ' + perk.type);
            }
        }
    });
    return intermediate;
}
