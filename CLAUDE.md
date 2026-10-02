# CLAUDE.md — DescribeIA project rules

Read [docs/PROJECT.md](docs/PROJECT.md) for scope and [docs/ROADMAP.md](docs/ROADMAP.md) for the task list. These rules apply on every task.

## Stack and structure

- Monorepo with pnpm workspaces: `apps/api` (Node.js + TypeScript + Express) and `apps/web` (Next.js, minimal UI).
- PostgreSQL with plain SQL migrations (`node-pg-migrate`) and the `pg` driver. No ORM.
- LLM: Anthropic Messages API called with plain `fetch`. No agent SDKs or frameworks. The model comes from `LLM_MODEL` (cheaper model for development, better one for production, both set in `.env`); never hard-code it.
- Validation with zod for user input and model output. Tests with Vitest.
- Package manager: pnpm (never npm or yarn; commit `pnpm-lock.yaml`).
- Docker Compose runs the whole local environment. The API container uses `pnpm --filter api dev:poll` (nodemon polling) because file events do not cross bind mounts on Windows; the web container uses `WATCHPACK_POLLING`.
- Output language of generated descriptions comes from `OUTPUT_LANGUAGE` (ISO 639-1, default `es`) and is passed to prompts as `{{language}}`. Never hard-code it.
- Everything in the repo (code, comments, UI, docs, commit messages) is written in English.
- No real authentication: a fixed demo user is injected by a middleware. Keep the `user_id` column on user-owned tables.

```text
apps/
  api/
    src/
      routes/        HTTP handlers: validate, call a service, shape the response
      services/      business logic
      llm/           the only code that talks to the provider (client, pricing, errors, recording)
      db/            pool and plain-SQL repositories
      config/        env parsing (zod)
    migrations/      SQL migrations
    prompts/         versioned prompts, always committed (<name>.<version>.md)
      private/       optional local overrides with the same file names (git-ignored)
  web/
    src/             Next.js app, API client in src/lib/api.ts
docs/                PROJECT.md, ROADMAP.md, DEMO.md
.internal/           local notes (git-ignored)
```

## Commands

Commands marked TODO do not exist yet; the task that creates them replaces TODO with the real command.

| Purpose           | Command                                                                                            | Status     |
| ----------------- | -------------------------------------------------------------------------------------------------- | ---------- |
| Start everything  | `docker compose up` (needs `.env`, copy `.env.example`)                                            | done       |
| Dev (api / web)   | `pnpm dev` (both) or `pnpm --filter api dev` / `pnpm --filter web dev`                             | done       |
| Test              | `pnpm test`                                                                                        | done       |
| Build             | `pnpm build`                                                                                       | done       |
| Lint              | `pnpm lint`                                                                                        | done       |
| Typecheck         | `pnpm typecheck`                                                                                   | done       |
| Migrate up / down | `pnpm --filter api migrate` / `migrate:down`                                                       | done       |
| New migration     | `pnpm --filter api migrate:create <name>`                                                          | done       |
| LLM ping          | `pnpm --filter api llm:ping` (one real call, needs a real key)                                     | done       |
| Cost report       | `pnpm --filter api report:cost`                                                                    | TODO (T09) |
| Try a generation  | `pnpm --filter api gen:try "<title>" "<category>"` (real call, needs a key)                        | done       |
| Compare v1 / v2   | `pnpm --filter api gen:compare [--rounds N]` (real calls, writes docs/experiments/t05-v1-vs-v2.md) | done       |
| Seed demo user    | `pnpm --filter api seed`                                                                           | done       |
| Seed demo data    | `pnpm --filter api seed:demo` (sample products)                                                    | TODO (T10) |

## Working rules

- **One task per session.** Implement only the scope of the requested task (Goal and Deliverables in the roadmap). Do not start the next task or add "while I'm here" features. If something outside the scope is needed, note it and stop.
- **Definition of finished for every task:**
  1. Tests, lint and typecheck pass.
  2. A new entry is added to `.internal/devlog.md` using its template.
  3. The task is checked off in `docs/ROADMAP.md` (`[ ]` to `[x]`).
  4. A conventional commit is made: `feat(Txx): <short description>` (use `fix`, `docs`, `chore`, `test` where they fit better).
- Automated tests never call the real Anthropic API; stub `fetch`.
- Database integration tests run the real migrations in a throwaway schema and need `DATABASE_URL` (from `.env`) plus a running Postgres (`docker compose up -d postgres`); they are skipped when it is unset.
- Every LLM call, including failures, is recorded in `llm_calls` (use `recordLlmCall`, which also stores the cost from `src/llm/pricing.ts`).
- Scripts that call the API from Node on a machine with TLS inspection need `--use-system-ca` (see `llm:ping`); without it `fetch` fails with `SELF_SIGNED_CERT_IN_CHAIN`.

## Secrets and private files

- Never commit secrets. `.env.example` must always list every variable the code reads, with safe placeholder values, and must be updated in the same change that adds a variable.
- Never commit anything under `.internal/`, `docs/internal/`, `apps/api/prompts/private/`, or files matching `*.private.*`. Check `git status` before every commit.
- Code must work when private files are missing: the prompt loader falls back to the public prompt in `apps/api/prompts/`.

## Public-facing repository

The repository is public. Everything committed (code, comments, docs, commit messages, tags, CHANGELOG, README) describes only the product and its engineering. Do not add references to anything outside the project itself.

## Code style

- Short, readable code. Small functions with one job. No clever tricks, no premature abstraction.
- Handlers stay thin; logic goes in services; the LLM client is one isolated function.
- Prompts live in versioned files under `apps/api/prompts/`, not in code.
- Validate all external input (requests, uploads, model output).
- Comments explain why, not what. Names are descriptive.
