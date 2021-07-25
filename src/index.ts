import express from 'express';
import path from 'path';
import session from 'express-session';
import {translate} from './translations';
import bodyParser from 'body-parser';
import {Authentication} from './auth';
import passport from 'passport';
import {parseConfig} from './app-config';
import {AppConfig} from './domain/app-config';
import {PaypalPayment} from './adapter/paypal-payment';
import {StartController} from './adapter/controller/start';
import {DonationController} from './adapter/controller/donations';
import {errorLogger, logger} from 'express-winston';
import compression from 'compression';
import 'express-async-errors';
import {DonatorsController} from './adapter/controller/donators';
import {errorHandler, log} from './logging';

if (process.env.NODE_ENV !== 'production') {
    log.warn('Running in DEVELOPMENT mode. For better performance, run the application with the environment variable NODE_ENV set to production.');
}

let appConfig: AppConfig;
parseConfig(log).then(async (config) => {
    appConfig = config;
    log.info('Starting server');
    const app = express();

    const payment = new PaypalPayment(config);
    const port = config.app.port;
    const start = new StartController(config, log);
    const donations = new DonationController(config, payment, appConfig.eventSource(), log);
    const donators = new DonatorsController(config, log);
    const authentication = new Authentication(config);

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
        store: await appConfig.sessionStore(),
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
    await appConfig.destroy();
    process.exit(0);
});
