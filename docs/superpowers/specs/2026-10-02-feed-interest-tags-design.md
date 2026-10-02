# Takprodam feed — interest tags on SQL Connect (Postgres)

## Context

The «Идеи» tab currently shows a swipe deck built from the Takprodam
affiliate feed (`server/takprodam.ts`, commit `b1f76b0`). Matching a card to
the viewer's interests happens client-side in
`pickOffersForInterests` (`src/giftIdeas.ts`): a plain case-insensitive
substring check of each interest string against the product title. This
misses anything not phrased the same way ("конный спорт" interest vs. "Седло
для верховой езды" title) and re-scans the whole in-memory offer list on
every render.

A SQL Connect service (`wishlly-932c0-service`) already exists and already
hosts an unrelated schema: the anonymized community-ideas layer from
[`2026-10-01-ideas-community-sql-design.md`](2026-10-01-ideas-community-sql-design.md)
(`IdeaItem`/`IdeaInterest`/`IdeaAdd`/`IdeaReport`, connector
`dataconnect/connector/ideas/`). That schema is deliberately scoped to
anonymized user wishes — it has no owner field by design, specifically to
keep a wish's author unreadable by any client. Affiliate feed products have
no such privacy concern and no moderation/voting workflow; reusing those
tables would conflate two unrelated domains under one data model.

This spec adds a second, independent data set to the same Postgres database
for tagging Takprodam products with real interest tags, replacing the
runtime substring match with precomputed tags queried by SQL.

## Goals

- Each Takprodam product is tagged with zero or more of the 100
  `INTEREST_CATEGORIES` strings, computed from a maintained keyword/synonym
  dictionary instead of a raw substring check against the title.
- `/api/gift-offers` can return products already filtered by the viewer's
  interests via a SQL join, instead of shipping the full offer list to the
  client for `pickOffersForInterests` to filter.
- No functional regression if Postgres/Data Connect is unavailable (trial
  expiry, credentials, outage): the endpoint and the client fall back to
  today's behavior (full offer list + client-side substring match).
- Tags are kept in sync with the live Takprodam cache on the existing
  30-minute cadence, including removing tags/products that drop out of the
  feed (filtered as kids' items, category removed, etc.).

## Non-goals

- Touching `dataconnect/connector/ideas/`, `IdeaItem`, or any part of the
  community-ideas layer — that schema and its security review are unrelated
  and out of scope.
- Replacing the substring-based `pickOffersForInterests` — it stays as the
  fallback path and is not deleted.
- A perfect or complete keyword dictionary for all 100 interests on day one.
  Coverage starts partial (seeded from the interests that map cleanly onto
  Takprodam's 12 category buckets) and grows over time; an untagged product
  simply never surfaces from the interest-filtered query and is only seen
  through the unfiltered fallback pool.
- Machine-learning/embedding-based matching (explored as a local PoC per
  [[project_ideas_tab_plan]] in project memory) — out of scope here, kept as
  a possible future iteration.

## Data model

New schema file `dataconnect/schema/feed.gql`, new connector directory
`dataconnect/connector/feed/` (added as a second entry in
`dataconnect.yaml`'s `connectorDirs`, alongside the existing `ideas` one —
kept separate so the privacy-sensitive `ideas` connector is never touched by
feed-catalog work):

```graphql
type FeedProduct @table {
  externalId: String! @unique   # "takprodam_<offer.id>", matches src/giftIdeas.ts id format
  title: String!
  imageUrl: String!
  link: String!
  priceAmount: Float
  priceCurrency: String
  category: String!             # Takprodam bucket: sport, odejda, krasota, ... (see server/takprodam.ts CATEGORY_IDS)
  updatedAt: Timestamp! @default(expr: "request.time")
}

type FeedProductInterest @table(key: ["product", "interest"]) {
  product: FeedProduct!
  interest: String!             # one of the 100 INTEREST_CATEGORIES strings
}
```

Connector operations (`dataconnect/connector/feed/`):
- `FeedProduct_upsert` mutation (by `externalId`).
- `FeedProduct_delete` mutation (by `externalId`).
- `FeedProductInterest_deleteMany` mutation (by `product`), `FeedProductInterest_insertMany` mutation — same delete-then-insert replace pattern as `ideasMirror.ts` uses for `IdeaInterest`.
- `FeedProduct_listIds` query — all current `externalId`s, for the mirror job's reconcile/delete pass.
- `FeedProduct_byInterests` query — products joined to `FeedProductInterest` where `interest` is in a given list, deduped.

## Interest tagging

`server/takprodam.ts`'s `TakprodamOffer` gains a `category: string` field
(the bucket id from `CATEGORY_IDS`, currently computed but not threaded
through to the returned offer).

New file `server/feedInterestTags.ts`:

```ts
export function tagInterests(category: string, title: string): string[]
```

- A static table maps each Takprodam `category` bucket to the subset of the
  100 interests it can plausibly contain (e.g. bucket `sport` → the ten
  `INTEREST_CATEGORIES` items under "Спорт", plus any from adjacent groups
  that commonly appear there).
- For each candidate interest in that subset, a keyword/synonym list (seeded
  from the manual dictionary work already done in the local embeddings PoC,
  per [[project_ideas_tab_plan]]) is checked against the lowercased title;
  a hit tags the product with that interest.
- A product can get zero, one, or multiple tags. Zero tags is expected and
  not an error — the product still exists in `FeedProduct` and is reachable
  through the untagged/unfiltered fallback pool, just never through an
  interest-filtered query.
- The dictionary starts covering only the interests that have a clear
  Takprodam category home; gaps are filled incrementally as real product
  titles reveal missed phrasing — this is explicitly not a one-time
  complete deliverable (see Non-goals).

## Ingestion job

New file `server/feedMirror.ts`, modeled on the existing
`server/ideasMirror.ts` reconcile pattern:

- `runFeedMirror()`: reads `getTakprodamOffers()` (now including
  `category`), and for each offer:
  - upserts `FeedProduct` (externalId, title, imageUrl, link, price,
    category),
  - computes `tagInterests(category, title)` and replaces that product's
    `FeedProductInterest` rows (delete-then-insert, same as
    `replaceIdeaInterests` in `ideasMirror.ts`).
  - A failure on one product (SQL error, etc.) is caught and logged per-item
    with `continue`, matching the project's existing pattern for
    per-item resilience with external services (e.g. `isTrackable`/
    `isKidsProduct` filtering in `takprodam.ts`, and the try/catch-per-item
    style already used around external API calls). It must not abort the
    whole run.
  - After the upsert pass, `FeedProduct_listIds` is diffed against the
    current offer id set; ids no longer present (filtered out, removed from
    category, Takprodam stopped returning them) are deleted via
    `FeedProduct_delete`, cascading their `FeedProductInterest` rows.
- `startFeedMirrorScheduler()`: same `setInterval` + immediate-first-run
  shape as `startIdeasMirrorScheduler()`, on the same cadence as the
  Takprodam cache TTL (`CACHE_TTL_MS`, 30 minutes) since re-tagging more
  often than the underlying feed refreshes has no effect.
- Called from `server/index.ts` next to `startIdeasMirrorScheduler()`.

## Serving and client

- `GET /api/gift-offers` accepts an optional `interests` query param (a
  comma-separated list, matching `userProfile.interests` as already passed
  into `IdeaSwipeStack`).
  - With a non-empty list: one `FeedProduct_byInterests` GraphQL query,
    deduped, mapped to the existing `TakprodamOffer`-shaped JSON response
    (`offerToGiftIdea` in `src/giftIdeas.ts` is unaffected — it only knows
    about the wire shape, not the source).
  - With no list, or a query that matches nothing: falls back to the full
    current `getTakprodamOffers()` list, same as today's no-filter
    behavior — the deck must never come up empty because of an interest
    that has no tagged products yet.
  - On any Data Connect error (unreachable, trial lapsed, permissions): caught,
    logged, and the response falls back to the same full unfiltered
    `getTakprodamOffers()` list — identical to the query-matches-nothing
    path, so a SQL outage degrades to exactly today's behavior rather than
    an empty or broken tab.
- `src/components/IdeaSwipeStack.tsx`: the `/api/gift-offers` fetch gains
  `?interests=<encoded list>` and re-fires when `interests` changes (it
  currently fetches once on mount with no dependency on `interests`).
  `pickOffersForInterests` is kept as-is and still runs client-side on
  whatever the endpoint returns — it is now closer to a no-op when the
  server already filtered, and remains the real filter when the server
  fell back to the unfiltered list.

## Testing

- `tests/server/feedInterestTags.test.ts`: unit tests for `tagInterests`
  against representative real-looking titles per covered interest —
  asserts the right tag is found and an unrelated interest from the same
  category bucket is not, for at least the interests seeded in the first
  dictionary pass.
- `tests/server/feedMirror.test.ts`: reconcile behavior against a mocked
  Data Connect client (upsert-then-delete-stale), modeled on the existing
  `ideasMirror` test's structure — covers a product gaining tags, losing
  tags, and disappearing from the feed entirely.
- `tests/server/giftOffers.test.ts`: extended for the `interests` query
  param (match found, no match → fallback, no param → today's behavior) and
  for the Data Connect error → fallback path.
- `tests/e2e/ideas.spec.ts`: unchanged in intent (still asserts a non-empty
  deck); no new assertions required by this spec.

## Rollout

- Ships behind no flag — the `interests` param is optional and every new
  code path has a fallback to current behavior, so this can go out as a
  normal deploy once tests pass.
- `dataconnect/schema/feed.gql` and the `feed` connector need a
  `dataconnect:sql:migrate` / connector deploy step against
  `wishlly-932c0-service`, same as the existing `ideas` schema/connector —
  run by whoever holds deploy access, same constraint as every other
  production deploy in this repo.
