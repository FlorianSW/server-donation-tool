import {inject, injectable} from 'tsyringe';
import {Express, NextFunction, Request, Response} from 'express';
import {translate} from '../../translations';
import path from 'path';
import {AppConfig} from '../../domain/app-config';
import {NextHandleFunction} from 'connect';
import fs from 'fs';

@injectable()
export class Theming {
    private readonly themeBasePath: string;
    private readonly localBasePath: string;
    private readonly remoteBasePath: string;

    private readonly globalStyles: string[] = [];

    constructor(@inject('AppConfig') private readonly config: AppConfig) {
        this.themeBasePath = path.join(__dirname, '../../themes/default/');
        this.localBasePath = path.join(__dirname, '../../assets/{type}/default/');
        this.remoteBasePath = path.join('/assets/{type}/default/');

        if (fs.existsSync(path.join(this.localBasePath.replace('{type}', 'css'), 'main.css'))) {
            this.globalStyles.push(this.cssPath('main.css'));
        }
    }

    public setup(app: Express): Express {
        app.locals.translate = translate;
        app.locals.script = (name: string): string => {
            return `<script src="${this.scriptPath(name)}"></script>`;
        };
        app.locals.imagePath = this.imagePath.bind(this);
        app.locals.community = {
            title: this.config.app.community?.title,
            logoUrl: this.config.logoUrl(),
            discordUrl: this.config.app.community?.discord,
        };
        app.locals.nameFromServerApiId = (serverApiId: string) => {
            return this.config.serverNames[serverApiId] || serverApiId;
        };
        app.locals.supportsSteamLogin = this.config.steam?.apiKey !== undefined;
        app.locals.googleAnalyticsTrackingId = this.config.app.googleAnalytics?.trackingId;
        app.set('views', this.themeBasePath);
        app.set('view engine', 'ejs');
        app.use(this.renderCssHook());

        return app;
    }

    private scriptPath(name: string): string {
        return path.join(this.remoteBasePath.replace('{type}', 'js'), name).replace(/\\/g, '/');
    }

    private cssPath(name: string): string {
        return path.join(this.remoteBasePath.replace('{type}', 'css'), name).replace(/\\/g, '/');
    }

    private imagePath(name: string): string {
        return path.join(this.remoteBasePath.replace('{type}', 'images'), name).replace(/\\/g, '/');
    }

    private renderCssHook(): NextHandleFunction {
        return (req: Request, res: Response, next: NextFunction) => {
            res.locals.stylesheets = [
                ...this.globalStyles,
            ];

            const original = res.render.bind(res);
            res.render = (view: string, options?: object, callback?: (err: Error, html: string) => void): void => {
                const exists = fs.existsSync(path.join(this.localBasePath.replace('{type}', 'css'), view + '.css'));
                if (exists) {
                    res.locals.stylesheets.push(this.cssPath(view + '.css'));
                }
                original(view, options, (err: Error, html: string) => {
                    if (callback) {
                        callback(err, html);
                        return;
                    }
                    if (err) {
                        throw err;
                    }
                    res.status(200).contentType('html').send(html);
                });
            };
            next();
        };
    }
}
