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

| ID  | Title                                                              | Depends on         | Est. (h) | Status |
| --- | ------------------------------------------------------------------ | ------------------ | -------- | ------ |
| T01 | Monorepo bootstrap, TypeScript tooling and Docker Compose          | —                  | 3        | [ ]    |
| T02 | Database schema, migrations and demo user                          | T01                | 3        | [ ]    |
| T03 | HTTP LLM client: config, timeouts, retries, token-usage logging    | T01, T02           | 4        | [ ]    |
| T04 | Naive prompt v1 and generation service                             | T03                | 3        | [ ]    |
| T05 | Structured output, zod validation and retry on invalid format      | T04                | 4        | [ ]    |
| T06 | API endpoints (generate, list, view, edit description)             | T02, T05           | 4        | [ ]    |
| T07 | Optional photo: upload, validation, multimodal request             | T06                | 4        | [ ]    |
| T08 | Next.js frontend: form, results page, copy and edit                | T06, T07           | 6        | [ ]    |
| T09 | Cost tracking and cost report (per description / per 1,000)        | T05, T06, T08      | 3        | [ ]    |
| T10 | Tests, demo data and end-to-end demo walkthrough                   | T01–T09            | 5        | [ ]    |
| T11 | Release preparation: public/private split, README, tag v0.1.0      | T01–T10            | 3        | [ ]    |

Total: about 42 hours.

## Changes from the base list

The base order and scope are kept: no task is merged, split or reordered. Four problems were found and are resolved by clarifying scope, not by changing the list:

1. **Docker Compose must serve the whole stack, not only Postgres.** The Definition of Done requires `docker compose up` from a clean clone. T01 therefore creates `postgres`, `api` and `web` services (the last two with a "hello world" body), and each later task extends them (T02 runs migrations on API start, T07 adds the uploads volume). Otherwise the full-stack setup would land untested in T11.
2. **The prompt loader with public fallback belongs in T04, not T11.** The private/public split affects how every prompt file is read. Building the loader when the first prompt is written avoids reworking T04 and T05 later. T11 only audits and documents the split.
3. **Tests are written per task, not only in T10.** The per-task finish rule requires tests to pass, so each task ships its own unit/integration tests. T10 adds the cross-cutting layer: end-to-end flow, demo data and the walkthrough.
4. **Cost is computed in T09, but the columns exist from T02.** `llm_calls` has `input_tokens`, `output_tokens` and a nullable `cost_usd` from the start; T03 fills tokens and latency, T09 adds the pricing table and fills `cost_usd`.

## Conventions used in the acceptance criteria

- `docker compose up -d` is the way to run the stack; `pnpm <script>` commands run from the repo root through pnpm workspaces (`pnpm --filter api <script>`, `pnpm --filter web <script>`); package names are `api` and `web`.
- Commands that call the real Anthropic API need `ANTHROPIC_API_KEY` in `.env`. Automated tests never call the real API; they stub `fetch`.
- `$API` is `http://localhost:4000`, `$WEB` is `http://localhost:3000`.

---

## T01 — Monorepo bootstrap, TypeScript tooling and Docker Compose

**Goal.** Create an empty but fully wired monorepo where `docker compose up` starts Postgres, the API and the web app, and where lint, typecheck and test commands already run.

**Deliverables.**
- Root `package.json` with `packageManager` pinned to pnpm, `pnpm-workspace.yaml` (`apps/*`), `tsconfig.base.json`, ESLint + Prettier config, `.editorconfig`.
- `apps/api`: Express app with `GET /health`, config module that reads and validates env vars with zod (`DATABASE_URL`, `PORT`, `OUTPUT_LANGUAGE` as 2-letter ISO 639-1 with default `es`, and the LLM variables as optional until T03), Vitest set up with one smoke test.
- `apps/web`: Next.js app with a placeholder home page.
- `apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.yml` (`postgres` with healthcheck and named volume, `api`, `web`).
- `.env.example`, `.gitignore` (with the required entries), `CLAUDE.md`, `.internal/devlog.md` present locally.
- CLAUDE.md commands updated from TODO to real ones.

**Acceptance criteria.**
- `docker compose up -d --build` then `docker compose ps` shows `postgres` healthy, `api` and `web` running.
- `curl $API/health` returns `{"status":"ok"}`; `curl -s $WEB` returns HTTP 200.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` exit with code 0.
- Starting the API with `OUTPUT_LANGUAGE=english` fails with a clear config error; with no value it uses `es`.
- `git status` does not list `.env`, `.internal/`, `uploads/`.

**Out of scope.** Database schema, LLM code, any real UI.

---

## T02 — Database schema, migrations and demo user

**Goal.** Define the PostgreSQL schema with plain SQL migrations and a demo user injected by a middleware, so every row already carries a `user_id`.

**Deliverables.**
- `node-pg-migrate` configured with SQL migrations in `apps/api/migrations/`.
- Tables:
  - `users` (id uuid PK, email, name, created_at).
  - `products` (id, user_id FK, title, category, image_path nullable, created_at).
  - `descriptions` (id, product_id FK, user_id FK, variant in `short|medium|seo`, original_text, edited_text nullable, created_at, updated_at; unique on product_id + variant).
  - `llm_calls` (id, user_id FK, product_id FK nullable, purpose, model, prompt_version, attempt, input_tokens, output_tokens, cost_usd nullable, latency_ms, status in `ok|http_error|timeout|invalid_format`, error_message nullable, created_at).
- A seed migration (or idempotent startup step) that creates the fixed demo user with a constant UUID.
- `pg` pool module (`db/pool.ts`) and a `demoUser` middleware that sets `req.user` from that constant.
- Migrations run automatically when the `api` container starts.
- Scripts: `migrate:up`, `migrate:down`, `migrate:create`.

**Acceptance criteria.**
- From an empty database, `docker compose up -d` results in all four tables (`docker compose exec postgres psql -U postgres -d describeia -c "\dt"`).
- `pnpm --filter api migrate:down` followed by `migrate:up` works with no error (reversible).
- `SELECT count(*) FROM users` returns 1; running migrations twice keeps it at 1.
- An integration test proves a request through the app has `req.user.id` equal to the demo user.
- Inserting a description with an invalid variant fails on the database constraint.

**Out of scope.** Repositories for each table (added with the feature that needs them), real auth, indexes beyond primary keys, foreign keys and the history lookup (`products(user_id, created_at desc)`).

---

## T03 — HTTP LLM client: config, timeouts, retries and token-usage logging

**Goal.** Provide one isolated function that calls the Anthropic Messages API with `fetch`, handles transport failures, and records every call in `llm_calls`.

**Deliverables.**
- `apps/api/src/llm/client.ts` exposing a single function (for example `callModel(request): Promise<ModelResponse>`); no other file talks to the provider.
- Env vars: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (required, no hard-coded model in code), `ANTHROPIC_BASE_URL` (default official URL), `LLM_TIMEOUT_MS`, `LLM_MAX_RETRIES`. `.env.example` defaults `ANTHROPIC_MODEL` to the cheaper development model `claude-haiku-4-5-20251001` and documents `claude-sonnet-5-5` as the suggested production value; switching is only an `.env` change.
- Timeout through `AbortController`.
- Retries with exponential backoff and jitter on network errors, timeouts, HTTP 429 and 5xx; honour `retry-after`; no retry on other 4xx.
- After each call (success or failure) an `llm_calls` row is written with model, tokens, latency and status; the API key is never logged.
- `fetch` is injected so tests can stub it.
- A `pnpm --filter api llm:smoke` script that sends one tiny prompt to the real API and prints the reply and token usage.

**Acceptance criteria.**
- `pnpm test` includes tests that, with a stubbed `fetch`, prove: success is logged with tokens; 429 then 200 succeeds after one retry; a 400 is not retried; a hung request ends with status `timeout`; each attempt has its own `llm_calls` row.
- `pnpm --filter api llm:smoke` (real key) prints a reply and non-zero token counts, and a matching row appears in `llm_calls`.
- With an invalid key the smoke script exits non-zero and a `http_error` row is stored, with no key in the log output.

**Out of scope.** Prompts, structured output, format validation, cost computation, streaming, other providers.

---

## T04 — Naive prompt v1 and generation service

**Goal.** Get a first end-to-end generation working with a deliberately simple prompt and no structured output, and put in place the versioned prompt loader with private/public fallback.

**Deliverables.**
- `apps/api/prompts/public/description.v1.md` with `{{title}}`, `{{category}}` and `{{language}}` variables (language comes from `OUTPUT_LANGUAGE`, never hard-coded).
- Prompt loader: looks first in `apps/api/prompts/private/<name>`, falls back to `apps/api/prompts/public/<name>`, logs which one was used (name only) and reports the prompt version; unit-tested.
- `apps/api/src/services/generation.ts`: builds the prompt, calls the LLM client, returns the raw text.
- A dev script `pnpm --filter api generate:demo "Title" "Category"` that prints the raw output.
- Nothing is committed under `apps/api/prompts/private/`; the loader must work when the folder does not exist.

**Acceptance criteria.**
- Loader tests: private file present → private used; absent → public used; variables replaced; unknown variable placeholders raise an error.
- `pnpm --filter api generate:demo "Stainless steel water bottle 750 ml" "Sports"` prints text in the language set in `OUTPUT_LANGUAGE`; changing it to `en` changes the output language with no code change.
- An `llm_calls` row with `prompt_version = description.v1` exists after the run.
- The output is knowingly unstructured (3 variants are not reliably separable); this is documented in a short comment and in the devlog.

**Out of scope.** JSON/tool output, validation, persistence of products and descriptions, HTTP endpoints.

---

## T05 — Structured output, zod validation and retry on invalid format

**Goal.** Make the model return the 3 variants in a machine-checkable shape, validate it with zod, and retry when the shape is wrong.

**Deliverables.**
- `description.v2.md` prompt (public) asking for the 3 variants, with length guidance per variant.
- Structured output through a forced tool call (`tools` + `tool_choice`) on the Messages API, still with plain `fetch`.
- zod schema `GenerationResult`: `short`, `medium`, `seo` as non-empty strings with sensible max lengths.
- Retry on invalid format: up to `LLM_MAX_FORMAT_RETRIES` (default 2), each attempt logged as its own `llm_calls` row with status `invalid_format` and the validation error summary; on the retry the error is fed back to the model.
- A typed error (`InvalidModelOutputError`) after retries are exhausted.
- Service returns a validated object instead of raw text.

**Acceptance criteria.**
- Tests with stubbed responses: valid → passes; missing field → retried and succeeds; three consecutive bad answers → `InvalidModelOutputError` and 3 `invalid_format` rows; extra fields are stripped.
- `pnpm --filter api generate:demo "Stainless steel water bottle 750 ml" "Sports"` prints three distinct variants, validated.
- Running it 10 times against the real API yields 10 valid results (note the number of retries needed in the devlog).

**Out of scope.** HTTP endpoints, persistence of products/descriptions, images.

---

## T06 — API endpoints (generate, list, view, edit description)

**Goal.** Expose the product flow over HTTP, persisting products and descriptions and validating all input.

**Deliverables.**
- `POST /api/generations` (JSON: `title`, `category`) → creates the product, calls the service, stores the 3 descriptions (`original_text`) and returns the product with its descriptions. Product and descriptions are saved in one transaction.
- `GET /api/products` → history for the demo user, newest first, with pagination (`limit`, `offset`).
- `GET /api/products/:id` → product with its 3 descriptions.
- `PATCH /api/descriptions/:id` (JSON: `text`) → sets `edited_text`, keeps `original_text`.
- zod validation on every body/param/query; consistent error shape `{ "error": { "code", "message" } }`; central error handler mapping `InvalidModelOutputError` to 502 and validation errors to 400.
- Ownership check: only rows of the requesting user are visible.
- Repositories with plain SQL in `apps/api/src/db/`.

**Acceptance criteria.**
- `curl -X POST $API/api/generations -H 'content-type: application/json' -d '{"title":"Stainless steel water bottle 750 ml","category":"Sports"}'` returns 201 with 3 descriptions.
- `curl $API/api/products` lists it; `curl $API/api/products/<id>` returns it with 3 descriptions.
- `curl -X PATCH $API/api/descriptions/<id> -H 'content-type: application/json' -d '{"text":"My edit"}'` returns 200 and a later GET shows `edited_text` set and `original_text` unchanged.
- Empty title, title over the length limit and unknown category input return 400 with the error shape.
- If generation fails, no product or description rows remain (transaction test), and the failed `llm_calls` rows are still stored.
- `pnpm test` passes with the LLM stubbed.

**Out of scope.** Photo upload, cost report, frontend, pagination cursors, delete endpoints.

---

## T07 — Optional photo: upload, validation and multimodal request

**Goal.** Let a product include one photo that is validated, stored locally and sent to the model so the descriptions can use what is visible in it.

**Deliverables.**
- `POST /api/generations` accepts `multipart/form-data` (`title`, `category`, optional `image`) as well as JSON.
- Validation: allowed types `image/jpeg`, `image/png`, `image/webp` checked by content (magic bytes), not only by header; max size configurable (`MAX_IMAGE_BYTES`, default 5 MB); one file only.
- Files stored under `uploads/` with a generated file name (never the client's name); path saved in `products.image_path`; `uploads` is a Docker volume.
- LLM client supports an image content block (base64) in the request.
- Prompt `description.v3.md` (public) with a rule to describe only what is visible and never invent attributes; falls back to the text-only behaviour when there is no image.
- `GET /api/products/:id/image` serves the stored photo.
- `.env.example` updated with `MAX_IMAGE_BYTES` and `UPLOADS_DIR`.

**Acceptance criteria.**
- `curl -X POST $API/api/generations -F title='Ceramic mug' -F category='Home' -F image=@sample.jpg` returns 201 with 3 descriptions and a non-null `image_path` on the product.
- A `.txt` file renamed to `.jpg` returns 400; a file over `MAX_IMAGE_BYTES` returns 413; two files return 400.
- The `llm_calls` row for the request reports higher `input_tokens` than the same request without an image.
- The same request without `image` still works.
- Tests cover validation and check that the request body sent to the (stubbed) model contains an image block only when a photo is given.

**Out of scope.** Image resizing or compression, multiple photos, cloud object storage, virus scanning.

---

## T08 — Next.js frontend: form, results page, copy and edit

**Goal.** Provide a minimal but usable UI covering the whole flow: create, view, copy, edit and browse history.

**Deliverables.**
- Pages: `/` (form with title, category, optional photo with preview), `/products/[id]` (results), `/history` (list).
- Results page: three cards (short, medium, SEO), each with **Copy** (clipboard) and **Edit** (inline textarea, save, and "restore original").
- Loading state during generation and clear error states (validation, model failure, network).
- A single typed API client module in `apps/web/src/lib/api.ts`; base URL from `NEXT_PUBLIC_API_URL`.
- Minimal, dependency-light styling (plain CSS or CSS modules); all UI strings in English.
- CORS configured on the API for the web origin.

**Acceptance criteria.**
- With `docker compose up -d`, opening `$WEB`, filling the form (with and without photo) and submitting leads to `/products/<id>` showing 3 descriptions.
- Copy places the exact text in the clipboard; Edit + Save persists after a page reload; "Restore original" brings back the original text.
- `/history` lists the created products, newest first, each linking to its result page.
- Submitting an empty title shows an inline error without calling the API.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass (component tests for the copy/edit logic).

**Out of scope.** Authentication screens, i18n framework, design system, dark mode, analytics.

---

## T09 — Cost tracking and a "cost per description / cost per 1,000" report

**Goal.** Turn recorded token usage into money and report what a description really costs.

**Deliverables.**
- Pricing table in a versioned config file (`apps/api/config/pricing.json`) keyed by model id (must include both the development and the production model) with input and output prices per million tokens, plus a note on the date the prices were checked; unknown model → `cost_usd` stays null and a warning is logged.
- Cost computed and stored in `llm_calls.cost_usd` at write time (from tokens × prices).
- `GET /api/reports/cost` returning: total calls, successful and failed calls, total cost, cost per successful generation, cost per description (3 per generation), projected cost per 1,000 descriptions, average latency, and the cost wasted on failed/invalid calls.
- A `/costs` page in the web app showing those figures, linked from the header.
- `pnpm --filter api report:cost` prints the same report in the terminal.

**Acceptance criteria.**
- Unit tests: known token counts and prices give the exact expected cost; unknown model gives null.
- After 3 generations, `curl $API/api/reports/cost` returns totals consistent with `SELECT sum(cost_usd) FROM llm_calls` and `cost_per_1000_descriptions = cost_per_description * 1000`.
- The `/costs` page shows the same numbers as the endpoint.
- Failed calls are counted in the total cost but not in the per-description denominators.

**Out of scope.** Charts, date filters, per-user breakdown, budget alerts, currency conversion, billing.

---

## T10 — Tests, demo data and an end-to-end demo walkthrough

**Goal.** Close quality gaps with cross-cutting tests, deterministic demo data and a documented walkthrough that anyone can follow.

**Deliverables.**
- Coverage review: missing unit/integration tests for services, repositories and routes, run against a real Postgres (the compose one or a test database).
- One end-to-end test of the full API flow (generate → list → view → edit → report) with the LLM stubbed.
- `pnpm --filter api seed:demo`: creates about 10 sample products (with and without photo, several categories) through the real service, so it needs the API key; plus a fixtures option that inserts pre-written descriptions with no LLM calls.
- Sample images under `apps/api/demo/images/` (royalty-free or generated, with license note).
- `docs/DEMO.md`: step-by-step walkthrough from clean clone to seeing the cost report, with expected outputs.

**Acceptance criteria.**
- `pnpm test` passes in a clean environment with no API key set.
- `pnpm --filter api seed:demo --fixtures` populates history without any LLM call (`llm_calls` unchanged).
- Following `docs/DEMO.md` literally on a clean clone produces the outcomes it describes.
- `pnpm lint` and `pnpm typecheck` pass.

**Out of scope.** Browser automation frameworks, load testing, CI setup beyond a simple workflow file if wanted.

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

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Inconsistent LLM format.** The model may return missing fields, extra text or wrong types. | Broken results, failed requests. | Forced tool call for structure (T05), zod validation, retry with error feedback, every invalid attempt logged, typed error and a clear 502 after retries. |
| **Rate limits and provider outages.** 429/5xx from the API. | Failed generations, slow responses. | Timeouts, exponential backoff with jitter honouring `retry-after` (T03), clear user-facing error, failures logged with status. |
| **Cost.** Retries, long prompts and images raise the price per description. | Unit economics unclear or wrong. | Token and cost logging from T03/T09, cost report, failed-call cost shown separately, model configurable so a cheaper one can be tried, output length limits. |
| **Image size.** Large photos inflate tokens, latency and memory, and the provider limits image size. | Slow or rejected requests, higher cost. | Type and size validation by content (T07), 5 MB default limit, one image per request; resizing is listed as future work. |
| **Price drift.** Provider prices change. | Reports become inaccurate. | Prices in a dated config file (T09), unknown model yields null cost instead of a wrong number. |
| **Prompt quality regressions.** Changing prompts silently lowers quality. | Worse descriptions. | Versioned prompt files, `prompt_version` stored in every `llm_calls` row. |
| **Photo content mismatch.** The model may invent attributes not visible in the photo. | Wrong product claims. | Explicit instruction to describe only what is visible (T07); users can edit every variant. |

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
