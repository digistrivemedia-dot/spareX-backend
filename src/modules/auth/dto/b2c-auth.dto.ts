import { IsString, Length, Matches, ValidateIf } from 'class-validator';

import { EmptyToNull, Trim } from '../../../common/http/transforms';
import { B2cUserView } from '../../customers/dto/b2c-customer.dto';

const TEN_DIGIT_MOBILE = /^[6-9]\d{9}$/;

export class RequestOtpDto {
  @Trim()
  @Matches(TEN_DIGIT_MOBILE, { message: 'Enter your 10-digit mobile number.' })
  mobile: string;
}

export class VerifyOtpDto {
  @Trim()
  @Matches(TEN_DIGIT_MOBILE, { message: 'Enter your 10-digit mobile number.' })
  mobile: string;

  @Matches(/^\d{4,10}$/, { message: 'Enter the 6-digit code from the SMS.' })
  otp: string;

  /** Required only for a new number, where it creates the account. */
  @EmptyToNull()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Length(2, 80, { message: 'Tell us your name, so we know what to call you.' })
  name: string | null;
}

/** The `OtpRequest` shape in spareXB2C/src/features/auth/types.ts. */
export class OtpRequestView {
  /** No account yet for this number: the customer gives their name and an account is created. */
  isNewUser: boolean;
  resendAfterSeconds: number;
}

/** The `OtpVerification` shape in spareXB2C/src/features/auth/types.ts. */
export class OtpVerificationView {
  token: string;
  user: B2cUserView;
}

/** The `Session` shape in spareXB2C/src/features/auth/types.ts. */
export class B2cSessionView {
  user: B2cUserView;
}
