import {singleton} from 'tsyringe';
import {Request, Response, Router} from 'express';

@singleton()
export class LoginController {
    public readonly router: Router = Router();

    constructor() {
        this.router.get('/login', this.render.bind(this));
    }

    private async render(req: Request, res: Response) {
        res.render('login', {
            loginRedirect: '/auth/discord/redirect',
            withOpenGraph: true,
        });
    }
}
