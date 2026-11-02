import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, QueryFilter } from 'mongoose';

import type { ActorRef } from '../../common/http/auth-decorators';
import {
  listAll,
  type ListOptions,
  paginate,
  type Paginated,
} from '../../common/pagination/paginate';
import { AuditEntry } from './audit.schema';
import { type AuditInput, type AuditListQueryDto, AuditEntryView } from './dto/audit.dto';

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditEntry.name) private readonly entries: Model<AuditEntry>) {}

  /**
   * Records who did what. Pass the transaction session when the change itself runs in a transaction, so the
   * entry is written if and only if the change is.
   */
  async record(actor: ActorRef, input: AuditInput, session?: ClientSession): Promise<void> {
    const { type, id, name } = actor;
    await this.entries.create([{ ...input, actor: { type, id, name }, at: new Date() }], {
      session,
    });
  }

  /** One page of the audit log. */
  list(query: AuditListQueryDto): Promise<Paginated<AuditEntryView>> {
    return paginate(this.entries, query, this.listOptions(query), (entry) =>
      AuditEntryView.from(entry),
    );
  }

  /** Every matching entry, for CSV export. */
  listAll(query: AuditListQueryDto): Promise<AuditEntryView[]> {
    return listAll(this.entries, query, this.listOptions(query), (entry) =>
      AuditEntryView.from(entry),
    );
  }

  private listOptions(query: AuditListQueryDto): ListOptions<AuditEntry> {
    const filter: QueryFilter<AuditEntry> = {};
    if (query.entity) filter.entity = query.entity;
    if (query.action) filter.action = query.action;
    if (query.actor) filter['actor.id'] = query.actor;
    if (query.record) filter.entityId = query.record;
    return {
      filter,
      sortable: { at: 'at', entity: 'entity', actor: 'actor.name' },
      defaultSort: { field: 'at', direction: 'desc' },
      searchPaths: ['summary', 'entityLabel', 'actor.name'],
      datePath: 'at',
    };
  }
}
