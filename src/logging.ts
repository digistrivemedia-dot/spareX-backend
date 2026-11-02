import { randomUUID } from 'node:crypto';

import type { Params } from 'nestjs-pino';

import type { AppConfig } from './config/app-config.service';
import { NodeEnv } from './config/env';

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Never logged: passwords, codes, tokens and session cookies. */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.otp',
  '*.token',
];

/** JSON logs with a request id on every line; readable single lines in development. */
export function loggerOptions(config: AppConfig): Params {
  return {
    pinoHttp: {
      level: config.get('LOG_LEVEL'),
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      // Keeps the caller's id (e.g. from the Next.js server) when it looks safe, so one id spans both logs.
      genReqId: (request, response) => {
        const incoming = request.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
        response.setHeader('x-request-id', id);
        return id;
      },
      autoLogging: { ignore: (request) => request.url === '/health' },
      transport:
        config.get('NODE_ENV') === NodeEnv.Development
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
    },
  };
}
