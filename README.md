# Job Link Collector — GitHub Actions version

Checks Jora, Hiredly, and Jobstreet every hour for new "Web Developer, Kuala
Lumpur" job postings using Jina Reader, runs entirely on GitHub's free
runners (no server to maintain), and publishes results to a static dashboard
via GitHub Pages.

## How it fits together

- `collect.js` — one-shot script: calls Jina Reader for each source, filters
  job-posting links, appends new ones to `docs/data/links.json`.
- `.github/workflows/collect.yml` — runs `collect.js` every hour (`cron`) and
  on demand (`workflow_dispatch`), then commits the updated JSON back to the
  repo.
- `docs/index.html` — static dashboard, fetches `docs/data/links.json`
  directly. Served by GitHub Pages.

## 1. Push this to a new repo

```bash
git init
git add .
git commit -m "Job link collector"
git branch -M main
git remote add origin https://github.com/<your-username>/job-link-collector.git
git push -u origin main
```

(A private repo is fine — 2,000 free Actions minutes/month covers this
easily; this job runs in a few seconds, 24 times a day.)

## 2. Add your Jina API key as a repo secret

GitHub repo → **Settings → Secrets and variables → Actions → New repository
secret**:

- Name: `JINA_API_KEY`
- Value: your key from https://jina.ai/reader

Since you pasted this key in a chat earlier, it's worth rotating it in the
Jina dashboard before or after adding it here — treat the old one as
semi-exposed.

## 3. Enable GitHub Pages

**Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`,
folder: `/docs`. Save. GitHub will give you a URL like:

```
https://<your-username>.github.io/job-link-collector/
```

That's your live dashboard. It updates a minute or two after each hourly
workflow run (Pages rebuilds automatically on every push to `main`).

## 4. Test it now

Don't wait for the top of the hour — go to the **Actions** tab → "Collect job
links" workflow → **Run workflow** button. Check the run logs, then refresh
the Pages URL once it finishes.

## 5. Adjusting things

- **Schedule**: edit the `cron` line in `.github/workflows/collect.yml`.
  GitHub cron times are always UTC — e.g. `0 * * * *` is every hour on the
  hour UTC, which is 8 hours behind Malaysia time (so it actually fires at
  :00 MYT too, since MYT = UTC+8 and this fires every hour anyway).
- **Filtering**: each source in `collect.js` has a regex `test()` that keeps
  only real job-posting links. If a site changes its URL structure and stops
  returning new links, check the `errors` array in a run's summary (visible
  in the dashboard status line, or in the Actions run logs).
- **History**: `docs/data/links.json` is the full history, version-controlled
  via git — you get a free audit trail of every hourly run in the commit log.

## Notes on scope

Jora's robots.txt disallows automated access. Running this against Jora via
Jina Reader is a ToS/policy call on your end, not a technical block — worth
checking Jora's terms if you plan to run this long-term rather than just
testing it.
