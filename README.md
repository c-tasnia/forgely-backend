# ProjectForge — Backend

Node/Express API. Auth, projects, tasks/Kanban, invites, admin, reports, GitHub activity,
contribution scoring, real-time chat, notifications, file uploads.

## Stack
Express · Socket.IO · Prisma ORM · PostgreSQL (Neon) · JWT auth · bcrypt · Cloudinary · Multer

## Setup
1. Create a project at https://neon.tech, grab the pooled and direct connection strings.
2. (Optional) Create a free account at https://cloudinary.com for file uploads — grab your
   cloud name, API key, and API secret from the dashboard.
3. (Optional) Generate a GitHub personal access token at https://github.com/settings/tokens
   (classic, no scopes needed for public repos) for the GitHub activity + contribution features.
4. `cp .env.example .env` and fill in `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CLIENT_URL`,
   and the optional Cloudinary/GitHub vars above.
5. `npm install` (runs `prisma generate` automatically)
6. `npx prisma migrate dev --name init` — creates the tables on Neon (or `--name phase2` if
   you're migrating an existing DB that already has the Phase 1 tables)
7. `npm run seed` — creates `demo@projectforge.dev` / `demo1234` and `admin@projectforge.dev` / `admin1234`
8. `npm run dev`

## Deploying
**Don't use Vercel for this backend.** Vercel runs Node apps as serverless functions, which don't
support the persistent server this app needs (`app.listen`) and can't run Socket.IO at all — chat
and real-time notifications require a long-lived connection that serverless platforms tear down
between requests. Use Railway, Render, or Fly.io instead — anywhere that runs your app as a normal
long-running process.

### Render (the `render.yaml` in this repo is ready to use)
1. Push this backend to its own GitHub repo.
2. On render.com, New → Blueprint → connect the repo. Render reads `render.yaml` automatically and
   builds from the included `Dockerfile`.
3. Fill in the env vars it prompts for (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CLIENT_URL`,
   and the optional `GITHUB_TOKEN`/`CLOUDINARY_*` vars) in the Render dashboard.
4. Deploy. Render's free tier supports WebSockets out of the box — chat and notifications will work.
5. Run migrations once against production: from your local machine, temporarily point
   `DIRECT_URL` at production in a local `.env` and run `npx prisma migrate deploy`, or add it as
   Render's pre-deploy command.

### Railway / Fly.io
Both read the included `Dockerfile` directly — connect the repo (Railway) or run `fly launch`
(Fly.io), set the same env vars, and deploy. The `Procfile` is there as a fallback for any
buildpack-based host that doesn't use Docker.

### Frontend
Vercel is genuinely the right choice for the frontend (it's a static build) — just make sure
`VITE_API_URL` in the frontend's Vercel project settings points at wherever you deploy *this*
backend, e.g. `https://your-backend.onrender.com/api`.

## API surface
- `/api/auth` — register, login, me
- `/api/projects` — CRUD + invites
- `/api/tasks` — CRUD + `/move` for Kanban drag-and-drop
- `/api/invites` — list/respond
- `/api/admin/*` — stats, user ban/unban/delete, project archive/delete, reports (admin only)
- `/api/reports` — file a report (any logged-in user)
- `/api/projects/:id/github` — commits/PRs/issues/contributors (needs `GITHUB_TOKEN`)
- `/api/projects/:id/contribution` — weighted contribution score per member
- `/api/projects/:id/messages` — chat history (live messages come over the socket)
- `/api/projects/:id/files` — upload/list project files (needs `CLOUDINARY_*`)
- `/api/notifications` — list, mark read, mark all read

## Real-time (Socket.IO)
Client connects with `{ auth: { token } }` using the same JWT as the REST API. Events:
`project:join` / `project:leave`, `chat:message`, `chat:typing`, `presence:update`, `notification:new`.

## What's not built (Phase 4)
Docker, automated tests, deployment configs, doc polish. Deadline-reminder notifications also
aren't built — that needs a scheduled job (cron), which isn't set up here.
