# Demo walkthrough

The live part of the video (block 7 of the script) takes two minutes. This page gets you there from a
clean clone in under five, tells you what to enter and what to point out, and has a plan B for when
something fails live.

## 1. Set up (once, about 5 minutes)

You need Git and Docker. An Anthropic API key is optional: without one, the app uses a fake model that
returns plausible descriptions (see "Plan B").

```bash
git clone <repository-url> describe-ia
cd describe-ia
cp .env.example .env
```

Open `.env` and choose one of the two:

- **Real model:** write your key after `ANTHROPIC_API_KEY=`.
- **No key:** write `1` after `LLM_FAKE=`.

Then:

```bash
docker compose up -d --build --wait    # postgres + api + web; waits until all three are healthy
docker compose exec api pnpm seed:demo # five products already generated, so the history is not empty
```

Open <http://localhost:3000>. You should see the form, and **History** should list five products
(an urban hiking backpack, a travel pouch, a coffee dripper, a face serum and headphones).

The first start builds the images (a couple of minutes); later starts take seconds. The descriptions
are in the language of `OUTPUT_LANGUAGE` in `.env` (`es` by default).

If something does not start: `docker compose logs api web`. Ports 3000, 4000 and 5432 must be free.

## 2. The demo, step by step

| #   | Do                                                            | Point out                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Open `/` (**New description**).                               | Three fields only: title, category, an optional photo. Nothing else to configure.                                                                                                                            |
| 2   | Title: `Urban hiking backpack`. Category: `Sports`.           | The category list is closed (it is shared with the API). Submit with the title empty to show the inline error: no request is sent.                                                                           |
| 3   | Drag `apps/api/demo/photos/backpack.jpg` onto the photo zone. | The preview, the size, **Remove**. Only JPEG, PNG and WebP up to 5 MB are accepted.                                                                                                                          |
| 4   | Click **Generate descriptions**.                              | The button turns into "Generating 3 descriptions…". About 4 seconds with the real model; instant with the fake.                                                                                              |
| 5   | The result page opens.                                        | Your photo next to three cards. The URL has the product id: it is saved.                                                                                                                                     |
| 6   | **Short** card.                                               | One sentence. The counter shows the length. With the real model it mentions what is in the photo: dark grey body, brown base, orange details. Say that the model is told to describe only what it sees.      |
| 7   | **Copy** on the short card, paste it into any text field.     | The button says "Copied". The pasted text is exactly the card.                                                                                                                                               |
| 8   | **Medium** card, **Edit**: change a word, **Save**.           | The "Edited" badge appears. **View original** shows what the model wrote: an edit never overwrites it. Reload the page: the edit is still there.                                                             |
| 9   | **SEO** card.                                                 | The longest one, written for search engines.                                                                                                                                                                 |
| 10  | **History**.                                                  | Your product is first, with its photo; the five seeded ones below.                                                                                                                                           |
| 11  | In a terminal: `curl localhost:4000/api/usage`.               | What the AI calls of this month cost, to the cent (zero with the fake model). The real figure for the product: about **$0.0024 per description, $2.44 per 1,000** ([cost report](experiments/t09-costs.md)). |

Material for the story, if you want to show it on screen:

- The first prompt failed in every run: [docs/experiments/t04-v1-outputs.md](experiments/t04-v1-outputs.md).
- What fixed it, with numbers: [docs/experiments/t05-v1-vs-v2.md](experiments/t05-v1-vs-v2.md).
- Photos: what the model gets right and wrong: [docs/experiments/t07-images.md](experiments/t07-images.md).

## 3. Plan B: when it fails live

| What you see                                                             | Why                                                                                     | What to do (seconds)                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Too many requests, wait a few seconds…"                                 | The provider is rate limiting (503), or the app's own limit of 10 generations a minute. | Wait the seconds it says, or go to the next row.                                                                                                                                                            |
| "Something went wrong… (reference …)" or "The AI service took too long…" | The network, a TLS problem on this machine, or the provider is down.                    | Switch to the fake model (next row). The reference id is in `docker compose logs api`.                                                                                                                      |
| Anything else with the model                                             |                                                                                         | **Fake model:** in `.env` set `LLM_FAKE=1`, run `docker compose up -d api` (the API restarts in a few seconds) and generate again. The descriptions look the same, in your language, and cost nothing.      |
| You do not want to generate at all                                       |                                                                                         | Open **History** and use the five seeded products: the cards, **Copy**, **Edit** and **View original** work exactly the same.                                                                               |
| The web does not load                                                    |                                                                                         | The API works on its own: `curl -X POST localhost:4000/api/generations -F title='Urban hiking backpack' -F category=Sports -F image=@apps/api/demo/photos/backpack.jpg` (more in `apps/api/requests.http`). |
| The page looks stuck                                                     |                                                                                         | `docker compose ps` (all three should be healthy), then `docker compose restart web`.                                                                                                                       |

## 4. Reset and check

- Start again from nothing: `docker compose down -v` (this deletes the database and the photos), then step 1.
- Before recording, remove old experiments from the history: `docker compose down -v` and the two commands of step 1.
- The automated version of this walkthrough, with the fake model: `pnpm test:e2e` (starts its own stack,
  generates with and without a photo, copies, edits, reloads, checks the history and the seeded
  products, and tears everything down). It needs the development stack stopped.
