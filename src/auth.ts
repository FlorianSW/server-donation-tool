import {NextFunction, Request, Response, Router} from 'express';
import passport from 'passport';
import {ConnectionInfo, Profile, Strategy as DiscordStrategy} from 'passport-discord';
import {AppConfig} from './domain/app-config';
import {User} from './domain/user';
import {VerifyCallback} from 'passport-oauth2';

export function discordUserCallback(accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) {
    const connection: ConnectionInfo | undefined = profile.connections.find((c) => c.type === 'steam');
    const user: User = {
        username: profile.username,
        discord: {
            id: profile.id,
        },
        priorityQueue: {},
        discordRoles: [],
    };
    if (connection) {
        user.steam = {
            id: connection.id,
        };
    }
    done(null, user);
}

export class Authentication {
    public readonly router: Router = Router();

    constructor(config: AppConfig) {
        passport.serializeUser((user, done) => {
            done(null, user);
        });
        passport.deserializeUser<User>((obj, done) => {
            done(null, obj);
        });

        passport.use(new DiscordStrategy({
            clientID: config.discord.clientId,
            clientSecret: config.discord.clientSecret,
            callbackURL: config.discord.redirectUrl,
            scope: ['identify', 'connections']
        }, discordUserCallback));

        this.router.get('/auth/redirect', passport.authenticate('discord'));
        this.router.get('/auth/error', (req: Request, res: Response) => {
            res.render('login_error');
        });
        this.router.get('/auth/callback', passport.authenticate('discord', {failureRedirect: '/auth/error'}), (req, res) => {
            const afterLoginTarget = req.session.afterLoginTarget;
            if (afterLoginTarget) {
                res.redirect(afterLoginTarget);
            } else {
                res.redirect('/');
            }
        });
        this.router.get('/auth/logout', (req, res) => {
            req.logout();
            res.redirect('/');
        });
    }

}

export function requireAuthentication(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated()) {
        req.session.afterLoginTarget = req.path;
        res.redirect('/auth/redirect');
        return;
    }
    if (!req.user.steam && req.path !== '/missingSteamConnection') {
        res.redirect('/missingSteamConnection');
        return;
    }
    return next();
}
