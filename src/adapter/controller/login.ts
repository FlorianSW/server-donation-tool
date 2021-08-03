import {inject, singleton} from 'tsyringe';
import {Request, Response, Router} from 'express';
import {AppConfig} from '../../domain/app-config';

@singleton()
export class LoginController {
    public readonly router: Router = Router();

    constructor(@inject('AppConfig') private readonly config: AppConfig) {
        this.router.get('/login', this.render.bind(this));
    }

    private async render(req: Request, res: Response) {
        res.render('login', {
            loginRedirect: '/auth/discord/redirect',
            withOpenGraph: true,
            absoluteLogoUrl: this.config.logoUrl(req),
        });
    }
}
