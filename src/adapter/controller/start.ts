import {Request, Response, Router} from 'express';
import {requireAuthentication} from '../../auth';
import {AppConfig} from '../../domain/app-config';
import {Package, Price, PriceType} from '../../domain/package';
import {Logger} from 'winston';
import csrf from 'csurf';
import {inject, singleton} from 'tsyringe';

@singleton()
export class StartController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
        @inject('availablePackages') private readonly packages: Package[],
        @inject('Logger') private readonly log: Logger
    ) {
        const csrfProtection = csrf();

        this.router.post('/selectPackage', requireAuthentication, csrfProtection, this.selectPackage.bind(this));
        this.router.get('/', requireAuthentication, csrfProtection, this.startPage.bind(this));
    }

    private async startPage(req: Request, res: Response) {
        res.render('index', {
            user: req.user,
            csrfToken: req.csrfToken(),
            showDonationTarget: !!this.config.app.community?.donationTarget?.monthly,
            availablePackages: this.packages,
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
        if (!selectedPackage) {
            res.redirect('/');
        }

        try {
            req.session.selectedPackage = {
                id: selectedPackage.id,
                price: this.price(req, selectedPackage),
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
