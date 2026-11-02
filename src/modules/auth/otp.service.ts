import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AppError, ErrorCode } from '../../common/errors/app-error';
import { AppConfig } from '../../config/app-config.service';
import { SmsSender } from '../../infra/sms/sms.module';
import { OTP_SEND_WINDOW_SECONDS, OtpCode, type OtpPurpose } from './auth.schema';

type SendInput = {
  purpose: OtpPurpose;
  phone: string;
  /** The admin a 2-step code signs in; omitted for B2C. */
  subjectId?: string;
  message: (code: string) => string;
};

/** A sent code: its id (the admin 2-step challenge id) and when the next one may be asked for. */
export type SentCode = { id: string; resendAfterSeconds: number };

/**
 * One-time SMS codes for B2C sign-in and admin 2-step (B-05). Codes are stored only as HMACs in `otpCodes`, live
 * for OTP_TTL_SECONDS, can be used once, and die after OTP_MAX_ATTEMPTS wrong tries. Sending is limited per number
 * and purpose: one code per OTP_RESEND_SECONDS, and OTP_MAX_SENDS_PER_HOUR per hour.
 */
@Injectable()
export class OtpService {
  constructor(
    @InjectModel(OtpCode.name) private readonly codes: Model<OtpCode>,
    private readonly sms: SmsSender,
    private readonly config: AppConfig,
  ) {}

  /** Sends a new code to `phone`, closing any earlier open code for the same number and purpose. */
  async send({ purpose, phone, subjectId, message }: SendInput): Promise<SentCode> {
    const length = this.config.get('OTP_LENGTH');
    const code = String(randomInt(0, 10 ** length)).padStart(length, '0');
    const ttlSeconds = this.config.get('OTP_TTL_SECONDS');
    const created = await this.codes.create({
      phone,
      purpose,
      subjectId: subjectId ?? null,
      codeHash: this.hash(phone, code),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      demoCode: this.config.exposesDemoCodes ? code : null,
    });
    // The limits are checked after inserting, counting the new code: two requests at the same moment then each
    // see the other, so the limits can be undershot under a race but never exceeded.
    try {
      await this.enforceLimits(created);
    } catch (error) {
      await this.codes.deleteOne({ _id: created._id });
      throw error;
    }
    await this.codes.updateMany(
      { phone, purpose, _id: { $ne: created._id }, closedAt: null },
      { $set: { closedAt: new Date() } },
    );
    await this.sms.send(phone, message(code));
    return { id: created._id, resendAfterSeconds: this.config.get('OTP_RESEND_SECONDS') };
  }

  /** The open, unexpired code with this id, or null. Used for the admin 2-step challenge. */
  findOpen(purpose: OtpPurpose, id: string): Promise<OtpCode | null> {
    return this.codes
      .findOne({ _id: id, purpose, closedAt: null, expiresAt: { $gt: new Date() } })
      .lean<OtpCode>();
  }

  /** Checks a code against the latest one sent to this number. */
  async verifyLatest(purpose: OtpPurpose, phone: string, code: string): Promise<OtpCode> {
    const latest = await this.codes
      .findOne({ phone, purpose })
      .sort({ createdAt: -1, _id: -1 })
      .lean<OtpCode>();
    if (!latest) throw this.expired();
    return this.verify(latest._id, code);
  }

  /** Checks a code against one challenge. */
  async verifyById(purpose: OtpPurpose, id: string, code: string): Promise<OtpCode> {
    const found = await this.codes.exists({ _id: id, purpose });
    if (!found) throw this.expired();
    return this.verify(id, code);
  }

  /**
   * Counts the try and checks the code. Every step is a single conditional update, so concurrent tries can't
   * exceed the attempt limit and one code can't sign in twice.
   */
  private async verify(id: string, code: string): Promise<OtpCode> {
    const maxAttempts = this.config.get('OTP_MAX_ATTEMPTS');
    const now = new Date();
    const counted = await this.codes
      .findOneAndUpdate(
        { _id: id, closedAt: null, expiresAt: { $gt: now }, attempts: { $lt: maxAttempts } },
        { $inc: { attempts: 1 } },
        { returnDocument: 'after' },
      )
      .lean<OtpCode>();
    if (!counted) {
      const current = await this.codes.findById(id).lean<OtpCode>();
      throw current && current.attempts >= maxAttempts ? this.attemptsExceeded() : this.expired();
    }

    if (this.matches(counted.codeHash, this.hash(counted.phone, code))) {
      const { modifiedCount } = await this.codes.updateOne(
        { _id: id, closedAt: null },
        { $set: { closedAt: now } },
      );
      if (modifiedCount === 0) throw this.expired();
      return counted;
    }
    if (counted.attempts >= maxAttempts) {
      await this.codes.updateOne({ _id: id, closedAt: null }, { $set: { closedAt: now } });
      throw this.attemptsExceeded();
    }
    const left = maxAttempts - counted.attempts;
    throw new AppError(
      ErrorCode.OtpInvalid,
      `The code is incorrect. You have ${left} ${left === 1 ? 'try' : 'tries'} left.`,
    );
  }

  private async enforceLimits(created: OtpCode): Promise<void> {
    const { phone, purpose } = created;
    const resendSeconds = this.config.get('OTP_RESEND_SECONDS');
    if (resendSeconds > 0) {
      const recent = await this.codes
        .findOne({
          phone,
          purpose,
          _id: { $ne: created._id },
          createdAt: { $gt: new Date(created.createdAt.getTime() - resendSeconds * 1000) },
        })
        .sort({ createdAt: -1 })
        .lean<OtpCode>();
      if (recent) {
        const waitMs = recent.createdAt.getTime() + resendSeconds * 1000 - Date.now();
        throw new AppError(
          ErrorCode.OtpResendTooSoon,
          `Wait ${Math.max(1, Math.ceil(waitMs / 1000))} seconds before asking for another code.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    const sentThisHour = await this.codes.countDocuments({
      phone,
      purpose,
      createdAt: { $gt: new Date(Date.now() - OTP_SEND_WINDOW_SECONDS * 1000) },
    });
    if (sentThisHour > this.config.get('OTP_MAX_SENDS_PER_HOUR')) {
      throw new AppError(
        ErrorCode.OtpSendLimit,
        'Too many codes were sent to this number. Try again in an hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private hash(phone: string, code: string): string {
    return createHmac('sha256', this.config.get('OTP_SECRET'))
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  private matches(storedHash: string, candidateHash: string): boolean {
    const stored = Buffer.from(storedHash, 'hex');
    const candidate = Buffer.from(candidateHash, 'hex');
    return stored.length === candidate.length && timingSafeEqual(stored, candidate);
  }

  private expired(): AppError {
    return new AppError(ErrorCode.OtpExpired, 'This code has expired. Ask for a new one.');
  }

  private attemptsExceeded(): AppError {
    return new AppError(ErrorCode.OtpAttemptsExceeded, 'Too many wrong tries. Ask for a new code.');
  }
}
