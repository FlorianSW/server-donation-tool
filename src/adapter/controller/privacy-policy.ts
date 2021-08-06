import {inject, singleton} from 'tsyringe';
import {Request, Response, Router} from 'express';
import {AppConfig} from '../../domain/app-config';
import fs from 'fs';
import * as util from 'util';

const readFile = util.promisify(fs.readFile);

@singleton()
export class PrivacyPolicyController {
    public readonly router: Router = Router();

    constructor(
        @inject('AppConfig') private readonly config: AppConfig,
    ) {
        this.router.get('/privacy-policy', this.servePrivacyPolicy.bind(this));
    }

    async servePrivacyPolicy(req: Request, res: Response) {
        let policyText = '';
        for (const partial of this.config.app.privacyPolicy.partials) {
            policyText += await readFile(partial);
        }
        res.render('privacy-policy', {
            policy: policyText,
        });
    }
}
