# GitHub API notes

Checked 2026-10-28. All planned facts were confirmed; no deviations from the plan.

## API version
- 2026-10-28 https://docs.github.com/en/rest/about-the-rest-api/api-versions : `2026-03-10` is latest, `2022-11-28` still supported. Live check: `X-GitHub-Api-Version: 2026-03-10` returns 200; an unknown version returns 400 listing exactly these two.
- 2026-10-28 https://docs.github.com/en/rest/about-the-rest-api/breaking-changes : 2026-03-10 changes do not touch traffic, `/user/repos` or `/user`. `GET /repos/{owner}/{repo}` only loses the deprecated `use_squash_pr_title_as_default` (the page lists no `has_downloads` removal; we do not use either field). Client sends `X-GitHub-Api-Version: 2026-03-10`.

## Traffic
- 2026-10-28 https://docs.github.com/en/rest/metrics/traffic : `GET /repos/{owner}/{repo}/traffic/views` and `/traffic/clones`; query `per` is `day|week`, default `day`; last 14 days, timestamps at UTC midnight (weeks start Monday).
- Response: `{count, uniques, views|clones: [{timestamp, count, uniques}]}`.
- Fine-grained PAT permission: **Administration: read** (same page).

## Repos
- 2026-10-28 https://docs.github.com/en/rest/repos/repos : `GET /user/repos` and `GET /repos/{owner}/{repo}` need **Metadata: read**.
- `/user/repos`: `per_page` max 100; `affiliation=owner` must not be combined with `type` (verified live: 422 "If you specify visibility or affiliation, you cannot specify type"). Next page via `Link: <...>; rel="next"` (verified live).
- Fields used from the list: `id, name, full_name, private, fork, archived, stargazers_count, forks_count`.
- Self repo (`GET /repos/{GITHUB_REPOSITORY}`, `GITHUB_TOKEN`): `id, private, is_template`.

## Actions
- 2026-10-28 https://github.com/actions/checkout/releases/latest (via `gh api`): latest `v7.0.1` -> use `actions/checkout@v7`.
- 2026-10-28 https://github.com/actions/setup-node/releases/latest (via `gh api`): latest `v7.1.0` -> use `actions/setup-node@v7`.
- 2026-10-28 https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule : cron is UTC, delayed under load at the top of the hour (use a non-zero minute), runs only on the default branch; scheduled workflows in public repos are auto-disabled after 60 days without repo activity.
- 2026-10-28 https://docs.github.com/en/actions/concepts/security/github_token : events from `GITHUB_TOKEN` (e.g. its pushes) do not trigger new workflow runs (except `workflow_dispatch`/`repository_dispatch`). Only `permissions: contents: write` is needed; metadata read is implicit.

## Fixture basis (`per=day`, from Traffolio_MVP.md section 6)
- Measured 2026-10-27 01:48 UTC: 14 contiguous entries, zero days included as `{"count":0,"uniques":0}`; range `2026-10-12` to `2026-10-25`, i.e. ends two UTC days before the run date (today and yesterday absent).
- The window always comes from the response (first to last timestamp), never assumed.
