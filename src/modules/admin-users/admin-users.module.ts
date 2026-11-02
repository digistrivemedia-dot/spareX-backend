import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AdminUser, AdminUserSchema } from './admin-users.schema';
import { AdminUsersService } from './admin-users.service';

/** Model and service only in Phase 1; the admin users screens arrive in Phase 4. */
@Module({
  imports: [MongooseModule.forFeature([{ name: AdminUser.name, schema: AdminUserSchema }])],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
