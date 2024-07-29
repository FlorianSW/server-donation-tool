import {Request, Response, Router} from 'express';
import {AppConfig} from '../../domain/app-config';
import {DonationType, Login, Package, Price, PriceType} from '../../domain/package';
import {Logger} from 'winston';
import csrf from 'csurf';
import {inject, singleton} from 'tsyringe';
import {UserData} from '../../service/user-data';

interface categoryPackage {
    category?: string | undefined,
    packages: Package[],
}

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

        this.router.post('/selectPackage', csrfProtection, this.selectPackage.bind(this));
        this.router.get('/', csrfProtection, this.startPage.bind(this));
    }

    private async startPage(req: Request, res: Response) {
        req.user = await this.data.onRefresh(req.user);

        const packages: categoryPackage[] = [{
            packages: this.packages.filter((p) => !this.config.packageCategories.includes(p.category)),
        }];
        for (let cat of this.config.packageCategories) {
            const p = this.packages.filter((p) => p.category === cat);
            if (p.length === 0) {
                continue
            }
            packages.push({
                category: cat,
                packages: p,
            });
        }

        res.render('steps/package_selection', {
            withOpenGraph: true,
            csrfToken: req.csrfToken(),
            requiredLogins: (p: Package): Login[] => {
                return Array.from(new Set(p.perks.flatMap((p) => p.requiresLogins())));
            },
            showDonationTarget: !!this.config.app.community?.donationTarget?.monthly,
            availablePackages: packages,
            subscribedPackages: req.user?.subscribedPackages || {},
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

        let type = DonationType.OneTime;
        if (req.body['perks-for'] === 'subscribe') {
            type = DonationType.Subscription;
        } else if (req.body['perks-for'] === 'gift') {
            type = DonationType.Gift;
        } else if (req.body['perks-for'] !== 'donate') {
            res.redirect('/');
        }

        try {
            req.session.selectedPackage = {
                id: selectedPackage.id,
                price: this.price(req, selectedPackage),
                perkDetails: {},
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
