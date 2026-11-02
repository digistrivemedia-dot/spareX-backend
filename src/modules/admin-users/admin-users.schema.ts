import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { baseSchemaOptions, newId } from '../../common/database/base-schema';

export const ADMIN_USER_STATUSES = ['active', 'inactive', 'invited'] as const;
export type AdminUserStatus = (typeof ADMIN_USER_STATUSES)[number];

/** A Kannali staff member who signs in to the admin panel. */
@Schema({ ...baseSchemaOptions, collection: 'adminUsers' })
export class AdminUser {
  @Prop({ type: String, default: () => newId('adm') })
  _id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  /** E.164, e.g. "+919845012345". 2-step codes are sent here. */
  @Prop({ required: true })
  phone: string;

  @Prop({ required: true, ref: 'Role' })
  roleId: string;

  @Prop({ type: String, enum: ADMIN_USER_STATUSES, required: true, default: 'invited' })
  status: AdminUserStatus;

  @Prop({ required: true, default: false })
  twoStepEnabled: boolean;

  /** argon2id. Never leaves this module. */
  @Prop({ required: true })
  passwordHash: string;

  /** Wrong passwords in a row; reset on success. */
  @Prop({ required: true, default: 0, min: 0 })
  failedSignIns: number;

  @Prop({ type: Date, default: null })
  lockedUntil: Date | null;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);
