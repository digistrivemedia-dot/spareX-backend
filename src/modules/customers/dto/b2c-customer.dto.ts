import { IsBoolean, IsEmail, IsIn, IsString, Length, Matches, ValidateIf } from 'class-validator';

import { EmptyToNull, Trim } from '../../../common/http/transforms';
import { toTenDigitMobile } from '../../../common/phone';
import {
  ADDRESS_LABELS,
  type AddressLabel,
  type Customer,
  type CustomerAddress,
} from '../customers.schema';

const TEN_DIGIT_MOBILE = /^[6-9]\d{9}$/;
// State code, PAN (5 letters, 4 digits, 1 letter), entity number, "Z", check character.
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** The profile fields a customer can change. The mobile number is the login, so it isn't one. */
export class UpdateB2cProfileDto {
  @Trim()
  @IsString()
  @Length(2, 80, { message: 'Enter your full name.' })
  name: string;

  @EmptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsEmail({}, { message: 'Enter an email address like name@example.com, or leave it empty.' })
  email: string | null;

  @EmptyToNull()
  @ValidateIf((_, value) => value !== null)
  @Matches(GSTIN, { message: 'Enter a valid 15-character GSTIN, like 29ABCDE1234F1Z5.' })
  gstin: string | null;
}

/** What the B2C address book sends to create or change an address. */
export class B2cAddressInputDto {
  @IsIn(ADDRESS_LABELS, { message: 'Choose Home, Work or Other.' })
  label: AddressLabel;

  @Trim()
  @IsString()
  @Length(2, 80, { message: 'Enter the name of the person receiving the order.' })
  name: string;

  @Trim()
  @Matches(TEN_DIGIT_MOBILE, { message: 'Enter a 10-digit mobile number, without +91.' })
  mobile: string;

  @Trim()
  @Matches(/^[1-9]\d{5}$/, { message: 'Enter a valid 6-digit PIN code.' })
  pin: string;

  @Trim()
  @IsString()
  @Length(5, 200, { message: 'Enter the house number, building and street.' })
  line1: string;

  @Trim()
  @IsString()
  @Length(2, 100, { message: 'Enter the area or locality.' })
  area: string;

  @Trim()
  @IsString()
  @Length(2, 60, { message: 'Enter the city.' })
  city: string;

  @Trim()
  @IsString()
  @Length(2, 60, { message: 'Enter the state.' })
  state: string;

  @IsBoolean()
  isDefault: boolean;
}

/** The `User` shape in spareXB2C/src/features/auth/types.ts. */
export class B2cUserView {
  id: string;
  name: string;
  /** 10-digit Indian mobile number without the country code. */
  mobile: string;
  email: string | null;
  gstin: string | null;
  createdAt: string;

  static from(customer: Customer): B2cUserView {
    return {
      id: customer._id,
      name: customer.name,
      mobile: toTenDigitMobile(customer.phone),
      email: customer.email,
      gstin: customer.gstin,
      createdAt: customer.createdAt.toISOString(),
    };
  }
}

/** The `Address` shape in spareXB2C/src/features/account/types.ts. */
export class B2cAddressView {
  id: string;
  /** @example Home */
  label: AddressLabel;
  name: string;
  mobile: string;
  pin: string;
  line1: string;
  area: string;
  city: string;
  state: string;
  isDefault: boolean;

  static from(address: CustomerAddress): B2cAddressView {
    return {
      id: address._id,
      label: address.label,
      name: address.name,
      mobile: toTenDigitMobile(address.phone),
      pin: address.pincode,
      line1: address.line1,
      area: address.area,
      city: address.city,
      state: address.state,
      isDefault: address.isDefault,
    };
  }
}
