# CyPat Scoreboard — Vercel website

Browser-based CyberPatriot scoreboard. This repository has no Electron dependency, desktop packaging, Python requirement, or database setup. The original desktop app is maintained separately at https://github.com/dicarlocolin/cpsb.

## Run locally

Use Node.js 22. Run `npm ci`, then `npm start`, and open http://localhost:8000. Set `PORT` to change the local port. Run `npm test` for API, activity, history, graph, and timestamp checks. The local server and Vercel Functions use the same API implementation.

## Deploy to Vercel

1. Use this repository: https://github.com/dicarlocolin/cpsb-vercel (branch `main`).
2. Import `dicarlocolin/cpsb-vercel` into Vercel and use `main` as the production branch.
3. Use the repository root as the Root Directory. `vercel.json` selects the **Other** framework preset, serves `public`, and disables the build command. Do not select `public` as the project root: the sibling `api` and `lib` folders are required.
4. Deploy. No environment variables or database credentials are needed.
5. Check `/api/scores`, open a followed team's details, and confirm polling and graph updates on the preview. Then publish/promote the deployment and optionally connect a custom domain in Vercel.

You can also deploy the current branch using `npx vercel` for a preview and `npx vercel --prod` for production. These commands require a Vercel account and may prompt to link a project.

Vercel serves HTML/CSS/JavaScript directly from `public`. `/api/scores` and `/api/team` run as Node.js functions and fetch only fixed CyberPatriot upstream endpoints. The proxy avoids browser cross-origin restrictions. API responses are not cached by the CDN; instance-local caches reduce repeat upstream reads, and scheduled fresh requests bypass them. Optional vulnerability totals support at most 50 followed teams per request and use four concurrent upstream requests. Requests have upstream and overall deadlines.

## Settings, history, and activity

Configure team IDs, aliases, columns, formulas, time zones, refresh interval (15–3600 seconds), and panel height in the interface. Settings persist in browser storage.

The public image-history graph and its summed total come from CyberPatriot. Per-image gaps remain gaps; the summed total carries forward each image's last known score once it first reports. Times default to UTC and can display in the device's local zone.

Observed CCS totals are saved **in this browser**, for followed teams only, with up to seven days / 3,000 points per team (up to 50 teams). They do not sync across devices or visitors and do not import the existing local SQLite database. Removing a team prunes its observed history on the next successful poll. Clearing site data clears observations. If browser storage is blocked or full, current-session observations remain available but may not survive reloads. Preview URLs and custom domains have separate browser storage.

Activity uses the official five-minute Active Teams list. Three consecutive fresh polls with unchanged source play time mark a listed team inactive; a changed time reactivates it. Counters live in the page and reset on reload. Missing/stale activity becomes Unknown; clocks freeze when stale. Inactive team details and optional vulnerability totals pause until activity resumes. Unchanged inactive scores do not create extra history samples, but final score changes are retained.

Polling runs while the page is open and may be throttled in background tabs. No background collection runs when nobody is visiting. Shared or continuous historical collection would require a hosted database and a scheduled collector.

## Public data limitations

Scores are provisional public values and may exclude penalties. Warning codes M/S/T/U are source warnings, not numerical penalties. Overall reflects source ordering. Public APIs are undocumented and may change; failures retain prior displayed data and show an error. The source does not explicitly identify the round. Clear site observations between rounds to avoid mixing history.

Source: https://scoreboard.uscyberpatriot.org/
