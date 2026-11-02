import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { baseSchemaOptions } from '../../common/database/base-schema';
import { ADMIN_PERMISSIONS, type AdminPermission } from '../../common/http/admin-permissions';

/** An admin role. Stored as data so new roles can be added without code changes. */
@Schema({ ...baseSchemaOptions, collection: 'roles' })
export class Role {
  /** Readable ids ("super-admin", "admin") because the admin panel's `roleId` uses them. */
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  description: string;

  /** Super Admins must use 2-step verification; for other roles it is optional. */
  @Prop({ required: true })
  twoStepRequired: boolean;

  @Prop({ type: [String], enum: ADMIN_PERMISSIONS, required: true })
  permissions: AdminPermission[];
}

export const RoleSchema = SchemaFactory.createForClass(Role);
