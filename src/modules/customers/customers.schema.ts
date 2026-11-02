import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { baseSchemaOptions, newId, subSchemaOptions } from '../../common/database/base-schema';

export const CUSTOMER_STATUSES = ['active', 'inactive', 'deletion_requested', 'deleted'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const ADDRESS_LABELS = ['Home', 'Work', 'Other'] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];

/** A customer has few addresses, so they live inside the customer (and change atomically with it). */
export const MAX_ADDRESSES = 20;

@Schema({ ...subSchemaOptions })
export class CustomerAddress {
  @Prop({ type: String, default: () => newId('adr') })
  _id: string;

  @Prop({ type: String, enum: ADDRESS_LABELS, required: true })
  label: AddressLabel;

  /** The person receiving deliveries at this address. */
  @Prop({ required: true, trim: true })
  name: string;

  /** E.164. */
  @Prop({ required: true })
  phone: string;

  /** House, building and street. */
  @Prop({ required: true, trim: true })
  line1: string;

  /** Area or locality. */
  @Prop({ required: true, trim: true })
  area: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  state: string;

  @Prop({ required: true, match: /^[1-9]\d{5}$/ })
  pincode: string;

  @Prop({ required: true, default: false })
  isDefault: boolean;
}

/** A B2C customer. Signs in with their mobile number; a new number creates the account. */
@Schema({ ...baseSchemaOptions, collection: 'customers', optimisticConcurrency: true })
export class Customer {
  @Prop({ type: String, default: () => newId('cus') })
  _id: string;

  @Prop({ required: true, trim: true })
  name: string;

  /** E.164, e.g. "+919845012345". The sign-in identity, so only one customer per number. */
  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ type: String, default: null, lowercase: true, trim: true })
  email: string | null;

  /** For GST invoices on business purchases. */
  @Prop({ type: String, default: null, uppercase: true, trim: true })
  gstin: string | null;

  @Prop({ type: String, enum: CUSTOMER_STATUSES, required: true, default: 'active' })
  status: CustomerStatus;

  @Prop({ type: [SchemaFactory.createForClass(CustomerAddress)], default: [] })
  addresses: CustomerAddress[];

  @Prop({ type: Date, default: null })
  deletionRequestedAt: Date | null;

  /** Why admin deactivated the account; null while active. */
  @Prop({ type: String, default: null })
  deactivationReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
