/** Dates are YYYY-MM-DD (UTC) strings. */

export interface DayMetrics {
  views: number;
  uniqueViews: number;
  clones: number;
  uniqueCloners: number;
}

export interface MonthFile {
  schemaVersion: 1;
  repositoryId: number;
  /** YYYY-MM */
  month: string;
  /** Keyed by YYYY-MM-DD. */
  days: Record<string, DayMetrics>;
}

export interface RepoMeta {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  stargazersCount: number;
  forksCount: number;
}

export type ExcludeReason =
  | 'self'
  | 'private'
  | 'fork'
  | 'archived'
  | 'exclude_pattern'
  | 'not_included';

export type Tracking = 'tracked' | `excluded:${ExcludeReason}` | 'missing';

export interface IndexEntry {
  name: string;
  fullName: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  stars: number;
  forks: number;
  tracking: Tracking;
}

export interface IndexFile {
  schemaVersion: 1;
  /** Keyed by repository id. */
  repositories: Record<string, IndexEntry>;
}

export type ErrorKind =
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'transient'
  | 'rate_limited'
  | 'unknown';

export type Outcome = 'ok' | 'partial' | 'fatal' | 'skipped';

export interface RepoStatus {
  lastSuccessDate: string | null;
  lastError: { kind: ErrorKind; date: string } | null;
}

export interface StatusFile {
  schemaVersion: 1;
  dataThroughDate: string | null;
  /** Keyed by repository id. */
  repositories: Record<string, RepoStatus>;
}
