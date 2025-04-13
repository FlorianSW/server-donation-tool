import {NextFunction, Request, Response, Router} from 'express';
import passport from 'passport';
import {ConnectionInfo, Profile, Strategy as DiscordStrategy} from 'passport-discord';
import {Strategy as SteamStrategy} from 'passport-steam';
import {AppConfig} from './domain/app-config';
import {Role, User} from './domain/user';
import {VerifyCallback} from 'passport-oauth2';
import {inject, singleton} from 'tsyringe';
import {SteamClient} from './domain/steam-client';
import {Client, DiscordAPIError, RESTJSONErrorCodes} from 'discord.js';
import {Logger} from 'winston';
import {UserData} from './service/user-data';

export async function discordUserCallback(steamClient: SteamClient, accessToken: string, refreshToken: string, profile: Profile, logger: Logger) {
    let steamConnection: ConnectionInfo | undefined;
    let xBoxConnection: ConnectionInfo | undefined;
    let playStationConnection: ConnectionInfo | undefined;

    if (profile.connections) {
        steamConnection = profile.connections.find((c) => c.type === 'steam');
        xBoxConnection = profile.connections.find((c) => c.type === 'xbox');
        playStationConnection = profile.connections.find((c) => c.type === 'playstation');
    }
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
    if (steamConnection) {
        user.steam = {
            id: steamConnection.id,
            name: steamConnection.name,
            source: 'DISCORD'
        };
        try {
            const p = await steamClient.playerProfile(steamConnection.id);
            if (p) {
                user.steam.avatarUrl = p.avatar;
            }
        } catch (e) {
            logger.error("Could not fetch steam profile information", e);
        }
    }
    if (xBoxConnection) {
        user.xbox = {
            id: xBoxConnection.id,
            name: xBoxConnection.name,
            source: 'DISCORD',
        }
    }
    if (playStationConnection) {
        user.playstation = {
            id: playStationConnection.id,
            name: playStationConnection.name,
            source: 'DISCORD',
        }
    }
    return user;
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

    constructor(
        @inject('AppConfig') config: AppConfig,
        @inject('SteamClient') steamClient: SteamClient,
        @inject('discord.Client') client: Client,
        @inject(UserData) data: UserData,
        @inject('Logger') logger: Logger,
    ) {
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
            discordUserCallback(steamClient, accessToken, refreshToken, profile, logger).then((u) => {
                client.guilds.fetch(config.discord.bot.guildId).then((g) => {
                    function next(next: any) {
                        data.onRefresh(u).then((uu: User | undefined) => {
                            if (uu !== undefined) {
                                next(null, uu);
                            } else {
                                next(null, u);
                            }
                        }).catch((e: any) => {
                            logger.error('could not refresh user', {error: e, id: u.discord.id});
                            next(null, u);
                        });
                    }

                    g.members.fetch(u.discord.id).then((gu) => {
                        if (config.discord.roleMapping?.auditor && gu.roles.cache.find((r) => config.discord.roleMapping.auditor.includes(r.id))) {
                            u.roles.push(Role.Auditor);
                        }
                        next(done);
                    }).catch((e) => {
                        if (e instanceof DiscordAPIError && e.code === RESTJSONErrorCodes.UnknownMember) {
                            next(done);
                            return;
                        }
                        logger.error('could not fetch discord role of user', {error: e, id: u.discord.id});
                        next(done);
                    });
                });
            });
        }));
        this.router.get('/auth/discord/redirect', passport.authenticate('discord', {
            keepSessionInfo: true,
            prompt: 'none'
        }));
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
            const afterLoginTarget = req.session.afterLoginTarget;
            req.logout(() => {
                if (afterLoginTarget) {
                    res.redirect(afterLoginTarget.path);
                } else {
                    res.redirect('/');
                }
            });
        });
    }

    private loginCallback(req: Request, res: Response) {
        const afterLoginTarget = req.session.afterLoginTarget;
        if (afterLoginTarget && afterLoginTarget.method === 'GET') {
            res.redirect(afterLoginTarget.path);
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
        req.session.afterLoginTarget = {
            path: req.path,
            method: req.method,
            body: req.body,
        };
        res.redirect('/login');
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
