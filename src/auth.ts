import {NextFunction, Request, Response, Router} from 'express';
import passport from 'passport';
import {ConnectionInfo, Profile, Strategy as DiscordStrategy} from 'passport-discord';
import {Strategy as SteamStrategy} from 'passport-steam';
import {AppConfig} from './domain/app-config';
import {User} from './domain/user';
import {VerifyCallback} from 'passport-oauth2';
import {inject, singleton} from 'tsyringe';

export function discordUserCallback(accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) {
    const connection: ConnectionInfo | undefined = profile.connections.find((c) => c.type === 'steam');
    const user: User = {
        username: profile.username,
        discord: {
            id: profile.id,
        },
        subscribedPackages: {},
    };
    if (connection) {
        user.steam = {
            id: connection.id,
            name: connection.name,
            source: 'DISCORD'
        };
    }
    done(null, user);
}

interface SteamProfile {
    id: string,
    displayName: string,
}

@singleton()
export class Authentication {
    public readonly router: Router = Router();

    constructor(@inject('AppConfig') config: AppConfig) {
        passport.serializeUser((user, done) => {
            done(null, user);
        });
        passport.deserializeUser<User>((obj, done) => {
            done(null, {
                subscribedPackages: {},
                ...obj,
            });
        });

        passport.use(new DiscordStrategy({
            clientID: config.discord.clientId,
            clientSecret: config.discord.clientSecret,
            callbackURL: config.discord.redirectUrl,
            scope: ['identify', 'connections'],
        }, discordUserCallback));
        this.router.get('/auth/discord/redirect', passport.authenticate('discord'));
        this.router.get('/auth/discord/callback', passport.authenticate('discord', {failureRedirect: '/auth/error'}), this.loginCallback);

        if (config.steam) {
            this.registerSteamLogin(config);
        }

        this.router.get('/auth/error', (req: Request, res: Response) => {
            res.render('login_error');
        });
        this.router.get('/auth/logout', (req, res) => {
            req.logout();
            res.redirect('/');
        });
    }

    private loginCallback(req: Request, res: Response) {
        const afterLoginTarget = req.session.afterLoginTarget;
        if (afterLoginTarget) {
            res.redirect(afterLoginTarget);
        } else {
            res.redirect('/');
        }
    }

    private registerSteamLogin(config: AppConfig) {
        passport.use(new SteamStrategy({
                returnURL: config.steam.redirectUrl,
                realm: config.steam.realm,
                apiKey: config.steam.apiKey,
                passReqToCallback: true,
            },
            (req: Request, identifier: string, profile: SteamProfile, done: any) => {
                const user: User = {
                    ...req.user,
                    steam: {
                        id: profile.id,
                        name: profile.displayName,
                        source: 'STEAM',
                    }
                };
                done(null, user);
            }
        ));

        this.router.get('/auth/steam/redirect', passport.authenticate('steam'));
        this.router.get('/auth/steam/callback', passport.authenticate('steam', {failureRedirect: '/auth/error'}), this.loginCallback);
    }
}

export function requireAuthentication(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated()) {
        req.session.afterLoginTarget = req.path;
        res.redirect('/login');
        return;
    }
    if (!req.user.steam) {
        req.session.afterLoginTarget = req.path;
        res.render('missing_steam_connection');
        return;
    }
    return next();
}
