import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AppConfig } from '../../config/app-config.service';
import { AdminUser } from './admin-users.schema';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(AdminUser.name) private readonly adminUsers: Model<AdminUser>,
    private readonly config: AppConfig,
  ) {}

  /** The admin with this email (any status), including the password hash, for sign-in and password reset. */
  findByEmail(email: string): Promise<AdminUser | null> {
    return this.adminUsers.findOne({ email: email.trim().toLowerCase() }).lean<AdminUser>();
  }

  /** The admin with this id (any status), or null. */
  findById(id: string): Promise<AdminUser | null> {
    return this.adminUsers.findById(id).lean<AdminUser>();
  }

  /**
   * Counts a wrong password in one atomic update. On the last allowed failure the account locks and the count
   * starts again, so after the lock ends the admin gets the full number of tries. Returns the lock end, if locked.
   */
  async recordFailedSignIn(id: string): Promise<Date | null> {
    const maxFailures = this.config.get('SIGN_IN_MAX_FAILURES');
    const lockUntil = new Date(Date.now() + this.config.get('SIGN_IN_LOCK_MINUTES') * 60_000);
    const reachedLimit = { $gte: [{ $add: ['$failedSignIns', 1] }, maxFailures] };
    const user = await this.adminUsers
      .findOneAndUpdate(
        { _id: id },
        [
          {
            $set: {
              lockedUntil: { $cond: [reachedLimit, lockUntil, '$lockedUntil'] },
              failedSignIns: { $cond: [reachedLimit, 0, { $add: ['$failedSignIns', 1] }] },
            },
          },
        ],
        { returnDocument: 'after', updatePipeline: true },
      )
      .lean<AdminUser>();
    return user?.lockedUntil && user.lockedUntil > new Date() ? user.lockedUntil : null;
  }

  /** Clears failed tries and stamps the sign-in time. */
  async recordSignIn(id: string): Promise<void> {
    await this.adminUsers.updateOne(
      { _id: id },
      { $set: { failedSignIns: 0, lockedUntil: null, lastLoginAt: new Date() } },
    );
  }

  /** Changes the admin's own name and mobile number. */
  updateProfile(id: string, input: { name: string; phone: string }): Promise<AdminUser | null> {
    return this.adminUsers
      .findByIdAndUpdate(id, { $set: input }, { returnDocument: 'after', runValidators: true })
      .lean<AdminUser>();
  }

  /** Stores a new password hash and clears any lock, since the admin has proved who they are. */
  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.adminUsers.updateOne(
      { _id: id },
      { $set: { passwordHash, failedSignIns: 0, lockedUntil: null } },
    );
  }

  /** Turns 2-step verification on or off. */
  setTwoStep(id: string, enabled: boolean): Promise<AdminUser | null> {
    return this.adminUsers
      .findByIdAndUpdate(id, { $set: { twoStepEnabled: enabled } }, { returnDocument: 'after' })
      .lean<AdminUser>();
  }
}
