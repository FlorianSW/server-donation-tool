import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import session from 'express-session';
import {translate} from './translations';
import bodyParser from 'body-parser';
import {Authentication, requireAuthentication} from './auth';
import {DonationController} from './donations/controller';
import passport from 'passport';
import {CFToolsClientBuilder, SteamId64} from 'cftools-sdk';

dotenv.config();

const cftools = new CFToolsClientBuilder()
    .withServerApiId(process.env.CFTOOLS_SERVER_API_ID)
    .withCredentials(process.env.CFTOOLS_APPLICATION_ID, process.env.CFTOOLS_SECRET)
    .build();

const app = express();
const port = process.env.PORT;
const donations = new DonationController(cftools);
const authentication = new Authentication();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/assets', express.static(__dirname + '/assets'));
app.locals.translate = translate;
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/', donations.router);
app.use('/', authentication.router);

app.get('/', requireAuthentication, async (req, res) => {
    const entry = await cftools.getPriorityQueue({
        // @ts-ignore
        playerId: SteamId64.of(req.user.steam.id)
    });
    if (entry) {
        res.render('priority_already', {
            user: req.user,
            until: entry.expiration,
        });
    } else {
        res.render('index', {
            user: req.user,
            paypalClientId: process.env.PAYPAL_CLIENT_ID,
            paymentStatus: 'UNSTARTED',
            redeemStatus: 'UNSTARTED',
        });
    }
});

app.listen(port, () => {
    console.log(`server started at http://localhost:${port}`);
});
