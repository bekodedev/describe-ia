# CLAUDE.md — DescribeIA project rules

Read [docs/PROJECT.md](docs/PROJECT.md) for scope and [docs/ROADMAP.md](docs/ROADMAP.md) for the task list. These rules apply on every task.

## Stack and structure

- Monorepo with pnpm workspaces: `apps/api` (Node.js + TypeScript + Express) and `apps/web` (Next.js, minimal UI).
- PostgreSQL with plain SQL migrations (`node-pg-migrate`) and the `pg` driver. No ORM.
- LLM: Anthropic Messages API called with plain `fetch`. No agent SDKs or frameworks. The model comes from `ANTHROPIC_MODEL` (cheaper model for development, better one for production, both set in `.env`); never hard-code it.
- Validation with zod for user input and model output. Tests with Vitest.
- Package manager: pnpm (never npm or yarn; commit `pnpm-lock.yaml`).
- Docker Compose runs the whole local environment.
- Output language of generated descriptions comes from `OUTPUT_LANGUAGE` (ISO 639-1, default `es`) and is passed to prompts as `{{language}}`. Never hard-code it.
- Everything in the repo (code, comments, UI, docs, commit messages) is written in English.
- No real authentication: a fixed demo user is injected by a middleware. Keep the `user_id` column on user-owned tables.

```text
apps/
  api/
    src/
      routes/        HTTP handlers: validate, call a service, shape the response
      services/      business logic
      llm/           the only code that talks to the provider
      db/            pool and plain-SQL repositories
      config/        env parsing (zod)
    migrations/      SQL migrations
    prompts/
      public/        versioned prompts, always committed
      private/       optional local prompts (git-ignored)
    config/          pricing.json
  web/
    src/             Next.js app, API client in src/lib/api.ts
docs/                PROJECT.md, ROADMAP.md, DEMO.md
.internal/           local notes (git-ignored)
```

## Commands

Commands marked TODO do not exist yet; the task that creates them replaces TODO with the real command.

| Purpose             | Command                                              | Status |
| ------------------- | ---------------------------------------------------- | ------ |
| Start everything    | `docker compose up`                                  | TODO (T01) |
| Dev (api / web)     | `pnpm --filter api dev` / `pnpm --filter web dev` | TODO (T01) |
| Test                | `pnpm test`                                           | TODO (T01) |
| Lint                | `pnpm lint`                                       | TODO (T01) |
| Typecheck           | `pnpm typecheck`                                  | TODO (T01) |
| Migrate up / down   | `pnpm --filter api migrate:up` / `migrate:down`    | TODO (T02) |
| New migration       | `pnpm --filter api migrate:create <name>`       | TODO (T02) |
| LLM smoke test      | `pnpm --filter api llm:smoke`                      | TODO (T03) |
| Cost report         | `pnpm --filter api report:cost`                    | TODO (T09) |
| Seed demo data      | `pnpm --filter api seed:demo`                      | TODO (T10) |

## Working rules

- **One task per session.** Implement only the scope of the requested task (Goal and Deliverables in the roadmap). Do not start the next task or add "while I'm here" features. If something outside the scope is needed, note it and stop.
- **Definition of finished for every task:**
  1. Tests, lint and typecheck pass.
  2. A new entry is added to `.internal/devlog.md` using its template.
  3. The task is checked off in `docs/ROADMAP.md` (`[ ]` to `[x]`).
  4. A conventional commit is made: `feat(Txx): <short description>` (use `fix`, `docs`, `chore`, `test` where they fit better).
- Automated tests never call the real Anthropic API; stub `fetch`.
- Every LLM call, including failures, is recorded in `llm_calls`.

## Secrets and private files

- Never commit secrets. `.env.example` must always list every variable the code reads, with safe placeholder values, and must be updated in the same change that adds a variable.
- Never commit anything under `.internal/`, `docs/internal/`, `apps/api/prompts/private/`, or files matching `*.private.*`. Check `git status` before every commit.
- Code must work when private files are missing: the prompt loader falls back to `apps/api/prompts/public/`.

## Public-facing repository

The repository is public. Everything committed (code, comments, docs, commit messages, tags, CHANGELOG, README) describes only the product and its engineering. Do not add references to anything outside the project itself.

## Code style

- Short, readable code. Small functions with one job. No clever tricks, no premature abstraction.
- Handlers stay thin; logic goes in services; the LLM client is one isolated function.
- Prompts live in versioned files under `apps/api/prompts/`, not in code.
- Validate all external input (requests, uploads, model output).
- Comments explain why, not what. Names are descriptive.
