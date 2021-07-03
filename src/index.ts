import express from 'express';
import path from 'path';
import session from 'express-session';
import {translate} from './translations';
import bodyParser from 'body-parser';
import {Authentication} from './auth';
import passport from 'passport';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {parseConfig} from './app-config';
import {AppConfig} from './domain/app-config';
import {PaypalPayment} from './adapter/paypal-payment';
import {StartController} from './adapter/controller/start';
import {DonationController} from './adapter/controller/donations';

let appConfig: AppConfig;
try {
    parseConfig(yaml.load(fs.readFileSync('config.yml', 'utf8'))).then((config) => {
        appConfig = config;
        const payment = new PaypalPayment(config);
        const app = express();
        const port = config.app.port;
        const start = new StartController(config);
        const donations = new DonationController(config, payment);
        const authentication = new Authentication(config);

        app.locals.translate = translate;
        app.locals.community = {
            title: config.app.community?.title,
            logoUrl: config.app.community ? `/assets/custom/${config.app.community?.logo}` : undefined,
            discordUrl: config.app.community?.discord,
        }
        app.locals.nameFromServerApiId = (serverApiId: string) => {
            return config.serverNames[serverApiId] || serverApiId;
        };
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'ejs');
        app.use('/assets', express.static(__dirname + '/assets'));
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({
            extended: false,
        }));
        app.use(session({
            secret: config.app.sessionSecret,
            resave: false,
            saveUninitialized: true,
        }));
        app.use(passport.initialize());
        app.use(passport.session());

        app.use('/', start.router);
        app.use('/', donations.router);
        app.use('/', authentication.router);

        app.listen(port, () => {
            console.log(`server started at http://localhost:${port}`);
        });
    });
} catch (e) {
    console.log('Could not initialize app', e);
    process.exit(1);
}

process.on('SIGINT', () => {
    console.log('App is shutting down on user event');
    appConfig.destroy();
    process.exit(0);
});
