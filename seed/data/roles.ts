import { ADMIN_PERMISSIONS, type AdminPermission } from '../../src/common/http/admin-permissions';
import type { Role } from '../../src/modules/roles/roles.schema';

/** Admin has everything except admin users, roles, settings and integrations (Q-01). */
const SUPER_ADMIN_ONLY: readonly AdminPermission[] = [
  'adminUsers.view',
  'adminUsers.manage',
  'roles.view',
  'settings.view',
  'settings.manage',
  'integrations.view',
  'integrations.manage',
];

/** The two roles in spareXAdmin/src/features/auth/permissions.ts. */
export const ROLES: Role[] = [
  {
    _id: 'super-admin',
    name: 'Super Admin',
    description: 'Full control of the platform, including admin users, settings and integrations.',
    twoStepRequired: true,
    permissions: [...ADMIN_PERMISSIONS],
  },
  {
    _id: 'admin',
    name: 'Admin',
    description:
      'Runs day-to-day operations. Cannot manage admin users, roles, settings or integrations.',
    twoStepRequired: false,
    permissions: ADMIN_PERMISSIONS.filter((permission) => !SUPER_ADMIN_ONLY.includes(permission)),
  },
];
