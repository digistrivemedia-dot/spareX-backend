import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppError } from '../../common/errors/app-error';
import {
  type Actor,
  type AuthenticatedRequest,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
} from '../../common/http/auth-decorators';
import { SURFACE_KEY, type Surface } from '../../common/http/surfaces';
import { AdminUsersService } from '../admin-users/admin-users.service';
import { CustomersService } from '../customers/customers.service';
import { RolesService } from '../roles/roles.service';
import type { Session } from '../sessions/sessions.schema';
import { SessionsService } from '../sessions/sessions.service';

const BEARER = /^Bearer (\S+)$/i;

/**
 * Runs before every handler. Endpoints are authenticated unless marked @Public. The session must belong to the
 * controller's surface (a B2C token is useless on admin), the user must still be active, and the user must hold
 * every permission the handler requires.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly adminUsers: AdminUsersService,
    private readonly roles: RolesService,
    private readonly customers: CustomersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    // A controller without a surface decorator and without @Public is a mistake; fail closed.
    const surface = this.reflector.get<Surface | undefined>(SURFACE_KEY, context.getClass());
    if (!surface) throw AppError.unauthenticated();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (!token) throw AppError.unauthenticated();

    const session = await this.sessions.findActiveByToken(token);
    if (!session || session.surface !== surface) throw AppError.unauthenticated();

    const actor = await this.resolveActor(session);
    if (!actor) throw AppError.unauthenticated();

    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );
    if (required && !required.every((permission) => actor.permissions.includes(permission))) {
      throw AppError.forbidden();
    }

    request.auth = { surface, sessionId: session._id, actor };
    await this.sessions.touch(session);
    return true;
  }

  /** The signed-in user, or null when the account is gone or no longer active. */
  private async resolveActor(session: Session): Promise<Actor | null> {
    switch (session.surface) {
      case 'admin': {
        const user = await this.adminUsers.findById(session.userId);
        if (user?.status !== 'active') return null;
        const role = await this.roles.findById(user.roleId);
        return {
          type: 'admin',
          id: user._id,
          name: user.name,
          permissions: role?.permissions ?? [],
        };
      }
      case 'b2c': {
        const customer = await this.customers.findById(session.userId);
        if (customer?.status !== 'active') return null;
        return { type: 'customer', id: customer._id, name: customer.name, permissions: [] };
      }
      case 'b2b':
        // Business users and B2B sign-in arrive in Phase 4; until then no B2B session can exist.
        return null;
    }
  }
}
