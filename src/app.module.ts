import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { createValidationPipe } from './common/errors/validation';
import { throttlerOptions } from './common/http/rate-limit';
import { AppConfig } from './config/app-config.service';
import { ConfigModule } from './config/config.module';
import { EmailModule } from './infra/email/email.module';
import { SmsModule } from './infra/sms/sms.module';
import { StorageModule } from './infra/storage/storage.module';
import { loggerOptions } from './logging';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { RolesModule } from './modules/roles/roles.module';
import { SessionsModule } from './modules/sessions/sessions.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({ inject: [AppConfig], useFactory: loggerOptions }),
    MongooseModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        uri: config.get('MONGO_URI'),
        autoIndex: config.get('MONGO_AUTO_INDEX'),
        autoCreate: config.get('MONGO_AUTO_INDEX'),
      }),
    }),
    ThrottlerModule.forRootAsync({ inject: [AppConfig], useFactory: throttlerOptions }),
    StorageModule,
    SmsModule,
    EmailModule,
    HealthModule,
    RolesModule,
    AdminUsersModule,
    CustomersModule,
    SessionsModule,
    AuditModule,
    FilesModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: rate limits are checked before any session lookup.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
})
export class AppModule {}
