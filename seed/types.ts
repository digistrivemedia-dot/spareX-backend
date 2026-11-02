import type { AuditAction, AuditChange, AuditEntity } from '../src/modules/audit/audit.schema';

/** An audit entry as the admin mock writes it: relative day and Kolkata time instead of a fixed date. */
export type AuditSeed = {
  id: string;
  days: number;
  hour: number;
  minute: number;
  actorId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes: AuditChange[];
};
