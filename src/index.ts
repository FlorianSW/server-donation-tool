import 'reflect-metadata';
import express, {Express} from 'express';
import path from 'path';
import session from 'express-session';
import {translate} from './translations';
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
import {Payment} from './domain/payment';
import {SQLiteSubscriptionsRepository} from './adapter/subscriptions-repository';
import {RedeemPackage} from './service/redeem-package';
import {Subscriptions} from './service/subscriptions';
import {SubscriptionsController} from './adapter/controller/subscriptions';
import {paypalClient} from './adapter/paypal/client';
import {Theming} from './service/theming';

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
container.register('PayPalClient', {
    useFactory: (c) => paypalClient(c.resolve('AppConfig'))
});
container.registerSingleton('DiscordRoleRepository', SQLiteDiscordRoleRepository);
container.registerSingleton('Closeable', 'DiscordRoleRepository');
container.registerSingleton('OrderRepository', SQLiteOrderRepository);
container.registerSingleton('Closeable', 'OrderRepository');
container.registerSingleton('SubscriptionPlanRepository', SQLiteSubscriptionPlanRepository);
container.registerSingleton('Closeable', 'SubscriptionPlanRepository');
container.registerSingleton('SubscriptionsRepository', SQLiteSubscriptionsRepository);
container.registerSingleton('Closeable', 'SubscriptionsRepository');

container.registerType('Payment', PaypalPayment);
container.registerType('RedeemPackage', RedeemPackage);
container.registerType('Subscriptions', Subscriptions);
container.registerType('Closeable', DiscordRoleRecorder);
container.registerType('Closeable', ExpireDiscordRole);

parseConfig(log).then(async (config) => {
    log.info('Starting server');
    const app = express();

    const port = config.app.port;
    const start = container.resolve(StartController);
    const donations = container.resolve(DonationController);
    const donators = container.resolve(DonatorsController);
    const authentication = container.resolve(Authentication);
    const statistics = container.resolve(StatisticsController);
    const login = container.resolve(LoginController);
    const privacyPolicy = container.resolve(PrivacyPolicyController);
    const theming = container.resolve(Theming);

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
    app.use(bodyParser.json());
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
    app.use('/', authentication.router);
    app.use('/', statistics.router);
    app.use('/', login.router);
    app.use('/', privacyPolicy.router);

    await initSubscriptions(app);

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
    const payment: Payment = container.resolve('Payment');
    const subscriptions: SubscriptionPlanRepository = container.resolve('SubscriptionPlanRepository');
    const subscriptionPackages = packages.filter((p) => p.subscription !== undefined);
    log.debug('Found ' + subscriptionPackages.length + ' packages that support subscriptions');
    if (subscriptionPackages.length === 0) {
        return;
    }
    log.info('Initializing subscriptions');
    const controller = container.resolve(SubscriptionsController);
    const paypalWebhooks = container.resolve(PaypalWebhooksController);
    app.use('/', controller.router);
    app.use('/', paypalWebhooks.router);

    for (const p of subscriptionPackages) {
        if (p.price.type === PriceType.VARIABLE) {
            log.warn('Variable price package (' + p.id + '; ' + p.name + ') can not be subscribable. Ignoring subscription option');
            p.subscription = undefined;
            continue;
        }
        const plan = await subscriptions.findByPackage(p);
        await subscriptions.save(await payment.persistSubscription(p, plan));
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
