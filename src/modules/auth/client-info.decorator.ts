import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { ClientInfo } from '../sessions/sessions.service';

/**
 * Where a sign-in came from. The web apps call from their Next.js servers, so they must forward the visitor's IP
 * (X-Forwarded-For, trusted only from TRUST_PROXY) and User-Agent.
 */
export const Client = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientInfo => {
    const request = context.switchToHttp().getRequest<Request>();
    return { ip: request.ip ?? '', userAgent: request.headers['user-agent'] };
  },
);
