import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import session from 'express-session';
import {translate} from './translations';
import bodyParser from 'body-parser';
import {Authentication} from './auth';
import {DonationController} from './donations/controller';
import passport from 'passport';
import {CFToolsClientBuilder} from 'cftools-sdk';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {AppConfig} from './app-config';
import {StartController} from './start/controller';

dotenv.config();
let config: AppConfig;

try {
    config = yaml.load(fs.readFileSync('config.yml', 'utf8')) as AppConfig;
} catch (e) {
    console.log('Could not load configuration', e);
    process.exit(1);
}

const cftools = new CFToolsClientBuilder()
    .withCredentials(config.cftools.applicationId, config.cftools.secret)
    .build();

const app = express();
const port = config.app.port;
const start = new StartController(cftools, config);
const donations = new DonationController(cftools, config);
const authentication = new Authentication(config);

app.locals.translate = translate;
app.locals.nameFromServerApiId = (serverApiId: string) => {
    return config.serverNames[serverApiId] || serverApiId;
};
app.locals.perks = config.perks;
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
