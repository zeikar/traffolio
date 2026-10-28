/*
 * DOM-free part of the dashboard's inline script (see client.ts). Tests
 * evaluate it in Node and check it against src/reporter/aggregate.ts.
 * String.raw template: no backticks, no "${", never "</script".
 */

export const CLIENT_LOGIC = String.raw`
// Mirrors src/reporter/aggregate.ts: a date with no stored key is "no data"
// (null), never 0; a multi-repo date where only some repos have a key is
// "partial"; sums cover present days only and are flagged when incomplete.
const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90, all: "all" };
const DAY_MS = 86400000;

function shiftDate(date, delta) {
  return new Date(Date.parse(date + "T00:00:00Z") + delta * DAY_MS).toISOString().slice(0, 10);
}

function enumerateDates(start, end) {
  const dates = [];
  for (let d = start; d <= end; d = shiftDate(d, 1)) dates.push(d);
  return dates;
}

function earliestDate(repos) {
  let min = null;
  for (const repo of repos) {
    for (const d in repo.days) if (min === null || d < min) min = d;
  }
  return min;
}

/** Inclusive range ending at end; "all" starts at the scope's earliest key. */
function periodRange(period, end, repos) {
  if (end === null) return null;
  const length = PERIOD_DAYS[period];
  const start = length === "all" ? earliestDate(repos) : shiftDate(end, 1 - length);
  if (start === null || start > end) return null;
  return { start: start, end: end };
}

/** Sums over the repos that have the key; null when none do. */
function dayPoint(repos, date) {
  let views = 0, uniqueViews = 0, clones = 0, uniqueCloners = 0, present = 0;
  for (const repo of repos) {
    const m = repo.days[date];
    if (!m) continue;
    views += m[0];
    uniqueViews += m[1];
    clones += m[2];
    uniqueCloners += m[3];
    present++;
  }
  if (present === 0) {
    return { date: date, views: null, uniqueViews: null, clones: null, uniqueCloners: null, present: 0, total: repos.length, partial: false };
  }
  return { date: date, views: views, uniqueViews: uniqueViews, clones: clones, uniqueCloners: uniqueCloners, present: present, total: repos.length, partial: present < repos.length };
}

function buildSeries(repos, range) {
  if (range === null) return [];
  return enumerateDates(range.start, range.end).map(function (d) { return dayPoint(repos, d); });
}

function sumSeries(series) {
  let views = 0, clones = 0, presentDays = 0, missingDays = 0, partialDays = 0;
  for (const p of series) {
    if (p.views === null) { missingDays++; continue; }
    views += p.views;
    clones += p.clones;
    presentDays++;
    if (p.partial) partialDays++;
  }
  if (presentDays === 0) return { views: null, clones: null, presentDays: 0, missingDays: missingDays, partialDays: 0 };
  return { views: views, clones: clones, presentDays: presentDays, missingDays: missingDays, partialDays: partialDays };
}

/** README's "*": some days lack data (or some repos), but there is a sum. */
function isIncomplete(sum) {
  return sum.presentDays > 0 && (sum.missingDays > 0 || sum.partialDays > 0);
}

/** Same labels as the README table (src/reporter/readme.ts). */
function statusLabel(repo) {
  if (repo.tracking === "tracked") {
    return repo.lastError ? repo.lastError.kind + " since " + repo.lastError.date : "ok";
  }
  if (repo.tracking === "missing") return "missing";
  return "excluded (" + repo.tracking.slice("excluded:".length) + ")";
}

/** Smallest 1/2/5x10^k step giving at most 4 intervals (as in svg.ts). */
function niceScale(maxValue) {
  const raw = Math.max(maxValue, 4) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map(function (m) { return m * magnitude; }).find(function (s) { return s >= raw; });
  return { step: step, max: step * Math.ceil(Math.max(maxValue, 4) / step) };
}
`;
