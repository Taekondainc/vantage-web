# Vantage Web

Public website and no-login web app for **Vantage**.

- **Site:** `/` — product page
- **Web app:** `/app` — GitHub OAuth, reports, tasks, and project-lead review

Private GitHub, Jira/Linear, and yearly exports stay in the [desktop app](https://github.com/Taekondainc/vantage-releases).

## Stack

- React + Vite (port 5175)
- Hono API (port 8787)
- Groq for objective drafting (`GROQ_API_KEY`)
- Public GitHub API for month reports (optional `GITHUB_TOKEN` for a higher rate limit)
- File-backed project store (`data/store.json`) until Supabase is configured
- Supabase Postgres for users, sessions, projects, reports, and recommendations

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5175

## Supabase

Cloud project data lives in Supabase when both env vars are set. Until then the API keeps using `data/store.json`.

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/migrations/20260904120000_init_cloud.sql`.
3. In **Project Settings → API**, copy the project URL and the **service_role** key into `.env`:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

4. Restart the API. `GET /api/health` should show `"supabaseConfigured": true` and `"supabase": true`.

The browser never talks to Supabase. GitHub OAuth still issues Vantage sessions; the API stores those rows with the service role (RLS is on, so the anon key cannot read this data).

## Cloudinary

Report files and evidence packs upload to Cloudinary. Supabase only stores the link, name, owner, and size.

Set one of:

```
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

or:

```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

`GET /api/health` should then include `"cloudinary": true`.

## API

| Endpoint | Method |
|----------|--------|
| `/api/health` | GET |
| `/api/resolve-scope` | POST `{ text }` |
| `/api/generate` | POST `{ text, kind, repo?, branchName? }` |
| `/api/github/:username` | GET |
| `/api/github/:username/:year/:month` | GET |
| `/api/auth/github` | GET (redirect OAuth, when client secret is set) |
| `/api/auth/github/callback` | GET |
| `/api/auth/github/device` | POST `{ next? }` |
| `/api/auth/github/device/poll` | POST `{ id }` |
| `/api/auth/github-token` | POST `{ accessToken }` |
| `/api/me` | GET |
| `/api/projects` | GET / POST |
