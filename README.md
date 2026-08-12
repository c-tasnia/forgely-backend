# forgely — Backend

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
7. `npm run seed` — creates `demo@forgely.dev` / `demo1234` and `admin@forgely.dev` / `admin1234`
8. `npm run dev`

## Deploying
Works on Railway, Render, Fly.io, or any Node host that supports long-lived WebSocket connections
(this now runs Socket.IO alongside the REST API on the same HTTP server — make sure your host
doesn't put the app behind something that kills idle connections aggressively). Set the same env
vars there, and run `npm run prisma:deploy` (or add it as a build/release step) instead of `migrate dev`.

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
