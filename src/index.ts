import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import session from 'express-session';
import {translate} from './translations';
import bodyParser from 'body-parser';
import {Authentication, requireAuthentication} from './auth';
import {DonationController} from './donations/controller';
import passport from 'passport';

dotenv.config();

const app = express();
const port = process.env.PORT;
const donations = new DonationController();
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

app.get('/', requireAuthentication, (req, res) => {
    res.render('index', {
        user: req.user,
        paypalClientId: process.env.PAYPAL_CLIENT_ID,
        paymentStatus: 'UNSTARTED',
    });
});

app.listen(port, () => {
    console.log(`server started at http://localhost:${port}`);
});
