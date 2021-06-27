import express, {NextFunction, Request, Response} from 'express';
import dotenv from 'dotenv';
import path from 'path';
import session from 'express-session';
import {translate} from './translations';
import bodyParser from 'body-parser';
import {Authentication, requireAuthentication} from './auth';
import {DonationController} from './donations/controller';
import passport from 'passport';
import {CFToolsClientBuilder, PriorityQueueItem, ServerApiId, SteamId64} from 'cftools-sdk';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {AppConfig} from './app-config';

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

app.use('/', donations.router);
app.use('/', authentication.router);

function isExpired(p: PriorityQueueItem): boolean {
    if (p.expiration === 'Permanent') {
        return false;
    }
    return p.expiration.getTime() <= new Date().getTime();
}

async function populatePriorityQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    // @ts-ignore
    const steamId = SteamId64.of(req.user.steam.id);
    const servers = new Set(config.perks.map((p) => p.cftools.serverApiId));

    let priority: { [key: string]: any | undefined } = {};
    for (let server of servers) {
        const entry = await cftools.getPriorityQueue({
            playerId: steamId,
            serverApiId: ServerApiId.of(server),
        });
        if (entry === null) {
            priority[server] = {
                active: false,
            };
            continue;
        }
        priority[server] = {
            active: !isExpired(entry),
            expires: entry.expiration,
        }
    }
    // @ts-ignore
    req.user.priorityQueue = priority;
    next();
}

app.get('/', requireAuthentication, populatePriorityQueue, async (req, res) => {
    // @ts-ignore
    const availablePerks = config.perks.filter((p) => !req.user.priorityQueue[p.cftools.serverApiId].active);
    // @ts-ignore
    const serversWithPrio = Object.entries(req.user.priorityQueue).filter((s: [string, object]) => s[1].active);
    res.render('index', {
        user: req.user,
        serversWithPrio: serversWithPrio,
        availablePerks: availablePerks,
        step: 'PERK_SELECTION',
    });
});

app.listen(port, () => {
    console.log(`server started at http://localhost:${port}`);
});
