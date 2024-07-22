import winston from 'winston';
import {ErrorRequestHandler, NextFunction, Request, Response} from 'express';
import {container} from 'tsyringe';

export const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.cli(),
    winston.format.errors({stack: true}),
    winston.format.metadata(),
    winston.format.timestamp({
        format: 'YY-MM-DD HH:MM:SS'
    }),
    winston.format.printf((msg) => {
        return `[${msg.timestamp}][${msg.level}] ${msg.message}`;
    })
);

let level = 'info';
if (process.env.DEBUG) {
    level = 'debug';
}

const log = winston.createLogger({
    transports: [
        new winston.transports.Console({
            level: level,
            format: consoleFormat
        }),
        new winston.transports.File({
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'YY-MM-DD HH:MM:SS',
                }),
                winston.format.metadata(),
                winston.format.json(),
            ),
            level: level,
            filename: 'server.log',
            maxsize: 5 * 1024 * 1024,
            maxFiles: 3,
            tailable: true,
        }),
    ],
});

container.registerInstance('Logger', log);

export const errorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    log.error('Unknown error', err);
    const status = err.status || 500;
    const errorPageFormatHint = req.header('accept');

    if (res.headersSent) {
        return;
    }

    res.status(status);
    if (errorPageFormatHint.indexOf('application/json') !== -1) {
        res.contentType('application/json').send({
            selectedPackage: req.session?.selectedPackage?.id,
            user: {
                steamId: req.user?.steam?.id,
                discordId: req.user?.discord.id,
            },
            lastOrder: {
                id: req.session?.lastOrder?.id,
                transactionId: req.session?.lastOrder?.transactionId,
            }
        });
    } else if (errorPageFormatHint.indexOf('text/') !== -1) {
        res.render('error', {
            status: status,
            supportInfo: JSON.stringify({
                status: status,
                selectedPackage: req.session?.selectedPackage?.id,
                user: {
                    steamId: req.user?.steam?.id,
                    discordId: req.user?.discord?.id,
                },
                lastOrder: {
                    id: req.session?.lastOrder?.id,
                    transactionId: req.session?.lastOrder?.transactionId,
                }
            })
        });
    } else {
        res.send();
    }
};
