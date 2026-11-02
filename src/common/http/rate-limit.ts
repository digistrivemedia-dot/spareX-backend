import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Request } from 'express';

import type { AppConfig } from '../../config/app-config.service';

const AUTH_RATE_LIMIT_KEY = 'sparex:auth-rate-limit';
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Sign-in, OTP and password reset endpoints: stricter limits per IP and per email or phone number. */
export const AuthRateLimit = () => SetMetadata(AUTH_RATE_LIMIT_KEY, true);

function isAuthRoute(context: ExecutionContext): boolean {
  return Reflect.getMetadata(AUTH_RATE_LIMIT_KEY, context.getHandler()) === true;
}

/** The email, mobile or challenge the request is about. Guards run before validation, so this reads raw input. */
function identityOf(request: Request): string | null {
  const body: unknown = request.body;
  if (typeof body !== 'object' || body === null) return null;
  const { email, mobile, challengeId } = body as Record<string, unknown>;
  const identity = [email, mobile, challengeId].find((value) => typeof value === 'string');
  return typeof identity === 'string' ? identity.trim().toLowerCase().slice(0, 254) : null;
}

/**
 * Three limits: every route per IP; auth routes per IP; auth routes per identity. Counters use the throttler's
 * built-in in-memory storage, which is correct while there is one server instance (CLAUDE.md §3).
 */
export function throttlerOptions(config: AppConfig): ThrottlerModuleOptions {
  return {
    throttlers: [
      { name: 'default', ttl: MINUTE_MS, limit: config.get('RATE_LIMIT_PER_MINUTE') },
      {
        name: 'auth',
        ttl: MINUTE_MS,
        limit: config.get('RATE_LIMIT_AUTH_PER_MINUTE'),
        skipIf: (context) => !isAuthRoute(context),
      },
      {
        name: 'auth-identity',
        ttl: HOUR_MS,
        limit: config.get('RATE_LIMIT_AUTH_PER_IDENTITY_PER_HOUR'),
        skipIf: (context) =>
          !isAuthRoute(context) ||
          identityOf(context.switchToHttp().getRequest<Request>()) === null,
        getTracker: (request) => identityOf(request as Request) ?? '',
      },
    ],
  };
}
