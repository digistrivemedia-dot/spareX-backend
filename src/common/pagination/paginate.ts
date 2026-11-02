import type { Model, QueryFilter, SortOrder } from 'mongoose';

import { AppError } from '../errors/app-error';
import { kolkataDayEnd, kolkataDayStart } from '../time';
import type { ListQueryDto } from './list-query.dto';

export type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number };

/** The most rows an unpaginated `<path>/all` export returns. */
export const EXPORT_ROW_LIMIT = 10_000;

export type ListOptions<TDoc> = {
  /** Named filters and ownership, already built by the module. */
  filter: QueryFilter<TDoc>;
  /** API sort field → database path. Each path must have an index. */
  sortable: Record<string, string>;
  defaultSort: { field: string; direction: 'asc' | 'desc' };
  /** Database paths the `q` search matches, case-insensitively. */
  searchPaths?: string[];
  /** The database path `from` / `to` apply to. */
  datePath?: string;
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFilter<TDoc>(query: ListQueryDto, options: ListOptions<TDoc>): QueryFilter<TDoc> {
  const conditions: Record<string, unknown>[] = [options.filter];
  if (query.q && options.searchPaths?.length) {
    const pattern = new RegExp(escapeRegex(query.q.trim()), 'i');
    conditions.push({ $or: options.searchPaths.map((path) => ({ [path]: pattern })) });
  }
  if (options.datePath && (query.from || query.to)) {
    conditions.push({
      [options.datePath]: {
        ...(query.from ? { $gte: kolkataDayStart(query.from) } : {}),
        ...(query.to ? { $lt: kolkataDayEnd(query.to) } : {}),
      },
    });
  }
  return { $and: conditions };
}

function buildSort<TDoc>(
  query: ListQueryDto,
  options: ListOptions<TDoc>,
): Record<string, SortOrder> {
  const [field, direction] = query.sort?.split('.') ?? [
    options.defaultSort.field,
    options.defaultSort.direction,
  ];
  const path = options.sortable[field];
  if (!path) {
    throw AppError.validation({
      sort: [`sort must be one of ${Object.keys(options.sortable).join(', ')}`],
    });
  }
  // _id breaks ties so pages never repeat or skip rows.
  return { [path]: direction === 'asc' ? 1 : -1, _id: 1 };
}

/** One page of a list, in the `{ items, page, pageSize, total }` shape every list endpoint returns. */
export async function paginate<TDoc, TView>(
  model: Model<TDoc>,
  query: ListQueryDto,
  options: ListOptions<TDoc>,
  toView: (doc: TDoc) => TView,
): Promise<Paginated<TView>> {
  const filter = buildFilter(query, options);
  const [docs, total] = await Promise.all([
    model
      .find(filter)
      .sort(buildSort(query, options))
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<TDoc[]>(),
    model.countDocuments(filter),
  ]);
  return { items: docs.map(toView), page: query.page, pageSize: query.pageSize, total };
}

/** Every matching row (capped at `EXPORT_ROW_LIMIT`), for the `<path>/all` CSV export twin of a list. */
export async function listAll<TDoc, TView>(
  model: Model<TDoc>,
  query: ListQueryDto,
  options: ListOptions<TDoc>,
  toView: (doc: TDoc) => TView,
): Promise<TView[]> {
  const docs = await model
    .find(buildFilter(query, options))
    .sort(buildSort(query, options))
    .limit(EXPORT_ROW_LIMIT)
    .lean<TDoc[]>();
  return docs.map(toView);
}
