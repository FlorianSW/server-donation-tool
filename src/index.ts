import express, {NextFunction, Request, Response} from 'express';
import dotenv from 'dotenv';
import path from 'path';
import passport from 'passport';
import {Strategy as DiscordStrategy} from 'passport-discord';
import session from 'express-session';
import {translate} from './translations';

dotenv.config();

const app = express();
const port = process.env.PORT;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/assets', express.static(__dirname + '/assets'));

passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

passport.use(new DiscordStrategy({
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: 'http://localhost:8080/auth/callback',
        scope: ['identify', 'connections']
    }, (accessToken, refreshToken, profile, cb) => {
        const connection = profile.connections.find((c) => c.type === 'steam');
        cb(null, {
            username: profile.username,
            steam: connection,
        });
    })
);

app.locals.translate = translate;
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());
app.get('/auth/redirect', passport.authenticate('discord'));
app.get('/auth/error', (req, res) => {
    res.render('login_error');
});
app.get('/auth/callback', passport.authenticate('discord', {failureRedirect: '/auth/error'}), (req, res) => res.redirect('/'));

function checkAuth(req: Request, res: Response, next: NextFunction) {
    if (req.isAuthenticated()) return next();
    res.redirect('/auth/redirect')
}

app.get('/', checkAuth, (req, res) => {
    res.render('index', {
        user: req.user
    });
});

app.listen(port, () => {
    console.log(`server started at http://localhost:${port}`);
});
