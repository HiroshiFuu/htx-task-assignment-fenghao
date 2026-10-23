# AGENTS.md

A guide for anyone, person or coding agent, who reads, runs or changes this repository. [README.md](README.md) explains the product, design and decisions; this file is the practical map.

## Layout

```
backend/    NestJS 11 API (own package.json + lockfile)
  prisma/schema.prisma        PostgreSQL schema: the single source of truth
  prisma/migrations/          PostgreSQL migrations (init → add_subtasks → add_skill_source → add_cancelled_status)
  prisma/seed.ts, seed-data.ts   idempotent sample data
  scripts/                    SQLite schema generation, guarded DB reset, local-PostgreSQL check
  src/skills, src/developers  read-only modules
  src/tasks                   controller → service (Facade) → rules/ (Chain of Responsibility) → repository
  src/skill-inference         SkillClassifier (Strategy), Gemini Adapter, ResilientClassifier (Decorator), keyword rules
  src/common                  Prisma client + RowLockStrategy, problem+json errors, throttling, health
  test/                       HTTP e2e suites (supertest)
frontend/   React 19 + Vite SPA (own package.json + lockfile)
  src/api                     typed fetch client, problem+json → ApiError
  src/features/tasks          queries (TanStack Query), tree helpers, status rules, components
  src/pages                   list and create pages (with their tests)
  nginx/                      production config: SPA, /api proxy, strict CSP
docker-compose.yml            db → migrate → api → web (port 8080)
docker-compose.override.yml   development only: loopback ports 8080 and 5433
```

There is no root `package.json`; run npm commands inside `backend/` or `frontend/`.

## Requirements → code → tests

| Requirement | Implementation | Tests |
|---|---|---|
| Developers, skills, tasks data model | `backend/prisma/schema.prisma` | `backend/test/api.e2e-spec.ts`, `backend/test/seed.e2e-spec.ts` |
| Assign only to a developer with all required skills | `backend/src/tasks/rules/skill-match.rule.ts`; UI filter `frontend/src/features/tasks/eligibility.ts` | `skill-match.rule.spec.ts`, `backend/test/tasks.e2e-spec.ts`, `frontend/src/features/tasks/eligibility.test.ts` |
| Subtasks of any depth, created in one request | `backend/src/tasks/dto/create-task.dto.ts`, `tree-limits.ts`, `tasks.repository.ts`; UI `frontend/src/features/tasks/components/TaskNodeEditor.tsx`, `task-draft.ts` | `backend/test/subtasks.e2e-spec.ts`, `tree-limits.spec.ts`, `frontend/src/features/tasks/task-draft.test.ts`, `frontend/src/pages/TaskCreatePage.test.tsx` |
| Done only when all subtasks are closed (Done or Cancelled) | `backend/src/tasks/rules/all-descendants-done.rule.ts`, `task-status.ts`; UI `frontend/src/features/tasks/components/StatusSelect.tsx`, `tree.ts` | `all-descendants-done.rule.spec.ts`, `backend/test/subtasks.e2e-spec.ts`, `frontend/src/pages/TaskListPage.tree.test.tsx` |
| Reopening under a Done parent asks first, then rolls parents back | `backend/src/tasks/rules/ancestor-rollback.rule.ts`, `tasks.service.ts`; UI `ConfirmCascadeDialog.tsx` | `ancestor-rollback.rule.spec.ts`, `backend/test/subtasks.e2e-spec.ts`, `frontend/src/pages/TaskListPage.tree.test.tsx` |
| Skills inferred by an LLM when none are given | `backend/src/skill-inference/*`, `backend/src/tasks/skill-resolution.ts` | `backend/src/skill-inference/*.spec.ts`, `backend/test/skill-inference.e2e-spec.ts` |
| Task list with status and assignee editing | `frontend/src/pages/TaskListPage.tsx`, `TaskTable.tsx`, `StatusSelect.tsx`, `AssigneeSelect.tsx`, `queries.ts` | `frontend/src/pages/TaskListPage.test.tsx`, `TaskListPage.tree.test.tsx` |
| One-command deployment | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx/` | Manual: `docker compose up --build` |

## Run and verify

Node.js 24 (see `.nvmrc`) and npm 11. All commands work in bash and in PowerShell.

**Without Docker (SQLite):**

```bash
cd backend
npm ci
cp .env.example .env
npm run db:reset          # create, push schema, generate the client, seed
npm run lint
npm test                  # unit tests
npm run test:e2e          # HTTP e2e on SQLite

cd ../frontend
npm ci
npm run lint
npm test
npm run build
```

Run the app with `npm run start:dev` in `backend/` (API on http://localhost:3000/api, Swagger UI on `/api/docs`) and `npm run dev` in `frontend/` (http://localhost:5173).

**With Docker (the production setup, PostgreSQL):**

```bash
cp .env.example .env
docker compose up --build   # http://localhost:8080
```

**The e2e suite on PostgreSQL** needs the database container: `docker compose up -d db`, then in `backend/`: `cp .env.pg.example .env.pg`, `npm run db:reset:pg` and `npm run test:e2e:pg`.

No API key is needed anywhere: without `GEMINI_API_KEY` the backend infers skills with keyword rules and logs a warning. Tests always replace the classifier and never call an external service.

## Conventions

- TypeScript `strict`, no `any`; ESLint and Prettier must pass in both packages.
- Backend layering: controllers stay thin; business rules live in `backend/src/tasks/rules/` as pure functions of a loaded snapshot; every check-then-write runs in a transaction; no network call inside a transaction.
- Errors are RFC 7807 `application/problem+json`: 400 validation, 404 not found, 409 confirmation needed, 422 business rule (with a `code`).
- Raw SQL only through Prisma `$queryRaw` tagged templates (`$queryRawUnsafe` is banned) and only syntax that both SQLite and PostgreSQL support; the one dialect difference is `RowLockStrategy`.
- Schema changes go into `backend/prisma/schema.prisma` and a PostgreSQL migration (`npm run db:migrate:pg`); the SQLite schema is generated, never edited.
- Frontend: server state only in TanStack Query; Tailwind classes only (no inline styles, so the strict CSP holds); no `dangerouslySetInnerHTML`; every control labelled.
- npm scripts must stay cross-platform (no `rm -rf`, no `export`); files use LF line endings.

## Intentional choices that may look odd

- **Two databases.** SQLite is for fast local development only; PostgreSQL is the production database. The full e2e suite runs on both.
- **`backend/src/generated/` is gitignored.** The Prisma client is generated per database provider by the npm scripts.
- **Some comments are in Chinese** in `backend/prisma.config.ts`, `backend/scripts/db-reset.ts`, `backend/scripts/gen-sqlite-schema.ts` and `backend/src/common/prisma/prisma-client.factory.ts`. These four files were supplied as a reference implementation of the SQLite/PostgreSQL setup and were kept verbatim. The Chinese title in `backend/test/tasks.e2e-spec.ts` is a deliberate Unicode test case.
- **No authentication, no delete or skill-edit endpoints.** Out of scope for v1 (README decisions D1 and D11).
- **The task tree's shape never changes after creation**, which is why status changes can read the affected ids before locking them.
