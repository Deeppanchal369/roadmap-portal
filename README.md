# Roadmap — Feature Request & Public Roadmap Portal

A customer feedback platform: people submit and upvote feature requests,
discuss them in threaded comments, and watch accepted ideas move across a
public three-column roadmap (Planned → In progress → Completed). Admins
triage the queue and move requests along that path.

Built for the **MERN Stack Evaluation — Project Brief 01** (Canny /
Featurebase alternative).

- [What's implemented](#whats-implemented)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Running locally](#running-locally)
- [Seeded accounts](#seeded-accounts)
- [Email verification, without an inbox](#email-verification-without-an-inbox)
- [API documentation](#api-documentation)
- [Technical decisions worth knowing about](#technical-decisions-worth-knowing-about)
- [Assumptions & limitations](#assumptions--limitations)
- [Third-party libraries and why](#third-party-libraries-and-why)

## What's implemented

**Auth & security**
- Pair-token JWT auth: 15-minute access token + 7-day refresh token, both
  `httpOnly` cookies (the refresh cookie is scoped to `/api/v1/auth` only)
- Refresh-token **rotation with reuse detection** — a token that is replayed
  after it was already rotated away signs out every session in that family
- Signup with simulated email verification, login, forgot/reset password
  (resetting a password revokes every existing session)
- CSRF mitigation via `SameSite` cookies + an explicit `Origin` allowlist check
  on every mutating request
- Three tiers of rate limiting (general API, auth endpoints, write endpoints)

**Feature requests**
- Submit, edit (author or admin), delete (author or admin)
- Atomic upvote/un-vote — one vote per user, race-safe (see
  [below](#technical-decisions-worth-knowing-about))
- Full-text search, category and status filters, four sort modes (trending,
  top, newest, most discussed), server-side pagination
- A trending score with time decay, computed inside a MongoDB aggregation
  pipeline rather than in application code

**Discussion**
- Threaded comments (replies to replies), depth-capped so the UI stays
  readable, soft-deleted so a removed comment doesn't orphan its replies
- Author can edit their own comment; author or admin can delete it

**Admin & roadmap**
- Role-based access control — only `admin` can change a request's status
- An explicit status state machine (`under_review → planned → in_progress →
  completed`, with one step back allowed) enforced server-side, so an invalid
  move is a clear 400 rather than a corrupted board
- Every status change is recorded with who changed it, when, and an optional
  note
- Public three-column Kanban roadmap that reflects that state directly

**System UX**
- Debounced search, loading skeletons, empty states, toast notifications for
  admin actions — all built from `coss.com/ui`-style primitives on Base UI

## Tech stack

**Backend** — Node.js, Express 5, MongoDB with Mongoose 8, TypeScript, Zod 4
(request validation), JWT (`jsonwebtoken`), `bcryptjs`, `helmet`,
`express-rate-limit`.

**Frontend** — React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query 5,
React Router 7, [Base UI](https://base-ui.com) (the primitives
`coss.com/ui` is built on) styled to the `coss.com/ui` design language,
`react-markdown`.

Why this pairing: the brief asked for MERN with freedom to add libraries
where they earn their place. Zod gives the API a single source of truth for
validation that TypeScript can infer types from. TanStack Query turns
server state (the feed, a post, its comments) into a cache with request
deduplication, background refetch and optimistic updates "for free," which
is what makes the instant-upvote UX possible without hand-rolling a state
manager.

## Project structure

```
.
├── server/                  # Express API
│   └── src/
│       ├── config/          # env parsing (Zod-validated), DB connection
│       ├── middleware/      # auth, RBAC, validation, rate limits, errors
│       ├── models/          # Mongoose schemas: User, RefreshToken, Post, Comment
│       ├── modules/
│       │   ├── auth/        # register, login, refresh, password reset
│       │   ├── posts/       # feed, voting, status transitions, roadmap
│       │   └── comments/    # threaded comments
│       ├── scripts/seed.ts  # populates demo data
│       └── utils/           # ApiError, tokens, trending score, slugs, mailer
│
├── client/                  # React app
│   └── src/
│       ├── components/      # PostCard, VoteButton, CommentThread, AppShell…
│       │   └── ui/          # coss-style primitives: Button, Dialog, Select…
│       ├── hooks/            # useAuth, usePosts (TanStack Query), useDebounce
│       ├── pages/            # FeedPage, PostDetailPage, RoadmapPage, AdminPage…
│       └── lib/               # api client, types, constants, utils
│
└── docs/
    ├── API.md                # endpoint reference
    └── VIDEO_OUTLINE.md       # talking points for the explanation video
```

## Setup

Requires **Node.js 20+** and a MongoDB instance (local or
[Atlas](https://www.mongodb.com/atlas) — a free-tier cluster works fine).

```bash
git clone <this-repo-url>
cd <repo>

cd server && npm install
cd ../client && npm install
```

## Environment variables

Both apps read from a `.env` file. Copy the example and fill it in:

```bash
cd server && cp .env.example .env
cd ../client && cp .env.example .env    # only needed if the API is on a different origin
```

**`server/.env`**

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | yes | e.g. `mongodb://127.0.0.1:27017/roadmap_portal`, or an Atlas SRV string |
| `JWT_ACCESS_SECRET` | yes | ≥32 chars. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | yes | Same as above — must be a **different** value |
| `PORT` | no | default `4000` |
| `ACCESS_TOKEN_TTL` | no | default `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | no | default `7` |
| `REQUIRE_EMAIL_VERIFICATION` | no | default `true`. Set `false` to skip the confirm-email step while reviewing |
| `CORS_ORIGINS` | no | default `http://localhost:5173`. Comma-separated |
| `CLIENT_URL` | no | used to build the verification/reset links |
| `COOKIE_SAMESITE` / `COOKIE_SECURE` | no | defaults are fine for local dev over HTTP |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | no | used by `npm run seed` |

**`client/.env`** — one optional variable:

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | no | Leave unset for local dev — Vite proxies `/api` to the server (see `vite.config.ts`). Set this only when the client and API are deployed to different origins, e.g. `https://roadmap-api.example.com/api/v1` |

No secrets are committed anywhere in this repo — `.env` is gitignored in both
apps, and only `.env.example` is tracked.

## Database setup

Any MongoDB 6+ instance works. Indexes (including the text index used by
search) are created automatically on first connection in development.

- **Local**: install MongoDB Community Server, or run
  `docker run -d -p 27017:27017 mongo:7`, and point `MONGODB_URI` at it.
- **Atlas**: create a free cluster, add your IP to the access list, and use
  the connection string Atlas gives you.

## Running locally

```bash
# Terminal 1 — API on http://localhost:4000
cd server
npm run seed   # optional but recommended: creates an admin, 5 users, 14 requests, comments
npm run dev

# Terminal 2 — client on http://localhost:5173
cd client
npm run dev
```

Open `http://localhost:5173`.

Other useful commands, run from either `server/` or `client/`:

```bash
npm run typecheck   # tsc --noEmit
npm run build        # production build
npm test              # server only — unit tests for trending score,
                       # status transitions, slugging, validation
```

## Seeded accounts

After `npm run seed` (all seeded users share one password):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@roadmap.test` (or `SEED_ADMIN_EMAIL`) | value of `SEED_ADMIN_PASSWORD` (default `Admin@12345`) |
| Member | `ana@roadmap.test` | `Password@123` |

Four more members (`marcus`, `priya`, `tomas`, `leila` @roadmap.test) share
the same password.

## Email verification, without an inbox

The brief asks for "Signup with Email Verification **simulation**." Rather
than wire a real mail provider — which a reviewer would have to configure
before they could even sign up — every outbound email is logged to the
server console and kept in a small in-memory outbox
(`GET /api/v1/dev/outbox`, development only). In development, the signup and
forgot-password responses also include the raw token directly, and the
sign-up/sign-in dialog links straight to it, so the whole flow is testable
without leaving the browser. None of this dev-only behaviour is present when
`NODE_ENV=production`. Swapping in a real provider (Resend, Nodemailer +
SMTP) later is a one-function change — everything else calls `sendMail()`
in `server/src/utils/mailer.ts`.

## API documentation

See [`docs/API.md`](docs/API.md) for the full endpoint reference.

## Technical decisions worth knowing about

A few things in this codebase exist to solve a specific problem, not as
default choices. They're commented in place, and summarized here since the
brief asks for the reasoning behind technical decisions:

- **Atomic voting.** Two concurrent votes are not stopped by writing "check,
  then insert" in application code, because two requests can both pass the
  check before either writes. Instead the guard lives in the
  MongoDB query filter itself — `findOneAndUpdate({ _id, voters: { $ne: userId
  } }, { $addToSet, $inc })` — so a duplicate vote physically cannot match a
  second time. See `server/src/modules/posts/posts.service.ts`.
- **Refresh-token rotation with reuse detection.** Every refresh swaps the
  token for a new one in the same "family." If an already-rotated token is
  presented again, that's a signal the token leaked, and the whole family is
  revoked. See `server/src/utils/tokens.ts`.
- **Single-flight token refresh on the client.** A dashboard fires several
  requests at once; if the access token has expired, naively refreshing once
  per request would present an already-rotated refresh token to the second
  call and trip the reuse detection above, logging the user out. The client
  shares one in-flight refresh promise across all callers. See
  `client/src/lib/api.ts`.
- **Optimistic upvoting with rollback.** The vote button updates the instant
  it's clicked — waiting on a round trip for the single most-used control in
  the app would feel broken. A snapshot of every cached view of the post is
  taken before the optimistic update and restored exactly if the request
  fails. See `client/src/hooks/usePosts.ts`.
- **Trending score as an aggregation stage, not a client sort.** Ranking
  happens inside MongoDB (`$addFields` + the decay formula) so it scales with
  the collection instead of pulling every post into Node to sort.
- **Explicit status state machine.** An admin cannot set a request to any
  status — only the transitions in `ALLOWED_STATUS_TRANSITIONS` are legal,
  so an invalid move is a clear 400 instead of a board that quietly stops
  making sense.
- **Comments as an adjacency list, not a materialized path.** Threads here
  are shallow, so one indexed query per post plus an in-memory tree build is
  simpler and cheaper than `$graphLookup` or a path field, and it's flat data
  that stays flat to reason about.

## Assumptions & limitations

Being upfront about what's not here, per the brief's instruction to note
this honestly rather than let it go unmentioned:

- **No file uploads.** The five briefs vary on this; Project 01 doesn't call
  for avatar/image upload, so none was added — user avatars are generated
  (DiceBear initials) rather than uploaded.
- **No real email delivery.** Covered above — this is explicitly a
  simulation per the brief.
- **No WebSocket/live updates.** The feed and admin board refresh via
  TanStack Query's cache invalidation after a mutation, not a live socket
  connection. Multiple admins triaging simultaneously will not see each
  other's changes until they refetch.
- **Roles are fixed at seed/signup time.** There's no admin UI to promote a
  user to admin — that's a direct database update
  (`db.users.updateOne({ email }, { $set: { role: 'admin' } })`) or a seed
  script change. A small admin-only "manage roles" endpoint would be the
  natural next step.
- **No image/attachment support in comments or requests** — markdown text
  only, which covers the "rich markdown description" requirement without
  adding a storage dependency.
- **Single MongoDB instance, no replica set assumed** — transactions were not
  needed given the atomic single-document update pattern used for voting, so
  the app does not require a replica set to run.

With more time, the next additions would be: promoting/demoting roles from
the admin UI, a "who voted" list for admins (mentioned as a nice-to-have in
a neighbouring brief), and WebSocket-based live updates on the roadmap board.

## Third-party libraries and why

| Library | Why |
|---|---|
| `zod` | Runtime validation with inferred TypeScript types, shared shape between client and server expectations |
| `jsonwebtoken` + `bcryptjs` | Industry-standard, unopinionated primitives for the token/password work — no framework lock-in |
| `express-rate-limit` | Brief explicitly calls this out for the sibling short-link project; applied here too as a baseline abuse guard |
| `@tanstack/react-query` | Server-state cache with deduplication, background refresh, and optimistic-update support — this is what makes instant voting safe to build |
| `@base-ui/react` | The unstyled primitive library `coss.com/ui` (the brief's required UI standard) is built on; used directly with Tailwind styling matching that system, since this environment vendors components by copying rather than an installable `coss.com/ui` package |
| `react-markdown` + `remark-gfm` | Renders user-authored markdown to React elements (not `dangerouslySetInnerHTML`), so a request or comment body can't inject a script tag |
| `lucide-react` | Icon set matching the coss/shadcn ecosystem |
