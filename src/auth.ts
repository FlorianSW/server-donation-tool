import {Express, NextFunction, Request, Response, Router} from 'express';
import passport from 'passport';
import {Strategy as DiscordStrategy} from 'passport-discord';
import {AppConfig} from './app-config';

export class Authentication {
    public readonly router: Router = Router();

    constructor(config: AppConfig) {
        passport.serializeUser((user, done) => {
            done(null, user);
        });
        passport.deserializeUser((obj, done) => {
            done(null, obj);
        });

        passport.use(new DiscordStrategy({
                clientID: config.discord.clientId,
                clientSecret: config.discord.clientSecret,
                callbackURL: config.discord.redirectUrl,
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
        this.router.get('/auth/logout', (req, res) => {
            req.logout();
            res.redirect('/');
        });
    }

}

export function requireAuthentication(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated()) {
        res.redirect('/auth/redirect');
        return;
    }
    // @ts-ignore
    if (!req.user.steam && req.path !== '/missingSteamConnection') {
        res.redirect('/missingSteamConnection');
        return;
    }
    return next();
}
