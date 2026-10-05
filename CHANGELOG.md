# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-05

First release.

### Added

- Product description generation from a title, a category and an optional photo: three versions per
  product (short, medium and SEO) from a single model call, in the language set by `OUTPUT_LANGUAGE`.
- Structured model output validated with zod, one retry on an invalid answer, and a prompt loader with
  versioned prompt files (`v1`, `v2`) that falls back to the public prompt when no private one exists.
- Photo upload (JPEG, PNG, WebP up to 5 MB) checked by magic bytes, resized for the model and stored on a
  volume; multimodal generation.
- REST API: generations, product history with cursor pagination, description edits that keep the original,
  monthly usage, health check, and a rate limit on generation.
- Next.js interface: form with drag and drop, result page with copy and edit, history.
- PostgreSQL schema with plain SQL migrations; a log of every model call (tokens, latency, status, cost),
  failures included.
- Cost report (`cost:report`), usage endpoint, and a measured cost per description
  ([report](docs/experiments/t09-costs.md)).
- `LLM_FAKE=1`: a deterministic fake model for tests, CI and demos without an API key.
- `seed:demo`: five example products inserted without calling a model.
- Docker Compose environment with healthchecks for the whole stack.
- Tests: unit and database integration tests with an 80% coverage gate in `src/generation` and `src/llm`,
  Playwright tests with the API mocked, and an end-to-end test of the real stack (`pnpm test:e2e`).
- GitHub Actions workflow: lint, formatting, types, tests, build and the end-to-end run.
- Documentation: README, demo walkthrough, project scope, task roadmap and the prompt and cost
  experiments.

### Not included

Real authentication, roles and permissions, background jobs, bulk catalog import, billing, and the
optimized production prompt. See the README.

[0.1.0]: https://github.com/bekodedev/describe-ia/releases/tag/v0.1.0
