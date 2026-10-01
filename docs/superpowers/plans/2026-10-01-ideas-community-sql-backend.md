# Ideas community layer — SQL Connect backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Postgres (SQL Connect) schema, connector, and a server-side mirror job that copies opted-in Firestore wishes into an anonymized, moderated community-ideas pool, with access rules enforced at the Data Connect layer.

**Architecture:** A local Data Connect workspace (`dataconnect/`) defines four Postgres tables (`IdeaItem`, `IdeaInterest`, `IdeaAdd`, `IdeaReport`) and a connector with one client-facing read query and three client-facing mutations (`addIdea`, `removeIdea`, `reportIdea`), all `@auth(level: USER)` and scoped to `auth.uid`. A new poller in the existing Express server (`server/ideasMirror.ts`, started the same way as `server/notifications.ts`'s `startReminderScheduler`) watches Firestore `wishes` for `shareToIdeas` and mirrors/deletes the matching `IdeaItem` via the Data Connect Admin SDK, which bypasses `@auth` entirely (admin writes never go through client-facing mutations).

**Tech Stack:** Firebase Data Connect (Cloud SQL Postgres) GraphQL schema/connector, `firebase-admin/data-connect` (already present via `firebase-admin@14.5.0`), existing Express/tsx server, Node's built-in `node:test` runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-10-01-ideas-community-sql-design.md`

## Global Constraints

- Postgres is used only for this community layer — Profile/Friendship/Reservation/Group/GiftSwipe/NotificationLog stay on Firestore (spec Non-goals).
- No row in any new table stores the original Firestore wish owner's id (spec Data model).
- Every client-facing mutation on `IdeaAdd`/`IdeaReport` must bind `userId`/`reporterId` from `auth.uid` via a server expression (`_expr: "auth.uid"`), never from a client-supplied variable (spec Access rules).
- `createIdeaItem`/status changes are never reachable by a client auth context — only the admin SDK, called without `impersonate` (spec Access rules).
- Existing backend service/instance (`wishlly-932c0-service`, `wishlly-932c0-instance`, database `wishlly-932c0-database`, region `europe-north1`) is reused — do not create a new Cloud SQL instance.
- This repo has no Firebase Cloud Functions; background jobs run as `setInterval` pollers inside `server/index.ts`, following the `server/notifications.ts` pattern exactly (injectable `db`/client for testing, a pure `run...()` function plus a `start...Scheduler()` wrapper).

## Review Focus

- A wish with `shareToIdeas: true` but missing `interests`/`imageUrl`/`link`/price fields (user saved before filling them in, or cleared them): the mirror must not crash and must not create a half-valid `IdeaItem` that violates the "concrete product" requirement — skip mirroring until the required fields are present.
- A wish flips `shareToIdeas` from `true` to `false` *and* is deleted in the same poll cycle (or between two polls): the mirrored `IdeaItem` must end up deleted either way, not orphaned.
- Two users call `addIdea` for the same idea concurrently (double-tap, retry after a timeout): the unique `(idea, userId)` key must make the second call a no-op, not a thrown error that surfaces to the UI.
- A client tries to call `removeIdea`/`reportIdea` for an `ideaId` that doesn't exist or is `pending`/`rejected` (not yet visible in `listApprovedIdeas`): this must fail harmlessly (no rows affected / normal insert), not leak whether the id exists.
- The interest string sent to `listApprovedIdeas` is not one of the 100 known catalog values (stale client cache, future catalog edit): the query must simply return zero matches, not error.

---

## File Structure

- `firebase.json` — modify: add the `dataconnect.source` key pointing at `dataconnect/`.
- `dataconnect/dataconnect.yaml` — create: service/location/datasource pointing at the existing backend service.
- `dataconnect/schema/ideas.gql` — create: the four tables.
- `dataconnect/connector/ideas/connector.yaml` — create: connector id + JS SDK generation config (reuses the existing `src/dataconnect-generated` output dir).
- `dataconnect/connector/ideas/queries.gql` — create: `listApprovedIdeas`.
- `dataconnect/connector/ideas/mutations.gql` — create: `addIdea`, `removeIdea`, `reportIdea`.
- `server/dataConnectAdmin.ts` — create: one function, `getIdeasDataConnect()`, wrapping `getDataConnect()` with this service's `ConnectorConfig`.
- `server/ideasMirror.ts` — create: `runIdeasMirror(db, dataConnect)` (pure, testable) + `startIdeasMirrorScheduler()` (wires real Firestore/Data Connect and `setInterval`, mirrors `server/notifications.ts`).
- `server/index.ts` — modify: import and call `startIdeasMirrorScheduler()` next to `startReminderScheduler()`.
- `tests/server/ideasMirror.test.ts` — create: unit tests for `runIdeasMirror` against fake Firestore + fake Data Connect client.

---

### Task 1: Local Data Connect workspace wired to the existing backend service

**Files:**
- Modify: `firebase.json`
- Create: `dataconnect/dataconnect.yaml`

**Interfaces:**
- Produces: a `dataconnect/` workspace that `firebase deploy` and the Data Connect emulator both recognize, targeting `serviceId: wishlly-932c0-service`, `location: europe-north1`.

- [ ] **Step 1: Point `firebase.json` at the Data Connect workspace**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "dataconnect": {
    "source": "dataconnect"
  }
}
```

- [ ] **Step 2: Write `dataconnect/dataconnect.yaml`**

```yaml
specVersion: v1
serviceId: wishlly-932c0-service
location: europe-north1
schema:
  source: ./schema
datasource:
  postgresql:
    database: wishlly-932c0-database
    cloudSql:
      instanceId: wishlly-932c0-instance
connectorDirs:
  - ./connector/ideas
```

- [ ] **Step 3: Verify the workspace is recognized**

Run: `npx firebase-tools dataconnect:services:list` (or call the `dataconnect_list_services` MCP tool).
Expected: the existing `wishlly-932c0-service` / connector list is shown without error, and no "no local SQL Connect service" warning appears.

- [ ] **Step 4: Commit**

```bash
git add firebase.json dataconnect/dataconnect.yaml
git commit -m "Point the local workspace at the existing SQL Connect service"
```

---

### Task 2: Schema — IdeaItem, IdeaInterest, IdeaAdd, IdeaReport

**Files:**
- Create: `dataconnect/schema/ideas.gql`

**Interfaces:**
- Consumes: nothing (first schema file).
- Produces: GraphQL types `IdeaItem`, `IdeaInterest`, `IdeaAdd`, `IdeaReport` and their auto-generated CRUD operations (`ideaItem_insert`, `ideaItem_update`, `ideaItems` query, etc.) that Task 3's connector and Task 5's admin mirror both rely on by these exact names.

- [ ] **Step 1: Write the schema**

```graphql
# dataconnect/schema/ideas.gql

# Anonymized, moderated community idea — no owner field, ever.
# Keyed by the Firestore wish id directly (already an opaque random string,
# so this is no less anonymous than a fresh UUID) — this makes the mirror
# job's upsert/delete and reconciliation in Task 5 a plain id match instead
# of needing a second id-mapping table.
type IdeaItem @table(key: "wishId") {
  wishId: String!
  title: String!
  imageUrl: String!
  link: String!
  priceAmount: Float
  priceCurrency: String
  status: String! @default(value: "pending") # pending | approved | rejected
  mergedInto: IdeaItem
  createdAt: Timestamp! @default(expr: "request.time")
}

# Which of the fixed 100 interest-catalog strings an idea matches.
type IdeaInterest @table(key: ["idea", "interest"]) {
  idea: IdeaItem!
  interest: String!
}

# One row per user who added an idea to their own wishlist — the primary
# key enforces "one vote per user" at the database level.
type IdeaAdd @table(key: ["idea", "userId"]) {
  idea: IdeaItem!
  userId: String!
  addedAt: Timestamp! @default(expr: "request.time")
}

type IdeaReport @table {
  idea: IdeaItem!
  reporterId: String!
  reason: String!
  createdAt: Timestamp! @default(expr: "request.time")
}
```

Note for the implementer: because `IdeaItem`'s key field is `wishId` (not the implicit default `id`), the generated foreign-key field name on `IdeaInterest`/`IdeaAdd`/`IdeaReport` follows the `@ref` directive's documented default formula, `{fieldName}{PrimaryIdName}` — the docs' own worked example (`refField: OneTable!` with `OneTable`'s key defaulting to `id`) generates `refFieldId`. Applying that formula here: `idea: IdeaItem!` (key `wishId`) → **`ideaWishId: String!`** on all three referencing tables. The formula itself is doc-confirmed; this specific resulting name is a direct, high-confidence application of it. Still worth one real check against the emulator in Step 2 below, but don't reinvent this — use `ideaWishId` in Task 3/5.

- [ ] **Step 2: Deploy the schema to the emulator and check it compiles**

Run: `mcp__plugin_firebase_firebase__dataconnect_execute_in_emulator` (or `npx firebase-tools dataconnect:sql:migrate --local`) after starting `npx firebase-tools emulators:start --only dataconnect`.
Expected: no schema compilation errors; `IdeaItem`, `IdeaInterest`, `IdeaAdd`, `IdeaReport` tables are created in the local Postgres emulator.

- [ ] **Step 3: Commit**

```bash
git add dataconnect/schema/ideas.gql
git commit -m "Add Postgres schema for the anonymized Ideas community layer"
```

---

### Task 3: Connector — read query + user-scoped mutations, with emulator auth checks

**Files:**
- Create: `dataconnect/connector/ideas/connector.yaml`
- Create: `dataconnect/connector/ideas/queries.gql`
- Create: `dataconnect/connector/ideas/mutations.gql`

**Interfaces:**
- Consumes: `IdeaItem`, `IdeaInterest`, `IdeaAdd`, `IdeaReport` from Task 2.
- Produces: named operations `listApprovedIdeas`, `addIdea`, `removeIdea`, `reportIdea`, generated into `src/dataconnect-generated` (already present as an empty scaffold) for later client use, and reusable by Task 4's admin wrapper by name.

- [ ] **Step 1: Write `connector.yaml`**

```yaml
connectorId: ideas
generate:
  javascriptSdk:
    outputDir: ../../../src/dataconnect-generated
    package: "@dataconnect/generated"
```

- [ ] **Step 2: Write the read query**

```graphql
# dataconnect/connector/ideas/queries.gql

query ListApprovedIdeas($interest: String!, $limit: Int = 20) @auth(level: USER) {
  ideaInterests(where: { interest: { eq: $interest } }, limit: $limit) {
    idea {
      wishId
      title
      imageUrl
      link
      priceAmount
      priceCurrency
      createdAt
      ideaAdds_on_idea @check(expr: "true") {
        _count
      }
    }
  }
}
```

Note for the implementer: filter `IdeaItem.status == "approved" && mergedInto == null` directly on the `idea` selection once you confirm in Step 4 whether Data Connect lets you filter a parent-of-a-join-table field inline — if not, add an explicit `where` on a top-level `ideaItems` query joined through `ideaInterests_on_idea` instead. Resolve this against the running emulator, not by guessing; both shapes are valid GraphQL, only one matches what this schema actually generates.

- [ ] **Step 3: Write the user-scoped mutations**

```graphql
# dataconnect/connector/ideas/mutations.gql

mutation AddIdea($ideaId: String!) @auth(level: USER) {
  ideaAdd_insert(data: { ideaWishId: $ideaId, userId_expr: "auth.uid" })
}

mutation RemoveIdea($ideaId: String!) @auth(level: USER) {
  ideaAdd_delete(key: { ideaWishId: $ideaId, userId_expr: "auth.uid" })
}

mutation ReportIdea($ideaId: String!, $reason: String!) @auth(level: USER) {
  ideaReport_insert(data: { ideaWishId: $ideaId, reporterId_expr: "auth.uid", reason: $reason })
}
```

Note for the implementer: `ideaWishId` is the implicit FK column (per the Task 2 note) — Data Connect's `_insert`/`_delete` `data:`/`key:` blocks take FK column names, not the bare relation field name (docs example: `favorite_movie_upsert(data: { userId_expr: "auth.uid", movieId: $movieId })` uses `movieId`, not `movie`). Confirmed by Step 4 below.

- [ ] **Step 4: Deploy the connector to the emulator**

Run: start `npx firebase-tools emulators:start --only dataconnect`, then `npx firebase-tools dataconnect:sql:migrate --local` if needed.
Expected: connector compiles; fix the `listApprovedIdeas` filter per the Step 2 note based on the actual compiler error/behavior.

- [ ] **Step 5: Run the auth/impersonation checks from the spec against the emulator**

Using `mcp__plugin_firebase_firebase__dataconnect_execute_graphql` (or `_execute_in_emulator`) with `impersonate: { authClaims: { sub: "<test-uid>" } }`, verify against seeded rows:
1. `AddIdea` twice with the same uid/idea creates exactly one `IdeaAdd` row (second call either no-ops or errors without leaving a duplicate — confirm which, and note it for Task 5/the future UI plan).
2. `RemoveIdea` with a different uid than the row's `userId` affects zero rows.
3. `ListApprovedIdeas` never returns an idea whose seeded `status` is `pending` or `rejected`, or whose `mergedInto` is set.
4. `ReportIdea` succeeds for any authenticated uid; there is no operation in this connector that reads `IdeaReport` (confirm by checking the generated SDK/connector file — only `queries.gql`'s `ListApprovedIdeas` should exist).
5. Calling any of these three mutations with no `impersonate` auth context (unauthenticated) is rejected by `@auth(level: USER)`.

Expected: all five hold. Fix the `.gql` files and re-run until they do — this is the task's actual test cycle, not optional polish.

- [ ] **Step 6: Commit**

```bash
git add dataconnect/connector/ideas/
git commit -m "Add Ideas connector: approved-ideas read query and user-scoped vote/report mutations"
```

---

### Task 4: Admin Data Connect client for the server

**Files:**
- Create: `server/dataConnectAdmin.ts`

**Interfaces:**
- Consumes: `ConnectorConfig`/`getDataConnect` from `firebase-admin/data-connect` (already a transitive export of the `firebase-admin@14.5.0` dependency — verified present at `node_modules/firebase-admin/lib/data-connect`).
- Produces: `getIdeasDataConnect(): DataConnect`, used by Task 5's mirror job. Calling `.executeGraphql(...)` or `.upsert(...)`/`.insert(...)` on the returned instance with no `impersonate` option runs with admin privileges and ignores `@auth` directives (per the SDK's documented behavior) — this is how the mirror job writes `IdeaItem`/`IdeaInterest` despite those tables having no client-facing insert/update operations.

- [ ] **Step 1: Write the admin client wrapper**

```typescript
// server/dataConnectAdmin.ts
import { getDataConnect, type DataConnect } from 'firebase-admin/data-connect';

const CONNECTOR_CONFIG = {
  location: 'europe-north1',
  serviceId: 'wishlly-932c0-service',
  connector: 'ideas',
};

let instance: DataConnect | null = null;

export function getIdeasDataConnect(): DataConnect {
  if (!instance) instance = getDataConnect(CONNECTOR_CONFIG);
  return instance;
}
```

- [ ] **Step 2: Sanity-check against the emulator**

Run a throwaway script (or the `dataconnect_execute_in_emulator` MCP tool) calling `getIdeasDataConnect().upsert('ideaItem', { wishId: 'test-wish-1', title: 'test', imageUrl: 'https://x', link: 'https://x', status: 'pending' })` and confirm a row appears, then delete it.
Expected: insert succeeds with no auth context required (admin bypass confirmed).

- [ ] **Step 3: Commit**

```bash
git add server/dataConnectAdmin.ts
git commit -m "Add admin Data Connect client wrapper for the Ideas backend"
```

---

### Task 5: Wish-to-idea mirror job (pure function + tests)

**Files:**
- Create: `server/ideasMirror.ts`
- Test: `tests/server/ideasMirror.test.ts`

**Interfaces:**
- Consumes: `getAdminDb()` shape from `server/admin.ts` (a Firestore-like object exposing `.collection(path).get()`, matching the fakes already used in `tests/server/notifications.test.ts`); `getIdeasDataConnect()` from Task 4, used only through a minimal interface (`upsert`, `insertMany`, `executeGraphql`) so tests can fake it without a real Postgres connection.
- Produces: `runIdeasMirror(db, dataConnect): Promise<void>` and `startIdeasMirrorScheduler(): void`, called from `server/index.ts` in Task 6.

- [ ] **Step 1: Write the failing tests**

The job reconciles the *full* set each run — every wish with `shareToIdeas: true` and complete fields is upserted, then any previously-mirrored id that isn't in that set gets deleted. This one rule covers `shareToIdeas` flipping to `false`, a wish losing its required fields, and a wish being deleted from Firestore outright (it simply stops appearing in the `wishes` snapshot) — without three separate code paths.

```typescript
// tests/server/ideasMirror.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runIdeasMirror } from '../../server/ideasMirror.js';

type Doc = Record<string, any>;

function fakeFirestore(wishes: Record<string, Doc>) {
  return {
    collection: (path: string) => ({
      get: async () => ({
        docs: Object.entries(wishes).map(([id, data]) => ({ id, data: () => data })),
      }),
    }),
  } as any;
}

function fakeDataConnect(existingIds: string[] = []) {
  const ideaItems = new Map<string, Doc>(); // keyed by wishId
  for (const id of existingIds) ideaItems.set(id, { title: 'старое' });
  const ideaInterests: { idea: string; interest: string }[] = [];
  const deleted: string[] = [];
  return {
    client: {
      async listMirroredIdeaIds() { return [...ideaItems.keys()]; },
      async upsertIdeaItem(id: string, data: Doc) { ideaItems.set(id, { ...ideaItems.get(id), ...data }); },
      async replaceIdeaInterests(ideaId: string, interests: string[]) {
        for (let i = ideaInterests.length - 1; i >= 0; i--) if (ideaInterests[i].idea === ideaId) ideaInterests.splice(i, 1);
        for (const interest of interests) ideaInterests.push({ idea: ideaId, interest });
      },
      async deleteIdeaItem(id: string) { ideaItems.delete(id); deleted.push(id); },
    },
    ideaItems, ideaInterests, deleted,
  };
}

const validWish = {
  shareToIdeas: true,
  title: 'Йога-коврик',
  imageUrl: 'https://example.test/mat.png',
  link: 'https://example.test/mat',
  priceAmount: 1990,
  priceCurrency: '₽',
  interests: ['Йога', 'Фитнес'],
};

test('shareToIdeas=true с полными полями создаёт/обновляет IdeaItem и его интересы', async () => {
  const db = fakeFirestore({ w1: validWish });
  const dc = fakeDataConnect();
  await runIdeasMirror(db, dc.client);
  assert.deepEqual(dc.ideaItems.get('w1'), {
    title: 'Йога-коврик', imageUrl: 'https://example.test/mat.png', link: 'https://example.test/mat',
    priceAmount: 1990, priceCurrency: '₽',
  });
  assert.deepEqual(dc.ideaInterests, [{ idea: 'w1', interest: 'Йога' }, { idea: 'w1', interest: 'Фитнес' }]);
});

test('shareToIdeas=true но без imageUrl/link — не мёрджится, пропускается без ошибки', async () => {
  const db = fakeFirestore({ w1: { ...validWish, imageUrl: '', link: '' } });
  const dc = fakeDataConnect();
  await runIdeasMirror(db, dc.client);
  assert.equal(dc.ideaItems.size, 0);
});

test('shareToIdeas=false удаляет ранее смирроренный IdeaItem', async () => {
  const db = fakeFirestore({ w1: { ...validWish, shareToIdeas: false } });
  const dc = fakeDataConnect(['w1']);
  await runIdeasMirror(db, dc.client);
  assert.equal(dc.ideaItems.has('w1'), false);
  assert.deepEqual(dc.deleted, ['w1']);
});

test('вишлист удалён из Firestore целиком — ранее смирроренная идея тоже удаляется', async () => {
  const db = fakeFirestore({}); // w1 больше не существует вовсе
  const dc = fakeDataConnect(['w1']);
  await runIdeasMirror(db, dc.client);
  assert.equal(dc.ideaItems.has('w1'), false);
  assert.deepEqual(dc.deleted, ['w1']);
});

test('нет поля shareToIdeas вовсе — не создаём и не падаем', async () => {
  const db = fakeFirestore({ w1: { title: 'x' } });
  const dc = fakeDataConnect();
  await runIdeasMirror(db, dc.client);
  assert.equal(dc.ideaItems.size, 0);
  assert.deepEqual(dc.deleted, []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `tsx --test tests/server/ideasMirror.test.ts`
Expected: FAIL — `runIdeasMirror` is not defined (module doesn't exist yet).

- [ ] **Step 3: Implement `server/ideasMirror.ts`**

```typescript
// server/ideasMirror.ts
import { getAdminDb } from './admin.js';
import { getIdeasDataConnect } from './dataConnectAdmin.js';

const appId = process.env.VITE_APP_ID || 'wishforyou-tma-id';
const dataPath = `artifacts/${appId}/public/data`;
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export interface IdeasDataConnectClient {
  listMirroredIdeaIds(): Promise<string[]>;
  upsertIdeaItem(id: string, data: {
    title: string; imageUrl: string; link: string;
    priceAmount: number | null; priceCurrency: string | null;
  }): Promise<void>;
  replaceIdeaInterests(ideaId: string, interests: string[]): Promise<void>;
  deleteIdeaItem(id: string): Promise<void>;
}

function hasRequiredFields(wish: Record<string, any>): boolean {
  return Boolean(wish.title && wish.imageUrl && wish.link);
}

// Reconciles the full set every run: upsert everything that currently qualifies,
// then delete any previously-mirrored id that no longer does. This one rule
// covers shareToIdeas turning false, required fields disappearing, AND the wish
// being deleted from Firestore outright (it just stops showing up in `docs`) —
// without three separate "did it change" code paths that can drift apart.
export async function runIdeasMirror(
  db: ReturnType<typeof getAdminDb> = getAdminDb(),
  dataConnect: IdeasDataConnectClient = wrapAdminDataConnect(getIdeasDataConnect()),
): Promise<void> {
  const wishes = await db.collection(`${dataPath}/wishes`).get();
  const keepIds = new Set<string>();
  for (const doc of wishes.docs) {
    const wish = doc.data() as Record<string, any>;
    if (wish.shareToIdeas !== true || !hasRequiredFields(wish)) continue;
    keepIds.add(doc.id);
    await dataConnect.upsertIdeaItem(doc.id, {
      title: wish.title,
      imageUrl: wish.imageUrl,
      link: wish.link,
      priceAmount: wish.priceAmount ?? null,
      priceCurrency: wish.priceCurrency ?? null,
    });
    await dataConnect.replaceIdeaInterests(doc.id, wish.interests ?? []);
  }

  const mirrored = await dataConnect.listMirroredIdeaIds();
  for (const id of mirrored) {
    if (!keepIds.has(id)) await dataConnect.deleteIdeaItem(id);
  }
}

// Adapts the real admin Data Connect SDK (table-level insert/upsert/delete helpers,
// see Task 4) to the narrow interface above, so production code and tests share
// the same `runIdeasMirror` logic while only the adapter touches the real SDK.
// `wishId` is IdeaItem's actual primary key column (Task 2) — the adapter is
// the one place that needs to know that; the rest of this file just says "id".
function wrapAdminDataConnect(dc: ReturnType<typeof getIdeasDataConnect>): IdeasDataConnectClient {
  return {
    async listMirroredIdeaIds() {
      const result = await dc.executeGraphql<{ ideaItems: { wishId: string }[] }, undefined>(
        'query { ideaItems { wishId } }',
      );
      return result.data.ideaItems.map((row) => row.wishId);
    },
    async upsertIdeaItem(id, data) {
      await dc.upsert('ideaItem', { wishId: id, ...data });
    },
    async replaceIdeaInterests(ideaId, interests) {
      await dc.executeGraphql('mutation($idea: String!) { ideaInterest_deleteMany(where: { ideaWishId: { eq: $idea } }) }', { variables: { idea: ideaId } });
      if (interests.length > 0) {
        await dc.insertMany('ideaInterest', interests.map((interest) => ({ ideaWishId: ideaId, interest })));
      }
    },
    async deleteIdeaItem(id) {
      await dc.executeGraphql('mutation($id: String!) { ideaItem_delete(key: { wishId: $id }) }', { variables: { id } });
    },
  };
}

export function startIdeasMirrorScheduler() {
  setInterval(() => {
    runIdeasMirror().catch((error) => console.error('Ideas mirror job failed:', error));
  }, CHECK_INTERVAL_MS);
  void runIdeasMirror().catch((error) => console.error('Ideas mirror job failed:', error));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `tsx --test tests/server/ideasMirror.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Confirm the admin SDK calls match Task 2's actual generated names**

Cross-check `wrapAdminDataConnect` against the real emulator: the `ideaItem`/`ideaInterest` table names used by `upsert`/`insertMany`, the `wishId` key field name in `upsert`'s data and in `ideaItem_delete`'s `key:`, and `ideaWishId` as the FK filter field in `ideaInterest_deleteMany`'s `where:` and as the FK column in `insertMany`'s rows. Run one real call of each through `dataconnect_execute_in_emulator` (or the CLI equivalent per Task 1's ledgered ruling) and fix any mismatch in `wrapAdminDataConnect` — not by changing Task 2's schema.

- [ ] **Step 6: Commit**

```bash
git add server/ideasMirror.ts tests/server/ideasMirror.test.ts
git commit -m "Add the wish-to-idea mirror job with unit tests"
```

---

### Task 6: Wire the scheduler into the running server

**Files:**
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: `startIdeasMirrorScheduler` from Task 5.

- [ ] **Step 1: Import and start the scheduler**

```typescript
// server/index.ts — add alongside the existing import
import { startIdeasMirrorScheduler } from './ideasMirror.js';
```

```typescript
// server/index.ts — inside app.listen(...), alongside the existing calls
  startReminderScheduler();
  startIdeasMirrorScheduler();
  warmGdeslonCache();
```

- [ ] **Step 2: Run the full server test suite**

Run: `npm run test:server`
Expected: PASS (no regressions in `notifications.test.ts`, `parseLink.test.ts`, `giftOffers.test.ts`, `telegramWebhook.test.ts`, and the new `ideasMirror.test.ts`).

- [ ] **Step 3: Start the server locally and confirm no startup crash**

Run: `npm run start` (with the required `FIREBASE_ADMIN_*` env vars set, as the other pollers already need).
Expected: log line `wishlly server listening on :<port>` appears with no uncaught exception from the new scheduler on its first tick.

- [ ] **Step 4: Commit**

```bash
git add server/index.ts
git commit -m "Start the Ideas mirror scheduler alongside the reminder scheduler"
```

---

## Self-Review Notes

- **Spec coverage:** Data model → Task 2. Access rules (`@auth`, `_expr: "auth.uid"`, admin bypass) → Tasks 3–4. Mirror data flow (create/update/delete on `shareToIdeas`) → Task 5. Testing section's emulator/impersonation checks → Task 3 Step 5. The spec's "moderation flips status" and "merge via `mergedInto`" are intentionally left as manual admin operations (per spec: "no moderation UI in this scope") — no task automates them, matching the spec's own scope boundary.
- **Known open point carried forward, not hidden:** Task 3 Step 2 and Task 5 Step 5 both flag spots where the exact generated field/table names must be confirmed against the running emulator rather than assumed — this is intentional: Data Connect's exact generated names for joins and composite-key tables depend on the compiler, and guessing wrong here is a "run it and see" problem, not a design problem.
