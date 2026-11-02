import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditAdminController } from './admin.controller';
import { AuditEntry, AuditEntrySchema } from './audit.schema';
import { AuditService } from './audit.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: AuditEntry.name, schema: AuditEntrySchema }])],
  controllers: [AuditAdminController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
