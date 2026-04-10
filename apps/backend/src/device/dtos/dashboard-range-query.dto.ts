import { IsIn, IsOptional } from 'class-validator';

export const DASHBOARD_RANGES = [
  '1m',
  '5m',
  '1h',
  '2h',
  '5h',
  '12h',
  '1d',
  '1w',
  '1mo',
  '1y',
  'all',
] as const;

export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export class DashboardRangeQueryDto {
  @IsOptional()
  @IsIn(DASHBOARD_RANGES)
  range?: DashboardRange;
}
