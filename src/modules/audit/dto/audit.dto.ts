import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import type { ActorRef } from '../../../common/http/auth-decorators';
import { ListQueryDto } from '../../../common/pagination/list-query.dto';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  type AuditAction,
  type AuditChange,
  type AuditEntity,
  type AuditEntry,
} from '../audit.schema';

/** What a module passes to `AuditService.record`; the actor and time are added by the audit service. */
export type AuditInput = {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes: AuditChange[];
};

export class AuditListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(AUDIT_ENTITIES)
  entity?: AuditEntity;

  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: AuditAction;

  /** Actor id, e.g. the signed-in admin for "My activity". */
  @IsOptional()
  @IsString()
  actor?: string;

  /** Record id, for a record's activity timeline. */
  @IsOptional()
  @IsString()
  record?: string;
}

/**
 * What the panel records itself: only CSV exports, which happen in the panel and which the backend can't see. Every
 * other change is recorded by the module that makes it.
 */
export class RecordExportDto {
  @IsIn(['export'])
  action: 'export';

  @IsIn(AUDIT_ENTITIES)
  entity: AuditEntity;

  /** Always empty for an export. */
  @IsIn([''])
  entityId: '';

  @IsString()
  @MaxLength(100)
  entityLabel: string;

  @IsString()
  @MaxLength(300)
  summary: string;

  /** Always empty for an export. */
  @IsArray()
  @IsIn([], { each: true })
  changes: [];
}

class AuditChangeView {
  field: string;
  before: string | null;
  after: string | null;
}

class ActorRefView {
  /** @example admin */
  type: ActorRef['type'];
  id: string;
  name: string;
}

/** The `AuditEntry` shape in spareXAdmin/src/features/audit/types.ts. */
export class AuditEntryView {
  id: string;
  at: string;
  actor: ActorRefView;
  /** @example update */
  action: AuditAction;
  /** @example product */
  entity: AuditEntity;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes: AuditChangeView[];

  static from(entry: AuditEntry): AuditEntryView {
    return {
      id: entry._id,
      at: entry.at.toISOString(),
      actor: { type: entry.actor.type, id: entry.actor.id, name: entry.actor.name },
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      entityLabel: entry.entityLabel,
      summary: entry.summary,
      changes: entry.changes.map(({ field, before, after }) => ({ field, before, after })),
    };
  }
}

export class AuditEntryPage {
  items: AuditEntryView[];
  page: number;
  pageSize: number;
  total: number;
}
