import { createHash, randomBytes } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AppError, ErrorCode } from '../../common/errors/app-error';
import type { ActorRef } from '../../common/http/auth-decorators';
import { maskPhone } from '../../common/phone';
import { AppConfig } from '../../config/app-config.service';
import { EmailSender } from '../../infra/email/email.module';
import type { AdminUser } from '../admin-users/admin-users.schema';
import { AdminUsersService } from '../admin-users/admin-users.service';
import { AuditService } from '../audit/audit.service';
import { RolesService } from '../roles/roles.service';
import { type ClientInfo, SessionsService } from '../sessions/sessions.service';
import { PasswordResetToken } from './auth.schema';
import type {
  PasswordResetRequestView,
  SignInResultView,
  TwoStepChallengeView,
} from './dto/admin-auth.dto';
import { OtpService } from './otp.service';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password';

const RESET_TOKEN_BYTES = 32;

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function invalidCredentials(): AppError {
  return new AppError(
    ErrorCode.InvalidCredentials,
    'The email or password is incorrect.',
    HttpStatus.UNAUTHORIZED,
  );
}

function actorOf(user: AdminUser): ActorRef {
  return { type: 'admin', id: user._id, name: user.name };
}

/** Admin sign-in: password, lockout, 2-step codes, sign-out and password reset. */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminUsers: AdminUsersService,
    private readonly roles: RolesService,
    private readonly sessions: SessionsService,
    private readonly otp: OtpService,
    private readonly audit: AuditService,
    @InjectModel(PasswordResetToken.name)
    private readonly resetTokens: Model<PasswordResetToken>,
    private readonly email: EmailSender,
    private readonly config: AppConfig,
  ) {}

  /** Checks the password and either opens a session or starts a 2-step challenge. */
  async signIn(email: string, password: string, client: ClientInfo): Promise<SignInResultView> {
    const user = await this.adminUsers.findByEmail(email);
    if (!user) {
      await verifyAgainstDummy(password);
      throw invalidCredentials();
    }
    // A locked account is rejected before the password is checked, so the lock can't be used to test passwords.
    if (user.lockedUntil && user.lockedUntil > new Date()) throw this.locked(user.lockedUntil);
    if (!(await verifyPassword(user.passwordHash, password))) {
      const lockedUntil = await this.adminUsers.recordFailedSignIn(user._id);
      throw lockedUntil ? this.locked(lockedUntil) : invalidCredentials();
    }
    this.assertActive(user);

    const role = await this.roles.findById(user.roleId);
    if (user.twoStepEnabled || role?.twoStepRequired) {
      return { kind: 'two_step_required', challengeId: await this.startTwoStep(user) };
    }
    return { kind: 'signed_in', token: await this.openSession(user, client) };
  }

  /** The pending challenge, for the "enter the code" screen. */
  async getTwoStepChallenge(challengeId: string): Promise<TwoStepChallengeView> {
    const challenge = await this.otp.findOpen('admin-two-step', challengeId);
    if (!challenge) throw AppError.notFound('This code has expired. Sign in again.');
    return {
      id: challenge._id,
      maskedPhone: maskPhone(challenge.phone),
      expiresAt: challenge.expiresAt.toISOString(),
      demoCode: challenge.demoCode,
    };
  }

  /** Checks the 2-step code and opens the session. */
  async verifyTwoStep(
    challengeId: string,
    code: string,
    client: ClientInfo,
  ): Promise<SignInResultView> {
    const challenge = await this.otp.verifyById('admin-two-step', challengeId, code);
    const user = challenge.subjectId ? await this.adminUsers.findById(challenge.subjectId) : null;
    if (!user) throw invalidCredentials();
    this.assertActive(user);
    return { kind: 'signed_in', token: await this.openSession(user, client) };
  }

  /** Ends this session, so the token stops working even if it was copied. */
  signOut(actor: ActorRef, sessionId: string): Promise<void> {
    return this.sessions.revoke('admin', actor.id, sessionId);
  }

  /**
   * Emails a single-use reset link valid for PASSWORD_RESET_TTL_MINUTES. The response is the same whether or not
   * the email belongs to an active admin.
   */
  async requestPasswordReset(email: string): Promise<PasswordResetRequestView> {
    const user = await this.adminUsers.findByEmail(email);
    if (!user || user.status !== 'active') return { demoToken: null };

    const token = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
    const minutes = this.config.get('PASSWORD_RESET_TTL_MINUTES');
    await this.resetTokens.create({
      tokenHash: hashResetToken(token),
      adminUserId: user._id,
      expiresAt: new Date(Date.now() + minutes * 60_000),
    });
    const link = `${this.config.get('ADMIN_APP_URL')}/reset-password?token=${token}`;
    await this.email.send({
      to: user.email,
      subject: 'Reset your Kannali admin password',
      text: `Hi ${user.name},\n\nUse this link within ${minutes} minutes to choose a new password:\n${link}\n\nIf you didn't ask for this, ignore this email.`,
    });
    return { demoToken: this.config.exposesDemoResetTokens ? token : null };
  }

  /** Sets a new password from a reset link and signs the admin out everywhere. */
  async confirmPasswordReset(token: string, password: string): Promise<void> {
    // Deleting the token as it is read makes the link single-use, even if it is opened twice at once.
    const resetToken = await this.resetTokens
      .findOneAndDelete({ tokenHash: hashResetToken(token), expiresAt: { $gt: new Date() } })
      .lean<PasswordResetToken>();
    const user = resetToken ? await this.adminUsers.findById(resetToken.adminUserId) : null;
    if (!user || user.status !== 'active') {
      throw new AppError(
        ErrorCode.ResetTokenInvalid,
        'This reset link has expired or was already used.',
      );
    }
    await this.adminUsers.setPasswordHash(user._id, await hashPassword(password));
    await this.sessions.revokeAll('admin', user._id);
    await this.audit.record(actorOf(user), {
      action: 'update',
      entity: 'admin_user',
      entityId: user._id,
      entityLabel: user.name,
      summary: 'Reset own password',
      changes: [],
    });
  }

  private async openSession(user: AdminUser, client: ClientInfo): Promise<string> {
    const token = await this.sessions.create('admin', user._id, client);
    await this.adminUsers.recordSignIn(user._id);
    await this.audit.record(actorOf(user), {
      action: 'sign_in',
      entity: 'admin_user',
      entityId: user._id,
      entityLabel: user.name,
      summary: 'Signed in',
      changes: [],
    });
    return token;
  }

  /** The challenge id is the id of the code sent for it. */
  private async startTwoStep(user: AdminUser): Promise<string> {
    const sent = await this.otp.send({
      purpose: 'admin-two-step',
      phone: user.phone,
      subjectId: user._id,
      message: (code) => `${code} is your Kannali admin sign-in code. Don't share it with anyone.`,
    });
    return sent.id;
  }

  private assertActive(user: AdminUser): void {
    if (user.status !== 'active') {
      throw new AppError(
        ErrorCode.AccountInactive,
        'Your account is not active. Contact a Super Admin.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private locked(until: Date): AppError {
    const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
    return new AppError(
      ErrorCode.AccountLocked,
      `Too many wrong passwords. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
    );
  }
}
