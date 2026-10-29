import type { PathEntry, ReferrerEntry, ReleaseInfo } from "../types.js";
import type { ReleaseItem } from "./extras-api.js";
import { toUtcDate } from "./normalize.js";

/** Number of timestamps on each UTC date. */
export function countByDate(timestamps: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ts of timestamps) {
    const date = toUtcDate(ts);
    counts[date] = (counts[date] ?? 0) + 1;
  }
  return counts;
}

export function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

const byCountThen = (a: { count: number }, b: { count: number }, x: string, y: string): number =>
  b.count - a.count || (x < y ? -1 : x > y ? 1 : 0);

/** Count descending, then name ascending, so equal responses serialize identically. */
export function sortReferrers(entries: ReferrerEntry[]): ReferrerEntry[] {
  return [...entries].sort((a, b) => byCountThen(a, b, a.referrer, b.referrer));
}

export function sortPaths(entries: PathEntry[]): PathEntry[] {
  return [...entries].sort((a, b) => byCountThen(a, b, a.path, b.path));
}

// Updater metadata, signatures and checksums are fetched by tools rather than downloaded by people.
const METADATA_ASSET = /\.(json|ya?ml|sig|asc|blockmap|sha1|sha256|sha512|md5)$/i;
const CHECKSUM_LIST = /(^|[-_.])checksums?\.txt$|^(sha\d*|md5)sums/i;

export function isCountedAsset(name: string): boolean {
  return !METADATA_ASSET.test(name) && !CHECKSUM_LIST.test(name);
}

export interface ReleaseSummary {
  /** Published (non-draft) releases by id. */
  releases: Record<string, ReleaseInfo>;
  /** Release id -> downloads summed over counted assets. */
  downloads: Record<string, number>;
  /** At least one published release has a counted asset. */
  hasCountedAssets: boolean;
}

export function summarizeReleases(items: ReleaseItem[]): ReleaseSummary {
  const summary: ReleaseSummary = { releases: {}, downloads: {}, hasCountedAssets: false };
  for (const item of items) {
    if (item.draft) continue;
    const id = String(item.id);
    summary.releases[id] = {
      tag: item.tag,
      name: item.name ?? "",
      publishedDate: item.publishedAt === null ? null : toUtcDate(item.publishedAt),
    };
    const counted = item.assets.filter((a) => isCountedAsset(a.name));
    if (counted.length > 0) summary.hasCountedAssets = true;
    summary.downloads[id] = counted.reduce((sum, a) => sum + a.downloadCount, 0);
  }
  return summary;
}

/**
 * Stored per-date counts, reused while their total still matches the repository's current count;
 * undefined means the list must be fetched again.
 */
export function reuseIfCurrent(
  stored: Record<string, number> | undefined,
  currentTotal: number,
): Record<string, number> | undefined {
  return stored !== undefined && sumCounts(stored) === currentTotal ? stored : undefined;
}
