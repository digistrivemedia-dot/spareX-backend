import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppConfig } from './config/app-config.service';
import { LOCAL_FILES_PATH } from './infra/storage/local-disk.storage';

/** Express "trust proxy" from TRUST_PROXY: "false", "true", a hop count, or a comma list of IPs/CIDRs/names. */
function parseTrustProxy(value: string): boolean | number | string[] {
  if (value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value.split(',').map((part) => part.trim());
}

export const API_PREFIX = 'v1';

/** Everything main.ts and the end-to-end tests both apply to the app. No CORS: no browser calls this API. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);
  app.useLogger(app.get(Logger));
  app.use(helmet());
  // X-Forwarded-For is only believed from these proxies (the web apps' Next.js servers), so rate limits and
  // session IPs use the visitor's address, not the proxy's.
  app.set('trust proxy', parseTrustProxy(config.get('TRUST_PROXY')));
  // /health and the local-disk file links stand outside the versioned API.
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health', `${LOCAL_FILES_PATH}/{*path}`] });
  app.enableShutdownHooks();
}
