import type { AdminUser, AdminUserStatus } from '../admin-users.schema';

/** The `AdminUser` shape in spareXAdmin/src/features/admin-users/types.ts. */
export class AdminUserView {
  id: string;
  name: string;
  email: string;
  /** E.164, e.g. "+919845012345". */
  phone: string;
  roleId: string;
  /** @example active */
  status: AdminUserStatus;
  twoStepEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;

  static from(user: AdminUser): AdminUserView {
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      status: user.status,
      twoStepEnabled: user.twoStepEnabled,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
