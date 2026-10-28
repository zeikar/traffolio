import { createHash } from "node:crypto";
import type { DayMetrics, IndexFile, RepoStatus, StatusFile, Tracking } from "../types.js";
import { CLIENT_SCRIPT } from "./client.js";
import { STYLES } from "./styles.js";

export interface DashboardInput {
  index: IndexFile;
  status: StatusFile;
  /** Stored days per repository id; repos without traffic may be absent. */
  days: Record<string, ReadonlyMap<string, DayMetrics>>;
  /** Where the data was read from, shown in the page header. */
  source: string;
}

/** [views, uniqueViews, clones, uniqueCloners] */
export type DayTuple = [number, number, number, number];

export interface DashboardRepo {
  name: string;
  fullName: string;
  private: boolean;
  tracking: Tracking;
  stars: number;
  forks: number;
  lastError: RepoStatus["lastError"];
  /** Keyed by YYYY-MM-DD, ascending. */
  days: Record<string, DayTuple>;
}

export interface DashboardData {
  dataThroughDate: string | null;
  source: string;
  /** Keyed by repository id. */
  repos: Record<string, DashboardRepo>;
}

/** Compact, key-ordered snapshot of everything the page needs. */
export function toDashboardData(input: DashboardInput): DashboardData {
  const repos: Record<string, DashboardRepo> = {};
  const ids = Object.keys(input.index.repositories).sort((a, b) => Number(a) - Number(b));
  for (const id of ids) {
    const entry = input.index.repositories[id]!;
    const days: Record<string, DayTuple> = {};
    const stored = input.days[id];
    if (stored) {
      for (const date of [...stored.keys()].sort()) {
        const m = stored.get(date)!;
        days[date] = [m.views, m.uniqueViews, m.clones, m.uniqueCloners];
      }
    }
    repos[id] = {
      name: entry.name,
      fullName: entry.fullName,
      private: entry.private,
      tracking: entry.tracking,
      stars: entry.stars,
      forks: entry.forks,
      lastError: input.status.repositories[id]?.lastError ?? null,
      days,
    };
  }
  return { dataThroughDate: input.status.dataThroughDate, source: input.source, repos };
}

const JSON_ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/**
 * JSON safe to place inside a <script> element: these characters only occur
 * inside JSON strings, where the \u escapes parse back to the same text, so
 * no repo name can close the element or start a comment.
 */
function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => JSON_ESCAPES[c]!);
}

const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("base64");

// Hash-pinned CSP: the page can't load anything or run any script but ours,
// even if escaping ever failed.
const CSP = [
  "default-src 'none'",
  `script-src 'sha256-${sha256(CLIENT_SCRIPT)}'`,
  `style-src 'sha256-${sha256(STYLES)}'`,
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/**
 * Self-contained page: static shell + embedded JSON + inline client script
 * that renders everything via textContent. No timestamps, so the same data
 * always yields the same bytes.
 */
export function renderDashboardHtml(input: DashboardInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>Traffolio dashboard</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<header class="top">
<h1>Traffolio</h1>
<p class="meta" id="meta"></p>
<p class="note">Generated locally from <code id="source"></code> &middot; contains private traffic data &mdash; don&rsquo;t commit or publish this file.</p>
</header>
<noscript><p class="panel">Enable JavaScript to view the dashboard.</p></noscript>
<section class="scopebar">
<div class="scope"><h2 id="scope-title"></h2><p id="scope-sub"></p></div>
<div class="actions">
<button type="button" class="btn" id="close" hidden>&times; Back to all repositories</button>
<div class="seg" role="group" aria-label="Period">
<button type="button" data-period="7d">7d</button><button type="button" data-period="30d">30d</button><button type="button" data-period="90d">90d</button><button type="button" data-period="all">All</button>
</div>
</div>
</section>
<section class="cards" id="cards" aria-live="polite"></section>
<section class="panel">
<div class="legend" id="legend"></div>
<div class="chart" id="chart"></div>
</section>
<section class="panel">
<div class="tablebar">
<div class="tabletitle"><h2>Repositories</h2><span id="row-count"></span></div>
<div class="controls">
<input type="search" id="filter" placeholder="Filter by name" aria-label="Filter repositories by name" autocomplete="off">
<label class="check"><input type="checkbox" id="show-all"> <span id="show-all-label"></span></label>
</div>
</div>
<div class="tablewrap">
<table>
<caption class="sr-only">Repositories. Select a row to show its daily chart.</caption>
<thead><tr id="head"></tr></thead>
<tbody id="body"></tbody>
</table>
</div>
<p class="foot"><span class="mark">*</span> Includes days with no stored data, or where some repositories have none; the sum covers only the data we have. &mdash; means no stored data for the period. Select a row to see its daily chart.</p>
</section>
<footer>All dates and windows are UTC. Views and clones are event counts, not unique users.</footer>
</main>
<script type="application/json" id="data">${scriptSafeJson(toDashboardData(input))}</script>
<script>${CLIENT_SCRIPT}</script>
</body>
</html>
`;
}
