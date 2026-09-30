# DescribeIA — project brief

## What it is

A micro-SaaS that generates product descriptions for online stores from a product title, a category and an optional photo, using an LLM.

## Problem

Owners of online stores (Shopify, WooCommerce, …) have catalogs with hundreds or thousands of products that have no description, or only a generic one copied from the supplier. Writing good descriptions by hand does not scale, and empty or duplicated product pages hurt both conversion and search visibility.

## Who it is for

- Small and mid-size e-commerce owners without a copywriting team.
- Agencies managing several stores that need content in volume.
- Dropshippers importing catalogs with poor supplier descriptions.

## MVP scope

Included:

- A form: product title + category + optional photo.
- One LLM call that generates 3 description variants: short (for listings), medium (for the product page) and SEO-friendly.
- A result page where each variant can be copied and edited (the original is kept).
- A history of generated products.
- Persistence in PostgreSQL: users, products, descriptions and a log of every LLM call (tokens, cost, latency, status).
- Cost tracking and a cost report (cost per description, per 1,000 descriptions).

Out of scope for this version:

- Real authentication: a fixed demo user is injected by a middleware. The `user_id` column exists from the start so real auth can replace that middleware later.
- Roles and permissions.
- Background/batch processing and queues.
- Usage-based billing and payments.
- Bulk catalog import.

## Technical stack

- Monorepo: `apps/api` (Node.js + TypeScript + Express) and `apps/web` (Next.js, minimal UI).
- PostgreSQL with plain SQL migrations (`node-pg-migrate`) and the `pg` driver. No ORM.
- LLM: Anthropic Messages API called directly with `fetch` (no agent SDKs or frameworks). Model configurable through an environment variable.
- Docker Compose brings up the whole local environment with a single command.
- All code, identifiers, comments, UI strings and repo documentation are in English. The language of the **generated descriptions** is configurable through `OUTPUT_LANGUAGE` in `.env` (an ISO 639-1 code, default `es`); it is never hard-coded in prompts or code.

## Architecture (high level)

```text
[Next.js frontend] -> [Express API] -> [LLM provider API]
                            |
                      [PostgreSQL]
```

## Design principles

- Keep the backend simple and readable: small handlers, business logic in services, the LLM client isolated behind one function.
- Prompts live in versioned files, not in code.
- Every LLM call is recorded (including failures) so real costs can be measured from day one.
- Validate everything that comes from outside the system: user input and model output.
- Some prompt files may be kept local and untracked (`apps/api/prompts/private/`, git-ignored). The loader always falls back to the public prompt, so the repo works out of the box. The README states honestly what is not included.

## Future work (not part of this version)

Real authentication, roles and permissions, background jobs for bulk generation, event-driven services, idempotent credit/payment handling, caching. These are listed in the roadmap only as product directions, never as scheduled deliverables.
