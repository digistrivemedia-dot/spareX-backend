import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { baseSchemaOptions, newId } from '../../common/database/base-schema';

export const OTP_PURPOSES = ['b2c-sign-in', 'admin-two-step'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/**
 * The hourly send limit counts a number's codes from the last hour, so each code is kept that long, well past its
 * own expiry, and then removed by the TTL index.
 */
export const OTP_SEND_WINDOW_SECONDS = 60 * 60;

/** One SMS code. Only an HMAC of the code is stored. */
@Schema({ ...baseSchemaOptions, collection: 'otpCodes' })
export class OtpCode {
  /** Also the admin 2-step challenge id, so it is random, not guessable. */
  @Prop({ type: String, default: () => newId('otp') })
  _id: string;

  /** E.164. */
  @Prop({ required: true })
  phone: string;

  @Prop({ type: String, enum: OTP_PURPOSES, required: true })
  purpose: OtpPurpose;

  /** The admin the code signs in, for 2-step; null for B2C, where the phone is the identity. */
  @Prop({ type: String, default: null })
  subjectId: string | null;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true, default: 0, min: 0 })
  attempts: number;

  /** The code works until this time. */
  @Prop({ required: true })
  expiresAt: Date;

  /** Set when the code is used, killed by wrong tries, or replaced by a newer code. */
  @Prop({ type: Date, default: null })
  closedAt: Date | null;

  /** The plain code, kept only when SMS_PROVIDER=console, for the admin login screen's demo hint. */
  @Prop({ type: String, default: null })
  demoCode: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const OtpCodeSchema = SchemaFactory.createForClass(OtpCode);
OtpCodeSchema.index({ phone: 1, purpose: 1, createdAt: -1 });
OtpCodeSchema.index({ createdAt: 1 }, { expireAfterSeconds: OTP_SEND_WINDOW_SECONDS });

/** A password reset link. Only the SHA-256 of the token is stored; the TTL index removes it once expired. */
@Schema({ ...baseSchemaOptions, collection: 'passwordResetTokens' })
export class PasswordResetToken {
  @Prop({ type: String, default: () => newId('prt') })
  _id: string;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  adminUserId: string;

  @Prop({ required: true, expires: 0 })
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const PasswordResetTokenSchema = SchemaFactory.createForClass(PasswordResetToken);
