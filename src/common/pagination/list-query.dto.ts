import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

/** The page sizes the frontends offer (spareXAdmin/src/lib/constants.ts). */
export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** What every list endpoint accepts. Modules extend it with their named filters. */
export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsIn(PAGE_SIZES, { message: `pageSize must be one of ${PAGE_SIZES.join(', ')}` })
  pageSize: number = DEFAULT_PAGE_SIZE;

  /** Free-text search. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** `field.asc` or `field.desc`. */
  @IsOptional()
  @Matches(/^[A-Za-z0-9_]+\.(asc|desc)$/, {
    message: 'sort must look like field.asc or field.desc',
  })
  sort?: string;

  /** First day included, `YYYY-MM-DD` in Asia/Kolkata. */
  @IsOptional()
  @Matches(DAY, { message: 'from must be a date like 2026-10-12' })
  from?: string;

  /** Last day included, `YYYY-MM-DD` in Asia/Kolkata. */
  @IsOptional()
  @Matches(DAY, { message: 'to must be a date like 2026-10-12' })
  to?: string;
}
