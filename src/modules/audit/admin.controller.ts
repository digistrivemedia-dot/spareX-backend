import { Body, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';

import { type Actor, CurrentActor, RequirePermission } from '../../common/http/auth-decorators';
import { AdminController } from '../../common/http/surfaces';
import { AuditService } from './audit.service';
import {
  AuditEntryPage,
  AuditEntryView,
  AuditListQueryDto,
  RecordExportDto,
} from './dto/audit.dto';

@AdminController('audit-log')
export class AuditAdminController {
  constructor(private readonly audit: AuditService) {}

  /** The audit log, newest first by default. Filters: entity, action, actor, record. */
  @Get()
  @RequirePermission('auditLog.view')
  list(@Query() query: AuditListQueryDto): Promise<AuditEntryPage> {
    return this.audit.list(query);
  }

  /** Every matching entry (up to 10,000), for CSV export. */
  @Get('all')
  @RequirePermission('auditLog.view', 'data.export')
  listAll(@Query() query: AuditListQueryDto): Promise<AuditEntryView[]> {
    return this.audit.listAll(query);
  }

  /** Records a CSV export made in the panel. */
  @Post()
  @RequirePermission('data.export')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordExport(@CurrentActor() actor: Actor, @Body() body: RecordExportDto): Promise<void> {
    return this.audit.record(actor, body);
  }
}
