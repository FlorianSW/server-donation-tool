import {NextFunction, Request, Response, Router} from 'express';
import passport from 'passport';
import {ConnectionInfo, Profile, Strategy as DiscordStrategy} from 'passport-discord';
import {Strategy as SteamStrategy} from 'passport-steam';
import {AppConfig} from './domain/app-config';
import {Role, User} from './domain/user';
import {VerifyCallback} from 'passport-oauth2';
import {inject, singleton} from 'tsyringe';
import {SteamClient} from './domain/steam-client';
import {Client} from 'discord.js';

export async function discordUserCallback(steamClient: SteamClient, accessToken: string, refreshToken: string, profile: Profile) {
    const connection: ConnectionInfo | undefined = profile.connections.find((c) => c.type === 'steam');
    const user: User = {
        username: profile.username,
        discord: {
            id: profile.id,
            username: profile.username,
            discriminator: profile.discriminator,
        },
        subscribedPackages: {},
        roles: [],
    };
    if (profile.avatar) {
        user.discord.avatarUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
    }
    if (connection) {
        user.steam = {
            id: connection.id,
            name: connection.name,
            source: 'DISCORD'
        };
        const p = await steamClient.playerProfile(connection.id);
        if (p) {
            user.steam.avatarUrl = p.avatar;
        }
        return user;
    } else {
        return user;
    }
}

interface SteamProfile {
    id: string,
    displayName: string,
    photos: {
        value: string,
    }[],
}

@singleton()
export class Authentication {
    public readonly router: Router = Router();

    constructor(@inject('AppConfig') config: AppConfig, @inject('SteamClient') steamClient: SteamClient, @inject('discord.Client') private readonly client: Client,) {
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
        }, (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
            discordUserCallback(steamClient, accessToken, refreshToken, profile).then((u) => {
                client.guilds.fetch(config.discord.bot.guildId).then((g) => {
                    g.members.fetch(u.discord.id).then((gu) => {
                        if (config.discord.roleMapping?.auditor && gu.roles.cache.find((r) => r.id === config.discord.roleMapping.auditor)) {
                            u.roles.push(Role.Auditor);
                        }
                        done(null, u);
                    });
                });
            });
        }));
        this.router.get('/auth/discord/redirect', passport.authenticate('discord', {keepSessionInfo: true}));
        this.router.get('/auth/discord/callback', passport.authenticate('discord', {
            failureRedirect: '/auth/error',
            keepSessionInfo: true
        }), this.loginCallback);

        if (config.steam) {
            this.registerSteamLogin(config);
        }

        this.router.get('/auth/error', (req: Request, res: Response) => {
            res.render('login_error');
        });
        this.router.get('/auth/logout', (req, res) => {
            req.logout(() => {
                res.redirect('/');
            });
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
                let avatar;
                const photo = profile.photos.find((p) => p.value.includes('full'));
                if (photo) {
                    avatar = photo.value;
                } else if (profile.photos.length !== 0) {
                    avatar = profile.photos[profile.photos.length - 1].value;
                }
                const user: User = {
                    ...req.user,
                    steam: {
                        id: profile.id,
                        name: profile.displayName,
                        avatarUrl: avatar,
                        source: 'STEAM',
                    }
                };
                done(null, user);
            }
        ));

        this.router.get('/auth/steam/redirect', passport.authenticate('steam', {keepSessionInfo: true}));
        this.router.get('/auth/steam/callback', passport.authenticate('steam', {
            failureRedirect: '/auth/error',
            keepSessionInfo: true
        }), this.loginCallback);
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

export function requiresRole(role: Role) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.user.roles.includes(role)) {
            next();
            return;
        }
        res.render('permission_denied');
    }
}
