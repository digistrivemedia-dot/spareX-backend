import { Injectable } from '@nestjs/common';

import { AppError, ErrorCode } from '../../common/errors/app-error';
import type { ActorRef } from '../../common/http/auth-decorators';
import type { AdminUser } from '../admin-users/admin-users.schema';
import { AdminUsersService } from '../admin-users/admin-users.service';
import { AdminUserView } from '../admin-users/dto/admin-user.view';
import type { AuditChange } from '../audit/audit.schema';
import { AuditService } from '../audit/audit.service';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import { hashPassword, verifyPassword } from './password';

const onOff = (enabled: boolean) => (enabled ? 'On' : 'Off');

/** The signed-in admin's own account: profile, password and 2-step setting. */
@Injectable()
export class AdminAccountService {
  constructor(
    private readonly adminUsers: AdminUsersService,
    private readonly roles: RolesService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  /** The signed-in admin. */
  async me(actor: ActorRef): Promise<AdminUserView> {
    return AdminUserView.from(await this.load(actor));
  }

  /** Changes the admin's own name and mobile number. */
  async updateProfile(
    actor: ActorRef,
    input: { name: string; phone: string },
  ): Promise<AdminUserView> {
    const before = await this.load(actor);
    const after = await this.adminUsers.updateProfile(before._id, input);
    if (!after) throw AppError.unauthenticated();
    const changes: AuditChange[] = [
      { field: 'Name', before: before.name, after: after.name },
      { field: 'Mobile', before: before.phone, after: after.phone },
    ].filter((change) => change.before !== change.after);
    await this.record(after, 'Updated own profile', changes);
    return AdminUserView.from(after);
  }

  /** Changes the password after checking the current one, and signs out every other device. */
  async changePassword(
    actor: ActorRef,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.load(actor);
    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw AppError.validation(
        { currentPassword: ['Your current password is incorrect.'] },
        'Check the highlighted field.',
      );
    }
    if (currentPassword === newPassword) {
      throw AppError.validation(
        { newPassword: ["Choose a password you haven't used here."] },
        'Check the highlighted field.',
      );
    }
    await this.adminUsers.setPasswordHash(user._id, await hashPassword(newPassword));
    await this.sessions.revokeOthers('admin', user._id, sessionId);
    await this.record(user, 'Changed own password', []);
  }

  /** Turns 2-step verification on or off; it can't be turned off for a role that requires it. */
  async setTwoStep(actor: ActorRef, enabled: boolean): Promise<AdminUserView> {
    const before = await this.load(actor);
    const role = await this.roles.findById(before.roleId);
    if (!enabled && role?.twoStepRequired) {
      throw new AppError(
        ErrorCode.TwoStepRequired,
        `2-step verification is mandatory for ${role.name}.`,
      );
    }
    const after = await this.adminUsers.setTwoStep(before._id, enabled);
    if (!after) throw AppError.unauthenticated();
    await this.record(
      after,
      enabled ? 'Turned on 2-step verification' : 'Turned off 2-step verification',
      [
        {
          field: '2-step verification',
          before: onOff(before.twoStepEnabled),
          after: onOff(enabled),
        },
      ],
    );
    return AdminUserView.from(after);
  }

  private async load(actor: ActorRef): Promise<AdminUser> {
    const user = await this.adminUsers.findById(actor.id);
    // The guard already checked the session; the account can only vanish if deleted mid-request.
    if (!user) throw AppError.unauthenticated();
    return user;
  }

  private record(user: AdminUser, summary: string, changes: AuditChange[]): Promise<void> {
    return this.audit.record(
      { type: 'admin', id: user._id, name: user.name },
      {
        action: 'update',
        entity: 'admin_user',
        entityId: user._id,
        entityLabel: user.name,
        summary,
        changes,
      },
    );
  }
}
