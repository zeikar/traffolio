import type { ExcludedRepo } from "../collector/filter.js";
import type {
  ErrorKind,
  IndexEntry,
  IndexFile,
  RepoMeta,
  RepoStatus,
  StatusFile,
  Tracking,
} from "../types.js";

export type RepoResult =
  | {
      repoId: number;
      outcome: "success";
      window: { start: string; end: string } | null;
    }
  | { repoId: number; outcome: "error"; kind: ErrorKind };

function entryFrom(repo: RepoMeta, tracking: Tracking): IndexEntry {
  return {
    name: repo.name,
    fullName: repo.fullName,
    private: repo.private,
    fork: repo.fork,
    archived: repo.archived,
    stars: repo.stargazersCount,
    forks: repo.forksCount,
    tracking,
  };
}

function sortedRecord<T>(map: Map<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of [...map.keys()].sort()) out[key] = map.get(key) as T;
  return out;
}

/**
 * Entry set is selected repos plus repos already in `prev`; an excluded repo
 * absent from `prev` is dropped so never-tracked repos stay out of data/.
 */
export function updateIndex(
  prev: IndexFile | undefined,
  selection: { selected: RepoMeta[]; excluded: ExcludedRepo[] },
): IndexFile {
  const known = prev?.repositories ?? {};
  const next = new Map<string, IndexEntry>();

  for (const repo of selection.selected) {
    next.set(String(repo.id), entryFrom(repo, "tracked"));
  }
  for (const { repo, reason } of selection.excluded) {
    const key = String(repo.id);
    if (key in known) next.set(key, entryFrom(repo, `excluded:${reason}`));
  }
  for (const [key, entry] of Object.entries(known)) {
    if (!next.has(key)) next.set(key, { ...entry, tracking: "missing" });
  }

  return { schemaVersion: 1, repositories: sortedRecord(next) };
}

export function updateStatus(
  prev: StatusFile | undefined,
  results: RepoResult[],
  runDate: string,
): StatusFile {
  const next = new Map<string, RepoStatus>();
  for (const [key, status] of Object.entries(prev?.repositories ?? {})) {
    next.set(key, { ...status });
  }
  let dataThroughDate = prev?.dataThroughDate ?? null;

  for (const result of results) {
    const key = String(result.repoId);
    const status: RepoStatus = next.get(key) ?? {
      lastSuccessDate: null,
      lastError: null,
    };
    if (result.outcome === "error") {
      status.lastError = { kind: result.kind, date: runDate };
    } else {
      status.lastError = null;
      if (result.window) {
        const end = result.window.end;
        status.lastSuccessDate = end;
        if (dataThroughDate === null || end > dataThroughDate) {
          dataThroughDate = end;
        }
      }
    }
    next.set(key, status);
  }

  return {
    schemaVersion: 1,
    dataThroughDate,
    repositories: sortedRecord(next),
  };
}
