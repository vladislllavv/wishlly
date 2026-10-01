# Ideas tab — community layer on SQL Connect (Postgres)

## Context

Firestore remains the production store for profiles, friends, wishlists and
reservations. The «Идеи» tab plan ([[project_ideas_tab_plan]] in memory) has
three stages: (1) clean/trim the gdeslon/Takprodam feed seed, (2) let a wish
declare `interests` and an opt-in `shareToIdeas` checkbox (shipped in commit
`c8ec40b`), (3) mix a community layer — anonymized opted-in wishes shown to
other users with similar interests, ranked by how many people added them.

This spec covers stage 3. SQL Connect (Firebase Data Connect on Cloud SQL
Postgres) is used **in parallel** with Firestore, not as a replacement: it
hosts only the community layer, because ranking/aggregation and dedup are
naturally relational, while Firestore keeps owning wishes, profiles, friends
and reservations as before.

A SQL Connect service (`wishlly-932c0-service`) and a prior prototype schema
already exist on the backend from an earlier trial, but no local `.gql`
source survived (it lived only in a session scratchpad). This design
replaces that prototype's scope: instead of mirroring the whole Firestore
data model into Postgres, it defines only the community-layer tables.

## Goals

- Users who opt in (`Wish.shareToIdeas = true`) get their wish mirrored,
  anonymized, into a shared pool other users can discover by matching
  interests.
- Items are moderated before appearing (bad words / non-https links /
  abstract "concept" gifts are out of scope per the existing hard
  requirement: concrete product, real photo, ruble price, working link).
- Ranking by "added by N people" is accurate: one vote per user, undoable.
- A report button exists for abuse.
- No path lets a client read who owns the original wish behind an idea, or
  write/moderate idea content directly.

## Non-goals

- Mirroring Profile, Friendship, Reservation, Group, GiftSwipe, or
  NotificationLog into Postgres — Firestore remains authoritative for all of
  that; this prototype's earlier broader schema is superseded by this
  narrower scope.
- Automatic duplicate detection (hybrid keyword+embedding dedup from the PoC)
  — out of scope here; `mergedIntoId` only models the *result* of a merge
  decision made elsewhere (manual or a future script).
- Deciding the Postgres trial's Blaze-plan billing question (deadline
  2026-12-29) — unrelated to this design.

## Data model

Interests are a fixed catalog of 100 strings (`src/interests.ts`), not free
text, so no separate `Interest` dimension table is needed — interest tags are
stored as plain text.

```
IdeaItem
  id            uuid, pk
  title         text, not null
  imageUrl      text, not null
  link          text, not null
  priceAmount   numeric
  priceCurrency text
  status        text, not null  -- 'pending' | 'approved' | 'rejected'
  mergedIntoId  uuid, fk -> IdeaItem.id, nullable
  createdAt     timestamp, not null, default now()

IdeaInterest
  ideaId        uuid, fk -> IdeaItem.id, not null
  interest      text, not null
  pk (ideaId, interest)

IdeaAdd
  ideaId        uuid, fk -> IdeaItem.id, not null
  userId        text, not null        -- Firebase Auth uid
  addedAt       timestamp, not null, default now()
  unique (ideaId, userId)

IdeaReport
  id            uuid, pk
  ideaId        uuid, fk -> IdeaItem.id, not null
  reporterId    text, not null
  reason        text, not null
  createdAt     timestamp, not null, default now()
```

No row stores the original Firestore `ownerId` — the mirror step (below)
deliberately drops it so the Postgres side can never link an idea back to its
author, even for a client with full read access to `IdeaItem`.

## Data flow

1. Owner checks "Показывать в Идеях" on a wish in the existing app (already
   shipped: `Wish.shareToIdeas`, `Wish.interests`).
2. A Cloud Function, triggered on write to the Firestore `wishes` collection,
   checks `shareToIdeas`:
   - `true` and no mirrored `IdeaItem` yet → call Data Connect (admin
     credentials) to insert `IdeaItem` (status `pending`) + one `IdeaInterest`
     row per tag, copying `title`/`imageUrl`/`link`/`priceAmount`/
     `priceCurrency`/`interests` only.
   - `true` and already mirrored, but content changed → update the mirrored
     `IdeaItem` fields (status unaffected, stays whatever moderation set it
     to, unless a resubmission-for-moderation rule is wanted later).
   - `false` (turned off, or wish deleted) → delete the mirrored `IdeaItem`
     (cascades `IdeaInterest`/`IdeaAdd`/`IdeaReport`).
3. Moderation (manual for now — no moderation UI in this scope) flips
   `pending` → `approved`/`rejected` directly via the Data Connect admin
   path (console / script), not through a client-facing mutation.
4. The app's Ideas feed query reads only
   `status = 'approved' AND mergedIntoId IS NULL`, joined to `IdeaInterest`
   to filter by the viewer's interests, with the `IdeaAdd` count per item for
   ranking.
5. A user swiping "add" calls a mutation that inserts their own `IdeaAdd` row
   (`userId` is taken from `auth.uid`, not client input); swiping it off (if
   the UI supports undo) deletes their own row. The displayed count is
   `COUNT(*)` over `IdeaAdd` for that `ideaId`.
6. A user reporting an idea calls a mutation that inserts an `IdeaReport` row
   with `reporterId = auth.uid`.

## Access rules (Data Connect)

Data Connect authorizes per-operation (`@auth(level: ...)`), not per-row;
row-level restriction comes from how each query/mutation is written, in the
same style as the earlier prototype's verified rules (owner-cannot-see-
reservations, reserve-only-free, friendship-by-friend-only).

| Operation | Level | Notes |
|---|---|---|
| `listApprovedIdeas` (query, filters by interest) | `USER` | Hardcoded `WHERE status = 'approved' AND mergedIntoId IS NULL`; never exposes `pending`/`rejected`. |
| `createIdeaItem` / `updateIdeaStatus` / `mergeIdeaItem` | `NO_ACCESS` | Server-only, called with admin credentials from the Cloud Function / moderation script — never reachable through the generated client SDK's auth context. |
| `addIdea(ideaId)` | `USER` | Inserts `IdeaAdd` with `userId = auth.uid`; relies on the DB unique constraint to make a second call a no-op/error rather than a double vote. |
| `removeIdea(ideaId)` | `USER` | Deletes only the row where `userId = auth.uid`. |
| `reportIdea(ideaId, reason)` | `USER` | Inserts `IdeaReport` with `reporterId = auth.uid`. |
| Reading `IdeaReport` | `NO_ACCESS` | Moderation-only, never exposed to the app. |

## Error handling

- Double `addIdea`: DB unique constraint rejects the second insert; the
  client treats "already added" as success, not an error.
- `removeIdea` for a row that isn't the caller's own: query returns zero
  rows affected, not an error — same no-op semantics as removing something
  already removed.
- Cloud Function mirror failures (Data Connect unreachable, etc.): rely on
  the trigger's built-in retry; no separate dead-letter queue in this scope.
- A wish's `shareToIdeas` flips to `false` mid-review: the mirrored
  `IdeaItem` is deleted regardless of its current `status`, so no opted-out
  wish can remain visible, pending or approved.

## Testing

Same style as the previous prototype: local Data Connect emulator +
`executeGraphql` impersonation of different `auth.uid`s. Checks to cover:

- A normal authenticated user cannot call `createIdeaItem`,
  `updateIdeaStatus`, or `mergeIdeaItem` (rejected as `NO_ACCESS`).
- `listApprovedIdeas` never returns `pending`, `rejected`, or
  `mergedIntoId IS NOT NULL` rows.
- Calling `addIdea` twice for the same user/idea does not create two rows or
  double the count.
- `removeIdea` cannot delete another user's `IdeaAdd` row.
- `reportIdea` succeeds for any authenticated user; no client operation can
  read `IdeaReport` rows.
- Deleting/flipping `shareToIdeas` off removes the mirrored `IdeaItem` and
  its `IdeaInterest`/`IdeaAdd`/`IdeaReport` rows.

## Open questions for later (not blocking this spec)

- Whether a resubmission-for-moderation rule is needed when an already
  approved idea's content changes (currently: content updates in place,
  status untouched).
- A moderator-facing UI/tool — out of scope here; moderation is assumed
  manual via the Data Connect admin path for now.
