import 'reflect-metadata';
import express from 'express';
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
import {PaypalPayment} from './adapter/paypal-payment';
import {DiscordRoleRecorder} from './service/discord-role-recorder';
import {ExpireDiscordRole} from './service/expire-discord-role';
import {Logger} from 'winston';
import {StatisticsController} from './adapter/controller/statistics';

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
container.registerType('DiscordRoleRepository', SQLiteDiscordRoleRepository);
container.registerSingleton('Closeable', 'DiscordRoleRepository');
container.registerType('OrderRepository', SQLiteOrderRepository);
container.registerSingleton('Closeable', 'OrderRepository');
container.registerType('Payment', PaypalPayment);
container.registerType('Closeable', DiscordRoleRecorder);
container.registerType('Closeable', ExpireDiscordRole);

let appConfig: AppConfig;
parseConfig(log).then(async (config) => {
    appConfig = config;
    log.info('Starting server');
    const app = express();

    const port = config.app.port;
    const start = container.resolve(StartController);
    const donations = container.resolve(DonationController);
    const donators = container.resolve(DonatorsController);
    const authentication = container.resolve(Authentication);
    const statistics = container.resolve(StatisticsController);

    app.locals.translate = translate;
    app.locals.community = {
        title: config.app.community?.title,
        logoUrl: config.logoUrl(),
        discordUrl: config.app.community?.discord,
    }
    app.locals.nameFromServerApiId = (serverApiId: string) => {
        return config.serverNames[serverApiId] || serverApiId;
    };
    app.locals.supportsSteamLogin = appConfig.steam?.apiKey !== undefined;
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');
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

process.on('SIGINT', async () => {
    log.info('App is shutting down on user event');
    if (container.isRegistered('Closeable')) {
        for (const closeable of container.resolveAll<Closeable>('Closeable')) {
            await closeable.close();
        }
    }
    process.exit(0);
});
