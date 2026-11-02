import type { AdminUserStatus } from '../../src/modules/admin-users/admin-users.schema';
import { daysAgo } from '../time';

/** The password the admin login screen shows in demo mode, for every demo admin. */
export const DEMO_ADMIN_PASSWORD = 'Demo@1234';

type AdminUserSeed = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  status: AdminUserStatus;
  twoStepEnabled: boolean;
  lastLoginAt: Date;
  createdAt: Date;
};

/** spareXAdmin/src/mocks/admin-users.ts: 2 Super Admins and 4 Admins (one inactive). */
export const ADMIN_USERS: AdminUserSeed[] = [
  {
    _id: 'adm_ravi',
    name: 'Ravi Shankar',
    email: 'ravi@kannaligarage.in',
    phone: '+919845012345',
    roleId: 'super-admin',
    status: 'active',
    twoStepEnabled: true,
    lastLoginAt: daysAgo(0, 9, 12),
    createdAt: daysAgo(180),
  },
  {
    _id: 'adm_priya',
    name: 'Priya Nair',
    email: 'priya@kannaligarage.in',
    phone: '+919880234567',
    roleId: 'super-admin',
    status: 'active',
    twoStepEnabled: true,
    lastLoginAt: daysAgo(1, 18, 40),
    createdAt: daysAgo(176),
  },
  {
    _id: 'adm_kiran',
    name: 'Kiran Gowda',
    email: 'kiran@kannaligarage.in',
    phone: '+919741356789',
    roleId: 'admin',
    status: 'active',
    twoStepEnabled: false,
    lastLoginAt: daysAgo(0, 10, 5),
    createdAt: daysAgo(150),
  },
  {
    _id: 'adm_meera',
    name: 'Meera Iyer',
    email: 'meera@kannaligarage.in',
    phone: '+919900478901',
    roleId: 'admin',
    status: 'active',
    twoStepEnabled: true,
    lastLoginAt: daysAgo(2, 15, 30),
    createdAt: daysAgo(120),
  },
  {
    _id: 'adm_suresh',
    name: 'Suresh Reddy',
    email: 'suresh@kannaligarage.in',
    phone: '+919538590123',
    roleId: 'admin',
    status: 'active',
    twoStepEnabled: false,
    lastLoginAt: daysAgo(4, 11, 20),
    createdAt: daysAgo(95),
  },
  {
    _id: 'adm_ananya',
    name: 'Ananya Bhat',
    email: 'ananya@kannaligarage.in',
    phone: '+919611601234',
    roleId: 'admin',
    status: 'inactive',
    twoStepEnabled: false,
    lastLoginAt: daysAgo(40, 16, 0),
    createdAt: daysAgo(160),
  },
];
