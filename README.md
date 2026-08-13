# Forgely — Backend

Node/Express API. Auth, projects, tasks/Kanban, invites, admin, reports, GitHub activity,
contribution scoring, real-time chat, notifications, file uploads. Runs on Vercel as a serverless
function — real-time features go over Pusher (Channels) rather than a persistent WebSocket server,
which is what makes that possible.

## Stack
Express · Prisma ORM · PostgreSQL (Neon) · JWT auth · bcrypt · Cloudinary · Multer · Pusher

## Setup
1. Create a project at https://neon.tech, grab the pooled and direct connection strings.
2. Create a free app at https://pusher.com (Channels product) — grab `app_id`, `key`, `secret`,
   and `cluster` from the app's "App Keys" tab. Needed for chat, typing indicators, presence, and
   live notifications; the rest of the app works without it.
3. (Optional) Create a free account at https://cloudinary.com for file uploads — grab your
   cloud name, API key, and API secret from the dashboard.
4. (Optional) Generate a GitHub personal access token at https://github.com/settings/tokens
   (classic, no scopes needed for public repos) for the GitHub activity + contribution features.
5. `cp .env.example .env` and fill in `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CLIENT_URL`,
   the four `PUSHER_*` vars, and the optional Cloudinary/GitHub vars above.
6. `npm install` (runs `prisma generate` automatically)
7. `npx prisma migrate dev --name init` — creates the tables on Neon
8. `npm run seed` — creates `demo@forgely.dev` / `demo1234` and `admin@forgely.dev` / `admin1234`
9. `npm run dev` — runs the local dev server via `server.js` (plain `app.listen`, nothing
   Vercel-specific needed for local development)

## Deploying to Vercel
This repo is structured for it: `app.js` holds the Express app with no `listen()` call,
`api/index.js` exports it as a serverless function, and `vercel.json` routes every request through
that one function while preserving the original path.

1. Push this backend to its own GitHub repo.
2. On vercel.com, New Project → import the repo. Vercel auto-detects `vercel.json`.
3. Add the env vars from your `.env` (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CLIENT_URL`,
   `PUSHER_*`, and the optional `GITHUB_TOKEN`/`CLOUDINARY_*` vars) in Project Settings →
   Environment Variables.
4. Deploy. Test `https://your-backend.vercel.app/api/health` — should return
   `{"status":"ok","db":"connected"}`.
5. Run migrations once against production: point a local `.env` at the same `DATABASE_URL`/
   `DIRECT_URL` you set on Vercel and run `npx prisma migrate deploy` from your machine.

### Also fine: Railway / Render / Fly.io
The `Dockerfile`, `render.yaml`, and `Procfile` in this repo still work if you'd rather run this
as a normal long-running server instead of serverless — nothing about the Pusher-based real-time
layer requires Vercel specifically, it just makes Vercel *possible*, where Socket.IO wouldn't have.

### Frontend
Set `VITE_API_URL` in the frontend's Vercel project to wherever you deploy *this* backend, e.g.
`https://your-backend.vercel.app/api`. Also set `VITE_PUSHER_KEY` / `VITE_PUSHER_CLUSTER` there,
matching the values you used here.

## API surface
- `/api/auth` — register, login, me
- `/api/projects` — CRUD + invites
- `/api/tasks` — CRUD + `/move` for Kanban drag-and-drop
- `/api/invites` — list/respond
- `/api/admin/*` — stats, user ban/unban/delete, project archive/delete, reports (admin only)
- `/api/reports` — file a report (any logged-in user)
- `/api/projects/:id/github` — commits/PRs/issues/contributors (needs `GITHUB_TOKEN`)
- `/api/projects/:id/contribution` — weighted contribution score per member
- `/api/projects/:id/messages` — GET chat history, POST to send a message (broadcasts via Pusher)
- `/api/projects/:id/typing` — POST a typing indicator ping (broadcasts via Pusher)
- `/api/projects/:id/files` — upload/list project files (needs `CLOUDINARY_*`)
- `/api/notifications` — list, mark read, mark all read
- `/api/pusher/auth` — channel authorization for the frontend's Pusher client (private user
  channels + presence project channels)

## Real-time (Pusher Channels)
No persistent connection to your server — the frontend connects directly to Pusher and
authenticates each channel subscription against `/api/pusher/auth`. Two channel types:
- `private-user-<userId>` — a user's own notifications (`notification:new` event)
- `presence-project-<projectId>` — a project's chat room (`chat:message`, `chat:typing` events,
  plus Pusher's built-in presence events for online/offline tracking)

Your server only ever *triggers* events on these channels (via `services/notify.js` and
`controllers/chatController.js`) — it never needs to hold a connection open.

## What's not built (Phase 4 remainder)
Deadline-reminder notifications need a scheduled job (cron), which isn't set up here. Doc polish
otherwise done: Docker, tests, and deployment configs are all in this repo.
