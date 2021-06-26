import {Express, NextFunction, Request, Response, Router} from 'express';
import passport from 'passport';
import {Strategy as DiscordStrategy} from 'passport-discord';

export class Authentication {
    public readonly router: Router = Router();

    constructor() {
        passport.serializeUser((user, done) => {
            done(null, user);
        });
        passport.deserializeUser((obj, done) => {
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

        this.router.get('/auth/redirect', passport.authenticate('discord'));
        this.router.get('/auth/error', (req: Request, res: Response) => {
            res.render('login_error');
        });
        this.router.get('/auth/callback', passport.authenticate('discord', {failureRedirect: '/auth/error'}), (req, res) => res.redirect('/'));
    }

}

export function requireAuthentication(req: Request, res: Response, next: NextFunction) {
    if (req.isAuthenticated()) return next();
    res.redirect('/auth/redirect');
}
