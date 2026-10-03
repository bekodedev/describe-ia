# DescribeIA — Roadmap

## Summary

- **What it is:** a micro-SaaS that turns a product title, a category and an optional photo into 3 ready-to-use descriptions (short, medium, SEO) using an LLM.
- **Who it is for:** small and mid-size online store owners, agencies managing several stores, and dropshippers with poor supplier copy.
- **What it does:** one form, one LLM call, 3 editable variants, a history of products, and a cost report per description and per 1,000 descriptions.
- **What it records:** every LLM call (tokens, cost, latency, status), including failures, so real costs are measurable from day one.
- **What is left out:** authentication (a fixed demo user is injected), roles, queues/batch processing, billing and bulk import.

## Architecture

```text
+-------------------+        HTTP/JSON         +-----------------------+        HTTPS (fetch)        +----------------------+
|  Frontend         | -----------------------> |  API                  | --------------------------> |  LLM provider        |
|  Next.js (web)    | <----------------------- |  Express + TypeScript | <-------------------------- |  Anthropic Messages  |
+-------------------+                          |  (apps/api)           |                             +----------------------+
                                               |                       |
                                               |  routes -> services   |          SQL (pg)           +----------------------+
                                               |  -> llm client        | --------------------------> |  PostgreSQL          |
                                               |  -> repositories      | <-------------------------- |  users, products,    |
                                               +-----------------------+                             |  descriptions,       |
                                                        |                                            |  llm_calls           |
                                                        v                                            +----------------------+
                                               uploads/ (photos, local volume)
```

Layers inside the API: `routes` (validate input, call a service, shape the response) → `services` (business logic) → `llm` (one isolated function that talks to the provider) and `db` (plain SQL through `pg`). Prompts live in versioned files, never in code.

## Tasks

| ID  | Title                                                           | Depends on    | Est. (h) | Status |
| --- | --------------------------------------------------------------- | ------------- | -------- | ------ |
| T01 | Monorepo bootstrap, TypeScript tooling and Docker Compose       | —             | 3        | [x]    |
| T02 | Database schema, migrations and demo user                       | T01           | 3        | [x]    |
| T03 | HTTP LLM client: config, timeouts, retries, token-usage logging | T01, T02      | 4        | [x]    |
| T04 | Naive prompt v1 and generation service                          | T03           | 3        | [x]    |
| T05 | Structured output, zod validation and retry on invalid format   | T04           | 4        | [x]    |
| T06 | API endpoints (generate, list, view, edit description)          | T02, T05      | 4        | [x]    |
| T07 | Optional photo: upload, validation, multimodal request          | T06           | 4        | [x]    |
| T08 | Next.js frontend: form, results page, copy and edit             | T06, T07      | 6        | [x]    |
| T09 | Cost tracking and cost report (per description / per 1,000)     | T05, T06, T08 | 3        | [x]    |
| T10 | Tests, demo data and end-to-end demo walkthrough                | T01–T09       | 5        | [x]    |
| T11 | Release preparation: public/private split, README, tag v0.1.0   | T01–T10       | 3        | [ ]    |

Total: about 42 hours.

## Changes from the base list

The base order and scope are kept: no task is merged, split or reordered. Four problems were found and are resolved by clarifying scope, not by changing the list:

1. **Docker Compose must serve the whole stack, not only Postgres.** The Definition of Done requires `docker compose up` from a clean clone. T01 therefore creates `postgres`, `api` and `web` services (the last two with a "hello world" body), and each later task extends them (T02 runs migrations on API start, T07 adds the uploads volume). Otherwise the full-stack setup would land untested in T11.
2. **The prompt loader with public fallback belongs in T04, not T11.** The private/public split affects how every prompt file is read. Building the loader when the first prompt is written avoids reworking T04 and T05 later. T11 only audits and documents the split.
3. **Tests are written per task, not only in T10.** The per-task finish rule requires tests to pass, so each task ships its own unit/integration tests. T10 adds the cross-cutting layer: end-to-end flow, demo data and the walkthrough.
4. **Cost is stored from T03; T09 reports it.** `llm_calls` has `input_tokens`, `output_tokens` and a nullable `cost_usd` from T02; T03 adds the per-model price table (`src/llm/pricing.ts`) and fills tokens, latency and `cost_usd` on every call. T09 only aggregates and presents it.

## Conventions used in the acceptance criteria

- `docker compose up -d` is the way to run the stack; `pnpm <script>` commands run from the repo root through pnpm workspaces (`pnpm --filter api <script>`, `pnpm --filter web <script>`); package names are `api` and `web`.
- Commands that call the real Anthropic API need `ANTHROPIC_API_KEY` in `.env`. Automated tests never call the real API; they stub `fetch`.
- `$API` is `http://localhost:4000`, `$WEB` is `http://localhost:3000`.

---

## T01 — Monorepo bootstrap, TypeScript tooling and Docker Compose

**Goal.** Create an empty but fully wired monorepo where `docker compose up` starts Postgres, the API and the web app, and where lint, typecheck and test commands already run.

**Deliverables.**

- Root `package.json` with `packageManager` pinned to pnpm, `pnpm-workspace.yaml` (`apps/*`), `tsconfig.base.json`, ESLint + Prettier config, `.editorconfig`.
- `apps/api`: Express app with `GET /health` (`{"status":"ok","db":"ok"|"down"}` from a real `SELECT 1`), config module that reads and validates env vars with zod (`DATABASE_URL`, `PORT`, `OUTPUT_LANGUAGE` as 2-letter ISO 639-1 with default `es`, `ANTHROPIC_API_KEY` and `LLM_MODEL`, both required at startup with a readable error), Vitest set up with one smoke test.
- `apps/web`: Next.js app with a placeholder home page.
- `apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.yml` (`postgres` with healthcheck and named volume, `api`, `web`).
- `.env.example`, `.gitignore` (with the required entries), `CLAUDE.md`, `.internal/devlog.md` present locally.
- CLAUDE.md commands updated from TODO to real ones.

**Acceptance criteria.**

- `docker compose up -d --build` then `docker compose ps` shows `postgres` healthy, `api` and `web` running.
- `curl $API/health` returns `{"status":"ok","db":"ok"}`; `curl -s $WEB` returns HTTP 200.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` exit with code 0.
- Starting the API with `OUTPUT_LANGUAGE=english` fails with a clear config error; with no value it uses `es`.
- `git status` does not list `.env`, `.internal/`, `uploads/`.

**Out of scope.** Database schema, LLM code, any real UI.

---

## T02 — Database schema, migrations and demo user

**Goal.** Define the PostgreSQL schema with plain SQL migrations and a demo user injected by a middleware, so every row already carries a `user_id`, and record every LLM call from day one so costs can be measured.

**Deliverables.**

- `node-pg-migrate` configured with SQL migrations in `apps/api/migrations/`.
- Tables (uuid PKs, `created_at timestamptz` on all):
  - `users` (id, email unique, name).
  - `products` (id, user_id FK, title, category, image_path nullable).
  - `descriptions` (id, product_id FK, variant enum `short|medium|seo`, content, edited_content nullable, updated_at).
  - `llm_calls` (id, user_id FK, product_id FK nullable, model, prompt_version, input_tokens, output_tokens, cost_usd numeric(10,6) nullable, latency_ms, status enum `ok|invalid_output|error`, error_message nullable, raw_response jsonb nullable).
- Indexes on the foreign keys and on `products(user_id, created_at desc)`.
- Idempotent seed (`pnpm --filter api seed`) for the demo user (`demo@describeia.local`) with the fixed UUID `DEMO_USER_ID` in `src/config/demo-user.ts`.
- `pg` pool module, a `demoUser` middleware that sets `req.user` (placeholder for real auth) and a minimal plain-SQL repository layer in `apps/api/src/db/`.
- Migrations and the seed run automatically when the `api` container starts.
- Scripts: `migrate` (up), `migrate:down`, `migrate:create`, `seed`.

**Acceptance criteria.**

- `docker compose down -v && docker compose up -d` leaves all four tables created and the demo user seeded (`docker compose exec postgres psql -U postgres -d describeia -c "dt"`).
- Running the seed twice keeps `SELECT count(*) FROM users` at 1.
- `pnpm --filter api migrate:down` followed by `migrate` works with no error (reversible).
- An integration test against Postgres (throwaway schema) creates a product, inserts 3 descriptions and reads them back; an unknown variant is rejected by the database.
- A test proves the middleware sets `req.user.id` to the demo user.

**Out of scope.** HTTP endpoints (T06), LLM logic, real auth.

---

## T03 — HTTP LLM client: config, timeouts, retries, token usage and cost

**Goal.** Provide one small, readable client for the Anthropic Messages API (plain `fetch`, no SDK) that handles transport failures and records every call, with its cost, in `llm_calls`.

**Deliverables.**

- `apps/api/src/llm/client.ts` exposing `complete(params)`: `system`, `messages` (text and base64 image blocks), `maxTokens` and optional `tools` / `toolChoice` in; `{ content, usage: { inputTokens, outputTokens }, model, latencyMs, raw }` out. Response is validated with zod. `fetch` and `sleep` are injectable so tests never touch the network.
- Env: `ANTHROPIC_API_KEY`, `LLM_MODEL` (never hard-coded; `.env.example` defaults to `claude-haiku-4-5-20251001`, `claude-sonnet-5-5` suggested for production) and `LLM_TIMEOUT_MS` (default 30000).
- Timeout per attempt through `AbortController`. Retries only for 429, 529 and 5xx, with exponential backoff plus jitter, honouring `retry-after`; at most 3 attempts. Other 4xx, timeouts and network failures are not retried.
- Typed errors in `src/llm/errors.ts`: `LlmRateLimitError`, `LlmTimeoutError`, `LlmBadRequestError`, `LlmUpstreamError`.
- `src/llm/pricing.ts`: per-model price table (USD per million tokens, with source URL and date) and `estimateCostUsd(model, usage)`; unknown model → `null`.
- `src/llm/record.ts`: `recordLlmCall(db, context, call, interpret)` runs a call and inserts one `llm_calls` row on success (tokens, cost, latency, raw response) and on error (message, status `error`), then rethrows.
- `pnpm --filter api llm:ping`: one minimal real call; prints reply, tokens, cost and latency.

**Acceptance criteria.**

- `pnpm test` (stubbed `fetch`) proves: a 429 with `retry-after` is retried after that delay; a 400 is not retried; a hung request throws `LlmTimeoutError`; 429/529 stop after 3 attempts; the cost is computed correctly; success and error rows are inserted.
- `pnpm --filter api llm:ping` with a real key prints a reply, non-zero tokens and a cost above 0, and a matching `ok` row appears in `llm_calls`.
- With an invalid key the script exits non-zero, an `error` row is stored, and the key is not in any output.

**Out of scope.** Product prompts (T04), structured output (T05), cost report (T09), streaming, prompt caching, other providers.

---

## T04 — Naive prompt v1 and generation service

**Goal.** Get a first end-to-end generation working with a deliberately simple prompt and no structured output, put in place the versioned prompt loader with private/public fallback, and document how it fails.

**Deliverables.**

- `apps/api/prompts/generate-description.v1.md` (public) with `{{title}}`, `{{category}}` and `{{language}}` placeholders; the language name ("Spanish") is derived from `OUTPUT_LANGUAGE`, never hard-coded. The prompt asks for three variants under the headings `SHORT:`, `MEDIUM:` and `SEO:`.
- `apps/api/src/generation/prompts.ts`: `loadPrompt(name, version)` looks first in `apps/api/prompts/private/<name>.<version>.md` (git-ignored) and falls back to `apps/api/prompts/<name>.<version>.md`; `renderPrompt` rejects unknown placeholders. Unit-tested.
- `apps/api/src/generation/service.ts`: `generateDescriptions(pool, { userId, title, category })` calls the T03 client, parses the headings with a deliberately naive parser, saves the product, the 3 descriptions and the `llm_call` (`prompt_version = v1`, linked to the product) and returns them. If parsing fails, the call is stored with status `invalid_output` and an error is thrown; nothing else is saved.
- `pnpm --filter api gen:try "<title>" "<category>"` prints the raw response and the parsed result.
- `docs/experiments/t04-v1-outputs.md`: at least 10 varied runs with their raw outputs and a table of observed failures with their frequency.

**Acceptance criteria.**

- `gen:try` works end to end and persists product, descriptions and the `llm_calls` row.
- Tests: loader (private wins, public fallback, missing private folder, unknown placeholder), parser, and the service against Postgres with a stubbed model (success saves everything; a bad format stores `invalid_output` and no product).
- The experiments file contains the runs and the failure table.

**Out of scope.** Fixing the problems (T05): no validation, no format retries, no structured output, no HTTP endpoints.

---

## T05 — Structured output, zod validation and retry on invalid format

**Goal.** Eliminate the format failures seen in T04: get structured JSON from the model, validate it with zod, and retry once when it is invalid. Measure the improvement against v1 with the same products.

**Deliverables.**

- Structured output through JSON-schema structured outputs (`output_config.format`, plain `fetch`), chosen over a forced tool call because it is GA for the development and production models and adds no tool-use prompt overhead (about 500 input tokens per call on Haiku 4.5). The choice is justified in the devlog.
- `apps/api/prompts/generate-description.v2.md` (public, simplified): clear rules (language from `{{language}}`, no invented specifications, neutral tone, no emojis, no markdown). The optimised version with few-shot examples and brand tone lives in `apps/api/prompts/private/` and is never committed.
- `DescriptionsSchema` (zod) with per-variant length limits (characters): short 20–220, medium 80–700, seo 200–1600. The API does not support `minLength`/`maxLength`, so the JSON schema sent to the model has no limits and zod enforces them. The response is always validated, even though the API guarantees the shape.
- Retry: if an answer is invalid, one retry that adds the validation error to the conversation. Every attempt is stored in `llm_calls` (`invalid_output` for the failed ones). Still invalid → `InvalidOutputError` with `status = 422`.
- `prompt_version = v2` in `llm_calls`; the service uses v2 by default and keeps v1 available (`gen:try "<title>" "<category>" v1`) for the comparison.
- `pnpm --filter api gen:compare [--rounds N]` runs the experiment products with v1 and v2 and writes `docs/experiments/t05-v1-vs-v2.md` (parse success rate, retries, average tokens, cost and latency).

**Acceptance criteria.**

- Unit tests: valid JSON passes; a missing field is followed by a retry that succeeds and the retry message names the problem; two invalid answers in a row give a typed 422 error and two `invalid_output` rows; unknown fields are stripped; the request carries the schema.
- `pnpm --filter api gen:try "Stainless steel water bottle 750 ml" "Sports"` prints three validated variants.
- With the real API, every product of the experiment is valid with v2 (any remaining failure is explained in the comparison file).
- `docs/experiments/t05-v1-vs-v2.md` exists with real numbers.

**Out of scope.** HTTP endpoints, images, quality validation beyond the length limits.

---

## T06 — API endpoints (generate, list, view, edit description)

**Goal.** Expose the generation service and the stored data over HTTP with a clear contract that the web app will use.

**Deliverables.**

- `POST /api/generations` (JSON `{ title, category }`) → `201 { product, descriptions[] }`. Title 3–200 characters, category from a closed list defined in the shared package (`packages/shared`, used by the API and by the web app together with the response types and limits).
- `GET /api/products?limit=&cursor=` → the demo user's products, newest first, keyset pagination by `(created_at, id)` with an opaque cursor: `{ products[], nextCursor }`. `limit` 1–100, default 20.
- `GET /api/products/:id` → `{ product, descriptions[] }`; 404 if the product is not the user's.
- `PATCH /api/descriptions/:id` (JSON `{ editedContent }`) → `{ description }`; the generated `content` is never touched; 404 if it belongs to another user.
- Responses are camelCase with ISO dates (`ProductDto`, `DescriptionDto` in the shared package); database rows stay internal.
- Central error middleware, one error shape `{ error: { code, message, details?, requestId } }`: validation → 400 with details; `LlmRateLimitError` → 503 + `Retry-After`; `InvalidOutputError` → 422; `LlmTimeoutError` → 504; own rate limit → 429 + `Retry-After`; unknown route → 404; anything else → 500 with a generic message. Every error is logged with its request id (also returned in `X-Request-Id`).
- In-memory rate limit on `POST /api/generations` (10 per minute) to protect the API key; documented as a single-instance solution to be replaced by a shared store.
- The generation handler is about 10 lines; routes validate with zod and call the service.
- `apps/api/requests.http` with an example of every endpoint and error.

**Acceptance criteria.**

- Tests with supertest and the LLM stubbed cover every endpoint and every error mapping (including pagination with identical and microsecond-apart timestamps, ownership, and "generation fails → nothing saved, both attempts recorded").
- A real `curl -X POST localhost:4000/api/generations …` returns 201 with 3 descriptions and the product is the first item of `GET /api/products`.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` pass.

**Out of scope.** Photo upload (T07), UI (T08), delete endpoints, cost report.

---

## T07 — Optional photo: upload, validation and multimodal request

**Goal.** Let a product include one photo so the model describes what is visible (colour, shape, finish) in addition to the title.

**Deliverables.**

- `POST /api/generations` also accepts `multipart/form-data` (`title`, `category`, optional `image`, one file) in addition to JSON. `multer` in memory.
- Validation: only JPEG, PNG and WebP, checked by the declared type and by the file's first bytes (magic bytes); maximum 5 MB (`MAX_IMAGE_BYTES`); every rejection is a 400 with code `invalid_image`.
- The photo is resized before it is sent (`sharp`: longest side 1024 px, JPEG quality 80, EXIF orientation applied, transparency flattened) to control tokens and cost. The original is saved as uploaded under a generated name in `UPLOADS_DIR` (the `uploads` Docker volume) and the name goes into `products.image_path`. A failed generation leaves no file.
- The image goes to the model as a base64 `image` block placed before the text, as the vision documentation recommends. Prompt v2 gains a rule: use what is visible, never invent what cannot be seen.
- `GET /api/products/:id/image` serves the original photo to its owner (404 for anyone else or when there is no photo). Products expose `imageUrl`.
- `.env.example`: `UPLOADS_DIR`, `MAX_IMAGE_BYTES`.
- `docs/experiments/t07-images.md`: three real photos, outputs, correctness of the visible attributes and the cost of a photo.

**Acceptance criteria.**

- Tests (LLM stubbed): a file over 5 MB → 400; a `.txt` renamed to `.jpg` → 400; a type that is not allowed, a corrupt image and two files → 400; a valid image reaches the LLM client as a resized JPEG image block before the text, only when a photo is given; the original is stored and served to its owner only; a failed generation stores nothing.
- A real `curl -F image=@photo.jpg` returns 201 with 3 descriptions and a non-null `imageUrl`; the same request without `image` still works.
- The experiment file shows the descriptions of 3 real photos and the input-token difference with and without the photo.

**Out of scope.** Cloud object storage or a CDN, background processing, several photos, virus scanning.

---

## T08 — Next.js frontend: form, results page, copy and edit

**Goal.** A minimal but clean UI for the whole flow: form → 3 descriptions → copy or edit, plus a history. It must look good on a 1080p screen, also at 125% zoom (1536 x 864 CSS pixels).

**Deliverables.**

- Tailwind CSS, no component library. Pages:
  - `/`: title, category select (the shared list), optional photo with drag and drop and preview. While generating, the button reads "Generating 3 descriptions…".
  - `/products/[id]`: the title, the photo and three cards (Short, Medium, SEO), each with a character counter, **Copy** (with "Copied" feedback) and **Edit** (textarea that saves with PATCH). An edited text is shown with an "Edited" badge and a "View original" link.
  - `/products`: the history, newest first, with "Load more".
- API errors in plain language: 429/503 "Too many requests, wait a few seconds", 422 "The model returned an invalid format, please retry", plus timeout, not found, network and validation messages.
- One typed API client, `apps/web/src/lib/api.ts`, that reuses the contract types of `packages/shared`.
- The browser only talks to the Next.js server, which forwards `/api/*` to the API (`rewrites`), so the API needs no CORS and photo URLs stay relative.
- Accessible by construction: labelled fields, landmarks, a skip link, focus styles, `role="alert"` for errors.
- `docs/screenshots/`: the empty form and a result page (used by the README).

**Acceptance criteria.**

- The whole flow works in a browser with and without a photo (checked against the real API).
- Playwright tests (API mocked with `route.fulfill`): fill in, generate, see the 3 cards, copy; empty form without an API call; photo preview and upload; edit and view original; every error message; history and "Load more".
- Lighthouse accessibility is at least 90 on `/` (measured on the production build).
- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.

**Out of scope.** Login, a marketing landing page, a cost dashboard, i18n, dark mode.

---

## T09 — Cost tracking, cost report and usage endpoint

**Goal.** Answer with real data "how much does one description cost?", "and 1,000?" and "what price would have to be charged?".

**Deliverables.**

- `src/llm/pricing.ts` re-checked against the official pricing page (prices unchanged) with its date updated.
- `pnpm --filter api cost:report` reads `llm_calls` and writes `docs/experiments/t09-costs.md`: average, p50 and p95 cost per generation without and with a photo; average input and output tokens; the retry rate and what retries cost; the projection for 1,000 and 10,000 generations; the comparison of two models; and an "Indicative pricing" section with 3 scenarios (100, 1,000 and 5,000 products a month) at a target margin of 80%, clearly marked as an estimate.
- `pnpm --filter api cost:sample` makes real generations (half of them with a photo, public prompt) to have data to measure; `pnpm --filter api cost:compare` runs the same 10 products with the cheap and a higher-tier model (`model:effort` settings) and writes `docs/experiments/t09-model-comparison.md` with empty 1-5 quality columns to fill in by hand.
- `llm_calls.prompt_version` now says which prompt was really used: a private prompt is stored as `v2-private`, so its cost (many more input tokens) never mixes with the public one.
- `LLM_EFFORT` (optional) is sent as `output_config.effort`. Found by the model comparison: Sonnet 5.5 at its default effort spends the whole `max_tokens` thinking and returns no text (20 calls, $0.33, no valid answer); with the effort low it answers in 5.9 s at x3.35 the cost of Haiku. The client also ignores response blocks it does not use (thinking).
- `GET /api/usage` (optional `?month=YYYY-MM`): the demo user's calls, valid generations, cost and tokens of a UTC month, failed calls included. Billing will read it later.

**Acceptance criteria.**

- The report is generated from at least 30 real `llm_calls`.
- Unit tests for the percentile calculation, the projection, the indicative price and the report; endpoint tests for `/api/usage` (month boundaries, other users, failed calls, bad input).
- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.

**Out of scope.** Stripe and real billing, a cost page in the web app, charts, budget alerts, currency conversion.

---

## T10 — Tests, fake model, demo seed, demo walkthrough and CI

**Goal.** Guarantee that the demo works on the first try and that the repository inspires confidence.

**Deliverables.**

- Coverage review of `apps/api` with a gate: at least 80% (lines, statements, functions and branches) in `src/generation` and `src/llm` (`pnpm --filter api test:coverage`). New tests for the service (photo cleanup when the database refuses the product, fake mode end to end), the prompt loader and the prompt labels (private vs public), the pool and its transactions, the LLM client (real waiting for `retry-after`), the environment and the demo data. The error middleware already had a test per mapping.
- A deterministic fake model, `LLM_FAKE=1` (`src/llm/fake.ts`): plausible descriptions in `OUTPUT_LANGUAGE` (es, en and fr; English for any other language), valid against the same schema as real answers, recorded in `llm_calls` as model `fake` with no cost. It needs no API key. Documented in `.env.example`; the API says so loudly when it starts in this mode.
- An end-to-end test of the real stack (`pnpm test:e2e`): Docker Compose (own project, own volumes) with `LLM_FAKE=1`, the demo seed, and Playwright tests that generate with and without a photo, copy, edit, reload, find the product in the history and check `GET /api/usage`; plus a real API rejection shown in the page. `docker-compose.yml` gains healthchecks for `api` and `web` so `docker compose up --wait` knows when the stack is ready.
- `pnpm --filter api seed:demo`: five realistic, already generated products (two with photos), in Spanish or English according to `OUTPUT_LANGUAGE`, inserted without calling a model; safe to run twice. Two royalty-free demo photos with their licences in `apps/api/demo/photos/`.
- `docs/demo.md`: the demo step by step (what to enter, which photo, what to point out on each card) and a plan B table for when something fails live.
- GitHub Actions (`.github/workflows/ci.yml`) on every push and pull request: lint, prettier, typecheck, API tests with coverage against a Postgres service, web Playwright tests, build; and a second job with the Compose end-to-end test using the fake model.

**Acceptance criteria.**

- `pnpm test`, `pnpm test:e2e` and the coverage gate pass; the workflow file is valid and its commands run locally.
- Following `docs/demo.md` from a clean clone works in under 5 minutes (measured with the fake model).
- `pnpm lint` and `pnpm typecheck` pass.

**Out of scope.** New features, load testing.

---

## T11 — Release preparation: separate public from private files, README, tag v0.1.0

**Goal.** Make the repository ready to be public and tag the first release.

**Deliverables.**

- Audit that the repo works with no private files: the loader falls back to the public prompts everywhere; a test asserts it.
- `README.md`: what it is, features, architecture diagram, quick start (`cp .env.example .env`, `docker compose up`), configuration table, API overview, project structure, and an honest "What is not included" section (real auth, roles, queues, billing, bulk import, and that the optimized production prompt is not part of the public repo).
- `CHANGELOG.md` with the `0.1.0` entry, `LICENSE`, `.env.example` reviewed line by line.
- Secret and private-content scan of the full history and tree (`git grep` for keys, `git ls-files` checked against the ignore list).
- Tag `v0.1.0` (annotated) on the final commit.

**Acceptance criteria.**

- `git clone` into a new folder, `cp .env.example .env`, add the API key, `docker compose up`: the full MVP Definition of Done works with no manual step.
- `git ls-files | grep -E '(^\.internal/|prompts/private/|\.private\.|^\.env$|^uploads/)'` prints nothing.
- Removing `apps/api/prompts/private/` (if present) and running `pnpm test` still passes.
- `git tag -l v0.1.0` shows the tag; `git describe --tags` returns `v0.1.0`.
- README, docs, commit messages and tags describe only the product and its engineering.

**Out of scope.** Publishing packages, hosting/deployment, semantic-release automation, a demo site.

---

## Risks

| Risk                                                                                                 | Impact                                  | Mitigation                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Inconsistent LLM format.** The model may return missing fields, extra text or wrong types.         | Broken results, failed requests.        | Structured output (JSON schema) (T05), zod validation, retry with error feedback, every invalid attempt logged, typed error and a clear 502 after retries.   |
| **Rate limits and provider outages.** 429/5xx from the API.                                          | Failed generations, slow responses.     | Timeouts, exponential backoff with jitter honouring `retry-after` (T03), clear user-facing error, failures logged with status.                               |
| **Cost.** Retries, long prompts and images raise the price per description.                          | Unit economics unclear or wrong.        | Token and cost logging from T03/T09, cost report, failed-call cost shown separately, model configurable so a cheaper one can be tried, output length limits. |
| **Image size.** Large photos inflate tokens, latency and memory, and the provider limits image size. | Slow or rejected requests, higher cost. | Type and size validation by content (T07), 5 MB default limit, one image per request; resizing is listed as future work.                                     |
| **Price drift.** Provider prices change.                                                             | Reports become inaccurate.              | Prices in a dated config file (T09), unknown model yields null cost instead of a wrong number.                                                               |
| **Prompt quality regressions.** Changing prompts silently lowers quality.                            | Worse descriptions.                     | Versioned prompt files, `prompt_version` stored in every `llm_calls` row.                                                                                    |
| **Photo content mismatch.** The model may invent attributes not visible in the photo.                | Wrong product claims.                   | Explicit instruction to describe only what is visible (T07); users can edit every variant.                                                                   |

## Future directions

- Real authentication, replacing the demo-user middleware.
- Roles and permissions.
- Background jobs for bulk generation.
- Event-driven services.
- Idempotent credit handling.
- Caching.

## MVP Definition of Done

A user can enter a product (with or without a photo), get 3 valid descriptions, copy or edit one, see the history and see the cost report, all from a clean clone with `docker compose up`.

Checklist:

- [ ] `git clone`, `cp .env.example .env`, set `ANTHROPIC_API_KEY`, `docker compose up` starts everything with no other step.
- [ ] The form accepts a title, a category and an optional photo, and returns 3 valid descriptions (short, medium, SEO).
- [ ] Each description can be copied, and edited while the original is kept.
- [ ] The history lists previous products and opens their results.
- [ ] The cost report shows cost per description and per 1,000 descriptions.
- [ ] Every LLM call, including failures, appears in `llm_calls`.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
- [ ] The repo works with no private files present, and nothing private is tracked.
