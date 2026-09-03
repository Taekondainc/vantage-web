# Vantage Web

Public web app for drafting objectives from a pasted brief — **no login required**.

Paste a project spec, auto-detect repo/branch from scope labels (Source tree, Ref, Codebase, Workline, etc.), and generate a shareable checklist.

## Stack

- **Frontend:** React + Vite (port 5175)
- **API:** Hono on Node (port 8787)
- **AI:** Groq (server-side `GROQ_API_KEY` — never exposed to the browser)

## Quick start

```bash
cd vantage-web
cp .env.example .env   # add your GROQ_API_KEY
npm install
npm run dev
```

Open http://localhost:5175

## API

| Endpoint | Method | Body |
|----------|--------|------|
| `/api/health` | GET | — |
| `/api/resolve-scope` | POST | `{ "text": "..." }` |
| `/api/generate` | POST | `{ "text", "kind": "objective"\|"target", "repo?", "branchName?" }` |

## Production

```bash
npm run build
GROQ_API_KEY=... node --import tsx server/index.ts
# Serve dist/ with any static host; proxy /api to the Node server.
```

## Desktop app

For GitHub sign-in, monthly reports, Jira sync, and Electron workflows, use the main [Vantage](https://github.com/Taekondainc/vantage) desktop app.

## Workspace

This repo is meant to live alongside the desktop app in a multi-root workspace:

```
vantage.code-workspace
  ├── taekondacommits/   (desktop)
  └── vantage-web/       (this app)
```
