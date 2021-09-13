import {Request, Response, Router} from 'express';
import {requireAuthentication} from '../../auth';
import {AppConfig} from '../../domain/app-config';
import {DonationType, Package, Price, PriceType} from '../../domain/package';
import {Logger} from 'winston';
import csrf from 'csurf';
import {inject, singleton} from 'tsyringe';
import {UserData} from '../../service/user-data';

@singleton()
export class StartController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('availablePackages') private readonly packages: Package[],
        @inject(UserData) private readonly data: UserData,
        @inject('Logger') private readonly log: Logger
    ) {
        const csrfProtection = csrf();

        this.router.post('/selectPackage', requireAuthentication, csrfProtection, this.selectPackage.bind(this));
        this.router.get('/', requireAuthentication, csrfProtection, this.startPage.bind(this));
    }

    private async startPage(req: Request, res: Response) {
        req.user = await this.data.onRefresh(req.user);

        res.render('index', {
            user: req.user,
            csrfToken: req.csrfToken(),
            showDonationTarget: !!this.config.app.community?.donationTarget?.monthly,
            availablePackages: this.packages,
            subscribedPackages: req.user.subscribedPackages,
            step: 'PACKAGE_SELECTION',
        });
    }

    private price(req: Request, pack: Package): Price {
        const price = {
            ...pack.price
        };
        if (req.body[`price-${pack.id}`]) {
            if (pack.price.type === PriceType.FIXED) {
                throw Error('VariablePriceForFixedPackage');
            }
            let amount = req.body[`price-${pack.id}`].replace(',', '.');
            if (Math.sign(amount) !== 1) {
                throw new Error('Invalid variable price detected: ' + amount);
            }
            price.amount = amount;
        }
        return price;
    }

    private async selectPackage(req: Request, res: Response) {
        const selectedPackage = this.packages.find((p) => p.id === parseInt(req.body.package));
        if (!selectedPackage || req.user.subscribedPackages[selectedPackage.id] !== undefined) {
            res.redirect('/');
        }

        let forAccount;
        let type = DonationType.OneTime;
        if (req.body['perks-for'] === 'me') {
            forAccount = req.user.steam.id;
        } else if (req.body['perks-for'] === 'other') {
            forAccount = null;
        } else if (req.body['perks-for'] === 'subscribe') {
            forAccount = req.user.steam.id;
            type = DonationType.Subscription;
        } else {
            res.redirect('/');
        }

        try {
            req.session.selectedPackage = {
                id: selectedPackage.id,
                price: this.price(req, selectedPackage),
                forAccount: forAccount,
                type: type,
            };
            res.redirect('/donate');
        } catch (e) {
            if (e.message === 'VariablePriceForFixedPackage') {
                this.log.warn(`Discord user ${req.user.discord.id} requested variable price for fixed package.`);
                res.redirect('/');
            } else {
                throw e;
            }
        }
    }
}
