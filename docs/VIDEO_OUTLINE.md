# Explanation video — talking points

The assessment brief lists exactly what the video needs to cover. This maps
each required point to where it lives in the code, so recording is mostly
reading from here and pointing at the screen. Say it in your own words —
this is a map, not a script to read verbatim.

**Target length:** 8–12 minutes covers all of this comfortably without
rushing.

---

### 1. Introduction (30s)

- This is Project 01: **Feature Request & Public Roadmap Portal** — a Canny /
  Featurebase alternative, built in MERN.
- One line on why you picked it: it's the brief that most directly exercises
  concurrent writes, an aggregation-based ranking algorithm, and an explicit
  admin workflow — the parts of the rubric under Database Design, API
  Development and Problem Solving.

### 2. Problem statement & objective (30s)

- Users submit feature requests, upvote the ones that matter to them, and
  discuss them in threaded comments.
- Admins triage the queue and move accepted requests across a public,
  three-column roadmap (Planned → In progress → Completed), so anyone can see
  what's coming without asking.

### 3. Features implemented (2 min) — demo while narrating

Walk through it live rather than listing it:
1. Sign up → show the simulated email step (`docs — see README "Email
   verification, without an inbox"`) → confirm → sign in.
2. Submit a request with markdown in the description.
3. Upvote it from the feed — point out the count updates instantly (optimistic
   UI), then refresh the page to show it persisted.
4. Open the request, add a comment, then reply to your own comment to show
   threading.
5. Search for it, filter by category, switch sort to "Newest" vs "Trending" —
   explain in one sentence that Trending is time-decayed, not just vote count.
6. Sign in as admin (seeded account), move the request from Under review →
   Planned, add a note, show it now appears on `/roadmap`.
7. Try an illegal move (e.g. under_review → completed) if you want to show
   the state machine rejecting it with a clear error.

### 4. Technology stack (30s)

- Backend: Express 5, Mongoose 8, TypeScript, Zod for validation, JWT for
  auth.
- Frontend: React 19, Vite, Tailwind v4, TanStack Query, React Router, Base
  UI (what `coss.com/ui` is built on).

### 5. Why this stack (1 min)

- MERN was one of two allowed options; chosen for direct familiarity with
  Express's middleware model, which maps cleanly onto the brief's
  requirements (auth guard → RBAC guard → validation → handler, in that
  order, as actual middleware rather than checks scattered inside handlers).
- Zod: one schema, both the validation *and* the TypeScript type — no
  separate DTO layer to keep in sync by hand.
- TanStack Query: the brief calls for optimistic UI on upvoting; this is what
  makes safe optimistic updates with rollback tractable without hand-rolling
  a cache.

### 6. Application architecture & approach (1.5 min)

- Point at the folder structure in the README ("Project structure" section).
- Backend is organized by feature module (`modules/auth`, `modules/posts`,
  `modules/comments`), each with `.routes.ts → .controller.ts → .service.ts
  → .validation.ts` — routes own HTTP concerns, services own business logic
  and are what the unit tests exercise directly.
- Explain the middleware chain once, e.g. on `PATCH /posts/:id/status`:
  `authenticate → authorize('admin') → validateObjectId → validate(schema)
  → controller`. Each step is single-purpose and independently testable.

### 7. Database structure (1.5 min)

- Four collections: `User`, `RefreshToken`, `Post`, `Comment`.
- Show `Post` schema: `voters` array (source of truth for "did this user
  vote") + denormalized `voteCount` (fast reads/sorting) updated together in
  one atomic operation — explain *why* two fields instead of just counting
  the array (`array unwind` on every list-page read would be far more
  expensive than reading a number).
- `statusHistory` embedded array — an audit trail lives on the document
  itself since it's always read together with the post.
- `RefreshToken` is its own collection, not embedded on `User` — a user can
  have several active sessions (phone, laptop), and old tokens expire on
  their own via a Mongo TTL index (`expireAfterSeconds: 0`), so there's no
  cleanup cron to maintain.
- Comments use `parent` (adjacency list) + cached `depth`, not a materialized
  path — mention this was a deliberate choice for a shallow-thread use case,
  covered in the README.

### 8. Important APIs / backend logic (2 min) — pick 2–3, don't do all of them

Good candidates, in order of how well they demonstrate judgment:

- **Atomic voting** (`posts.service.ts` → `addVote`/`removeVote`). Show the
  `findOneAndUpdate({ _id, voters: { $ne: userId } }, { $addToSet, $inc })`
  call. Explain: the alternative — read the post, check if the user already
  voted, then write — has a race condition where two simultaneous requests
  both pass the check before either writes, double-counting the vote. Putting
  the check in the *filter* instead of application code makes a duplicate
  vote structurally unable to match.
- **Refresh-token rotation with reuse detection** (`utils/tokens.ts`). Each
  refresh issues a new token in the same "family" and marks the old one
  used. If a used token is presented again — meaning a copy leaked somewhere
  — the whole family is revoked, not just that one token.
- **Trending score aggregation** (`utils/trending.ts` +
  `posts.service.ts::listPosts`). The Hacker-News-style decay formula,
  computed as a MongoDB aggregation stage rather than pulled into Node and
  sorted there — scales with the collection instead of the page size.

### 9. Important frontend implementation (1.5 min)

- **Optimistic voting** (`hooks/usePosts.ts::useVote`). Show `onMutate`
  snapshotting every cached view of the post (feed, detail page, roadmap
  board can all show the same post at once), patching all of them instantly,
  then `onError` restoring the exact snapshot if the request fails.
- **Single-flight refresh** (`lib/api.ts`). If several queries fire at once
  after the access token has expired, they share one in-flight
  `/auth/refresh` call instead of each independently racing to refresh —
  which, given rotation, would make the second caller's token already-stale
  and trigger the *reuse detection* from point 8, logging the user out by
  accident. This is a case where a frontend decision exists specifically
  because of a backend security decision — good to call out that connection
  explicitly.
- coss.com/ui: mention that this environment doesn't offer an installable
  `coss.com/ui` package, so the primitives were built the way the registry
  itself is meant to be used — Base UI underneath (same primitives coss is
  built on) with Tailwind styling matching the system, vendored directly into
  `components/ui/` rather than pulled from an npm package.

### 10. Significant technical decisions (1 min)

Pick 2–3 to actually explain out loud (all are documented in the README
under "Technical decisions worth knowing about" if you want the exact
wording):
- Vote guard in the query filter, not application code.
- Explicit status state machine instead of "admin can set anything."
- Optimistic UI with snapshot/rollback instead of just disabling the button
  during the request.

### 11. Challenges & how you solved them (1 min)

Be honest about something real, e.g.:
- Getting refresh rotation right without breaking concurrent requests — the
  first version logged users out under normal use because two queries
  racing each other each tried to refresh; the single-flight promise in the
  API client fixed it.
- Or: designing the comment depth cap — decided to flatten past-limit replies
  onto the deepest allowed level rather than reject them, so a user's reply
  is never silently lost.

### 12. Additional features beyond the core spec (30s)

- Rate limiting tiers (general/auth/write), not explicitly required by this
  project's brief but present in the neighbouring one and added here as a
  baseline abuse guard.
- Status-change history with notes (audit trail), full-text search,
  server-side pagination.

### 13. What's incomplete or could be improved (30s)

Read straight from the README's "Assumptions & limitations" section — no
role-management UI, no live WebSocket updates on the roadmap board, no file
uploads. Say what you'd do next with more time (role promotion UI, "who
voted" list for admins, live board updates).

---

### Before you hit record

- [ ] `npm run seed` has been run so the demo has real data
- [ ] You're logged out to start, so the audience sees the full signup →
      verify → login flow once
- [ ] You know which two backend features and which two frontend features
      you're demoing in depth (see sections 8–9) — don't try to cover
      everything with equal depth
- [ ] Screen resolution is legible when shared — zoom in on code, not just
      the browser
