import type { ErrorKind, Outcome } from "../types.js";

export interface RepoErrorEntry {
  fullName: string;
  outcome: "forbidden" | "transient";
  kind: ErrorKind;
}

export interface SummaryCounts {
  discovered: number;
  selected: number;
  succeeded: number;
  forbidden: number;
  transient: number;
}

export interface SummaryInput {
  /** Exact ISO run start time. The summary is the only output allowed to carry it (§8). */
  runStartedAt: string;
  outcome: Outcome;
  /** Category of a fatal stop or skip (e.g. `missing_token`), never an error message. */
  reason?: string;
  dataThroughDate: string | null;
  /** Absent when the run stopped before repositories were classified. */
  counts?: SummaryCounts;
  perRepoErrors: RepoErrorEntry[];
}

/** `forbidden`, `transient`, or `<outcome> (<kind>)` when the kind is more specific. */
export function repoErrorLabel(entry: Pick<RepoErrorEntry, "outcome" | "kind">): string {
  return entry.kind === entry.outcome ? entry.outcome : `${entry.outcome} (${entry.kind})`;
}

/** Built from names, counts and categories only, so it cannot contain tokens or response bodies. */
export function renderSummary(input: SummaryInput): string {
  const out = [`### Traffolio collect: ${input.outcome}`, "", `- Run started: ${input.runStartedAt}`];
  if (input.reason) out.push(`- Reason: ${input.reason}`);
  if (input.outcome === "ok" || input.outcome === "partial") {
    out.push(`- Data through: ${input.dataThroughDate ?? "no data stored yet"} (UTC)`);
  }
  if (input.counts) {
    const c = input.counts;
    out.push(
      `- Repositories: ${c.discovered} discovered, ${c.selected} selected, ${c.succeeded} succeeded, ` +
        `${c.forbidden} forbidden, ${c.transient} transient`,
    );
  }
  if (input.perRepoErrors.length > 0) {
    out.push("", "#### Repository warnings and errors", "");
    for (const entry of input.perRepoErrors) out.push(`- \`${entry.fullName}\`: ${repoErrorLabel(entry)}`);
  }
  return out.join("\n") + "\n";
}
