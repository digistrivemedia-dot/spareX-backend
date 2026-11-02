import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { Trim } from '../../../common/http/transforms';
import { normalizeIndianMobile } from '../../../common/phone';
import { NewPassword } from '../password';

const E164_INDIAN_MOBILE = /^\+91[6-9]\d{9}$/;

export class SignInDto {
  @Trim()
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Enter your password.' })
  @MaxLength(128)
  password: string;
}

export class VerifyTwoStepDto {
  @IsString()
  @MaxLength(64)
  challengeId: string;

  @Matches(/^\d{4,10}$/, { message: 'Enter the code from the SMS.' })
  code: string;
}

export class RequestPasswordResetDto {
  @Trim()
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;
}

export class ConfirmPasswordResetDto {
  @IsString()
  @MaxLength(128)
  token: string;

  @NewPassword()
  password: string;
}

export class UpdateAdminProfileDto {
  @Trim()
  @IsString()
  @Length(2, 80, { message: 'Enter your full name.' })
  name: string;

  /** Any common form; stored as E.164. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (normalizeIndianMobile(value) ?? value) : value,
  )
  @Matches(E164_INDIAN_MOBILE, { message: 'Enter a 10-digit mobile number.' })
  phone: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Enter your current password.' })
  @MaxLength(128)
  currentPassword: string;

  @NewPassword()
  newPassword: string;
}

export class SetTwoStepDto {
  @IsBoolean()
  enabled: boolean;
}

/** `{ kind: "signed_in", token }` or `{ kind: "two_step_required", challengeId }`. */
export class SignInResultView {
  /** @example signed_in */
  kind: 'signed_in' | 'two_step_required';
  token?: string;
  challengeId?: string;
}

export class TwoStepChallengeView {
  id: string;
  /** @example +91 98••• ••345 */
  maskedPhone: string;
  expiresAt: string;
  /** Only set locally (SMS_PROVIDER=console), where no SMS is sent. */
  demoCode: string | null;
}

export class PasswordResetRequestView {
  /** Only set locally (EMAIL_PROVIDER=console), where no email is sent. */
  demoToken: string | null;
}
