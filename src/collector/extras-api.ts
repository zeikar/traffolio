import { z } from "zod";
import type { PathEntry, ReferrerEntry } from "../types.js";
import { fetchAllPages, parseBody } from "./github-api.js";
import type { GitHubClient } from "./github-client.js";

// Makes the stargazers listing include `starred_at`.
const STAR_MEDIA_TYPE = "application/vnd.github.star+json";
const PAGE = { per_page: 100, page: 1 };

// Validated up front so a malformed timestamp is a shape error, not a crash while bucketing.
const Timestamp = z.iso.datetime({ offset: true });

// Only the dates are read; user objects in these responses are dropped by the schema.
const Stargazer = z.object({ starred_at: Timestamp });
const Fork = z.object({ created_at: Timestamp });

const Referrer = z.object({ referrer: z.string(), count: z.number(), uniques: z.number() });
const PopularPath = z.object({ path: z.string(), title: z.string(), count: z.number(), uniques: z.number() });

const Release = z.object({
  id: z.number(),
  tag_name: z.string(),
  name: z.string().nullable(),
  draft: z.boolean(),
  published_at: Timestamp.nullable(),
  assets: z.array(z.object({ name: z.string(), download_count: z.number() })),
});

export interface ReleaseItem {
  id: number;
  tag: string;
  name: string | null;
  draft: boolean;
  publishedAt: string | null;
  assets: { name: string; downloadCount: number }[];
}

/** `starred_at` of every current stargazer. */
export async function listStargazerTimestamps(client: GitHubClient, fullName: string): Promise<string[]> {
  const items = await fetchAllPages(client, `/repos/${fullName}/stargazers`, PAGE, Stargazer, { accept: STAR_MEDIA_TYPE });
  return items.map((s) => s.starred_at);
}

/** `created_at` of every existing fork. */
export async function listForkTimestamps(client: GitHubClient, fullName: string): Promise<string[]> {
  const items = await fetchAllPages(client, `/repos/${fullName}/forks`, PAGE, Fork);
  return items.map((f) => f.created_at);
}

export async function getReferrers(client: GitHubClient, fullName: string): Promise<ReferrerEntry[]> {
  const path = `/repos/${fullName}/traffic/popular/referrers`;
  return parseBody(z.array(Referrer), (await client.get(path)).body, path);
}

export async function getPopularPaths(client: GitHubClient, fullName: string): Promise<PathEntry[]> {
  const path = `/repos/${fullName}/traffic/popular/paths`;
  return parseBody(z.array(PopularPath), (await client.get(path)).body, path);
}

export async function listReleases(client: GitHubClient, fullName: string): Promise<ReleaseItem[]> {
  const items = await fetchAllPages(client, `/repos/${fullName}/releases`, PAGE, Release);
  return items.map((r) => ({
    id: r.id,
    tag: r.tag_name,
    name: r.name,
    draft: r.draft,
    publishedAt: r.published_at,
    assets: r.assets.map((a) => ({ name: a.name, downloadCount: a.download_count })),
  }));
}
