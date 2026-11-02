import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AdminUsersModule } from '../admin-users/admin-users.module';
import { AuditModule } from '../audit/audit.module';
import { CustomersModule } from '../customers/customers.module';
import { RolesModule } from '../roles/roles.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AdminAccountService } from './admin-account.service';
import { AdminAuthService } from './admin-auth.service';
import { AuthAdminController } from './admin.controller';
import { AuthGuard } from './auth.guard';
import {
  OtpCode,
  OtpCodeSchema,
  PasswordResetToken,
  PasswordResetTokenSchema,
} from './auth.schema';
import { AuthB2cController } from './b2c.controller';
import { B2cAuthService } from './b2c-auth.service';
import { OtpService } from './otp.service';

/** Sign-in for every surface, the global guard, and the admin's own account. Owns the codes and reset links. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OtpCode.name, schema: OtpCodeSchema },
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
    ]),
    AdminUsersModule,
    RolesModule,
    CustomersModule,
    SessionsModule,
    AuditModule,
  ],
  controllers: [AuthAdminController, AuthB2cController],
  providers: [AdminAuthService, AdminAccountService, B2cAuthService, OtpService, AuthGuard],
  exports: [AuthGuard],
})
export class AuthModule {}
