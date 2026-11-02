import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

import { AppError } from '../errors/app-error';
import type { AdminPermission } from './admin-permissions';
import type { Surface } from './surfaces';

export const IS_PUBLIC_KEY = 'sparex:public';
export const PERMISSIONS_KEY = 'sparex:permissions';

/** Who performed an action: the `ActorRef` shape in spareXAdmin/src/lib/types.ts, as recorded in the audit log. */
export type ActorRef = {
  type: 'admin' | 'customer' | 'business' | 'garage' | 'system';
  id: string;
  name: string;
};

/** The signed-in user as handlers see it. */
export type Actor = ActorRef & { permissions: readonly string[] };

export type RequestAuth = { surface: Surface; sessionId: string; actor: Actor };

export type AuthenticatedRequest = Request & { auth?: RequestAuth };

/** Marks an endpoint (or controller) that needs no session: sign-in, OTP, health. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** The signed-in user must hold every listed permission. */
export const RequirePermission = (...permissions: AdminPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

function requireAuth(context: ExecutionContext): RequestAuth {
  const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>();
  // Only reachable if a handler on a @Public route asks for the actor, which is a programming error.
  if (!auth) throw AppError.unauthenticated();
  return auth;
}

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => requireAuth(context).actor,
);

/** The id of the session this request came from (for "this device" and "log out other devices"). */
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => requireAuth(context).sessionId,
);
