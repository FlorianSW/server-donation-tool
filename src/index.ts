import 'reflect-metadata';
import express, {Express, NextFunction, Request} from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import {Authentication} from './auth';
import passport from 'passport';
import {parseConfig} from './app-config';
import {AppConfig} from './domain/app-config';
import {StartController} from './adapter/controller/start';
import {DonationController} from './adapter/controller/donations';
import {errorLogger, logger} from 'express-winston';
import compression from 'compression';
import 'express-async-errors';
import {DonatorsController} from './adapter/controller/donators';
import {errorHandler} from './logging';
import {container} from 'tsyringe';
import {EventQueue} from './adapter/event-queue';
import {SQLiteDiscordRoleRepository} from './adapter/discord-role-repository';
import {SQLiteOrderRepository} from './adapter/order-repository';
import {PaypalPayment} from './adapter/paypal/paypal-payment';
import {DiscordRoleRecorder} from './service/discord-role-recorder';
import {ExpireDiscordRole} from './service/expire-discord-role';
import {Logger} from 'winston';
import {StatisticsController} from './adapter/controller/statistics';
import {LoginController} from './adapter/controller/login';
import {PrivacyPolicyController} from './adapter/controller/privacy-policy';
import {PaypalWebhooksController} from './adapter/controller/paypal-webhooks';
import {Package, PriceType} from './domain/package';
import {SQLiteSubscriptionPlanRepository} from './adapter/subscription-plan-repository';
import {SubscriptionPlanRepository} from './domain/repositories';
import {SubscriptionPaymentProvider} from './domain/payment';
import {SQLiteSubscriptionsRepository} from './adapter/subscriptions-repository';
import {RedeemPackage} from './service/redeem-package';
import {StubSubscriptions, Subscriptions} from './service/subscriptions';
import {SubscriptionsController} from './adapter/controller/subscriptions';
import {paypalClient} from './adapter/paypal/client';
import {Theming} from './service/theming';
import {stripeClient} from './adapter/stripe/client';
import {StripePayment} from './adapter/stripe/stripe-payment';
import {AccountController} from './adapter/controller/account';
import {Donations} from './adapter/discord/donations';
import {HttpSteamClient} from './adapter/steam-client';
import {SQLitePropertiesRepository} from './adapter/properties-repository';
import {OrderOverviewController} from './adapter/controller/order-overview';
import {SQLiteNitradoPriorityQueueRepository} from "./adapter/nitrado-priority-repository";
import {StripeWebhooksController} from "./adapter/controller/stripe-webhooks";

export interface Closeable {
    close(): Promise<void>
}

const log = container.resolve<Logger>('Logger');
if (process.env.NODE_ENV !== 'production') {
    log.warn('Running in DEVELOPMENT mode. For better performance, run the application with the environment variable NODE_ENV set to production.');
}

container.register('DonationEvents', {
    useFactory: (c) => c.resolve(EventQueue)
});
container.register('EventSource', {
    useFactory: (c) => c.resolve(EventQueue)
});
container.registerSingleton('DiscordRoleRepository', SQLiteDiscordRoleRepository);
container.registerSingleton('Closeable', 'DiscordRoleRepository');
container.registerSingleton('OrderRepository', SQLiteOrderRepository);
container.registerSingleton('Closeable', 'OrderRepository');
container.registerSingleton('SubscriptionPlanRepository', SQLiteSubscriptionPlanRepository);
container.registerSingleton('Closeable', 'SubscriptionPlanRepository');
container.registerSingleton('SubscriptionsRepository', SQLiteSubscriptionsRepository);
container.registerSingleton('Closeable', 'SubscriptionsRepository');
container.registerSingleton('NitradoPriorityPlayerRepository', SQLiteNitradoPriorityQueueRepository);
container.registerSingleton('Closeable', 'NitradoPriorityPlayerRepository');
container.registerSingleton('Properties', SQLitePropertiesRepository);
container.registerSingleton('Closeable', 'Properties');
container.registerSingleton('SteamClient', HttpSteamClient);

container.registerType('RedeemPackage', RedeemPackage);
container.registerType('Closeable', DiscordRoleRecorder);
container.registerType('Closeable', ExpireDiscordRole);

function setupConditionalDependencies(config: AppConfig) {
    log.info('Initializing dependencies');

    if (config.paypal) {
        container.register('PayPalClient', {
            useFactory: (c) => paypalClient(c.resolve('AppConfig'))
        });
        container.registerType('Subscriptions', Subscriptions);
        container.registerType('SubscriptionPaymentProvider', PaypalPayment);
        container.registerType('Payment', PaypalPayment);
    } else {
        const packages: Package[] = container.resolve('availablePackages');
        if (packages.filter((p) => p.subscription !== undefined).length !== 0) {
            throw new Error('There is at least one package configured as subscribable, however, there is no payment provider that supports subscriptions.');
        }
        container.registerType('Subscriptions', StubSubscriptions);
    }

    if (config.stripe) {
        container.register('StripeClient', {
            useFactory: (c) => stripeClient(c.resolve('AppConfig'))
        });
        container.registerType('Payment', StripePayment);
        container.registerType('SubscriptionPaymentProvider', StripePayment);
    }
}

parseConfig(log).then(async (config) => {
    log.info('Starting server');
    setupConditionalDependencies(config);
    const app = express();

    const port = config.app.port;
    const start = container.resolve(StartController);
    const donations = container.resolve(DonationController);
    const donators = container.resolve(DonatorsController);
    const account = container.resolve(AccountController);
    const authentication = container.resolve(Authentication);
    const statistics = container.resolve(StatisticsController);
    const login = container.resolve(LoginController);
    const privacyPolicy = container.resolve(PrivacyPolicyController);
    const orderOverview = container.resolve(OrderOverviewController);
    const theming = container.resolve(Theming);
    container.resolve(Donations);

    theming.setup(app);
    app.set('trust proxy', 'loopback');
    if (config.app.compressResponse) {
        app.use(compression({
            threshold: 500
        }));
    } else {
        log.warn('Compression disabled as configured');
    }
    app.use('/assets', express.static(__dirname + '/assets'));
    app.use(bodyParser.json({
        verify: (req, res, buf, encoding) => {
            req.rawBody = buf;
        }
    }));
    app.use(bodyParser.urlencoded({
        extended: false,
    }));

    app.use(session({
        secret: config.app.sessionSecret,
        resave: false,
        saveUninitialized: true,
        cookie: {
            path: '/',
            httpOnly: true,
            maxAge: 30 * 60 * 1000, // 30 minutes
            sameSite: 'lax',
            secure: 'auto',
        },
        store: container.resolve('sessionStore'),
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    app.use(logger({
        winstonInstance: log,
        statusLevels: {
            success: 'debug',
            warn: 'warn',
            error: 'error'
        },
        skip: (req, res) => {
            return [404].includes(res.statusCode);
        }
    }));

    app.use('/', start.router);
    app.use('/', donations.router);
    app.use('/', donators.router);
    app.use('/', account.router);
    app.use('/', authentication.router);
    app.use('/', statistics.router);
    app.use('/', login.router);
    app.use('/', privacyPolicy.router);
    app.use('/', orderOverview.router);

    if (container.isRegistered('SubscriptionPaymentProvider')) {
        await initSubscriptions(app);
    }

    app.use(errorHandler);
    app.use(errorLogger({
        winstonInstance: log,
    }));

    app.listen(port, () => {
        log.info(`Server listening on port ${port}`);
    });
}).catch((e) => {
    log.error('Initializing app failed', e);
    process.exit(1);
});

async function initSubscriptions(app: Express) {
    const packages: Package[] = container.resolve('availablePackages');
    const payments: SubscriptionPaymentProvider[] = container.resolveAll('SubscriptionPaymentProvider');
    const subscriptions: SubscriptionPlanRepository = container.resolve('SubscriptionPlanRepository');
    const subscriptionPackages = packages.filter((p) => p.subscription !== undefined);
    log.debug('Found ' + subscriptionPackages.length + ' packages that support subscriptions');
    if (subscriptionPackages.length === 0) {
        return;
    }
    log.info('Initializing subscriptions');
    const controller = container.resolve(SubscriptionsController);
    const paypalWebhooks = container.resolve(PaypalWebhooksController);
    const stripeWebhooks = container.resolve(StripeWebhooksController);
    app.use('/', controller.router);
    app.use('/', paypalWebhooks.router);
    app.use('/', stripeWebhooks.router);

    for (const p of subscriptionPackages) {
        if (p.price.type === PriceType.VARIABLE) {
            log.warn('Variable price package (' + p.id + '; ' + p.name + ') can not be subscribable. Ignoring subscription option');
            p.subscription = undefined;
            continue;
        }
        for (let payment of payments) {
            const plan = await subscriptions.findByPackage(payment.provider(), p);
            await subscriptions.save(await payment.persistSubscription(p, plan));
        }
    }
}

process.on('SIGINT', async () => {
    log.info('App is shutting down on user event');
    if (container.isRegistered('Closeable')) {
        for (const closeable of container.resolveAll<Closeable>('Closeable')) {
            await closeable.close();
        }
    }
    process.exit(0);
});
