# API Reference

Base URL: `http://localhost:4000/api/v1` (development)

All responses share one envelope shape:

```jsonc
// success
{ "success": true, "data": { /* ... */ }, "pagination": { /* list endpoints only */ } }

// failure
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "...", "details": { "email": "..." } } }
```

`details` is present on validation failures and maps field name → message.

Authentication is via `httpOnly` cookies (`rp_access`, `rp_refresh`), set
automatically by the browser after `/auth/login` or `/auth/register` +
`/auth/verify-email`. For tools like curl/Postman, a `Bearer <accessToken>`
header is also accepted — but note the access token itself is never returned
in a JSON body outside that cookie, by design.

---

## Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | – | Create an account. Sends a (simulated) verification email. |
| POST | `/verify-email` | – | Body: `{ token }`. Marks the account verified. |
| POST | `/resend-verification` | – | Body: `{ email }`. Always returns success, whether or not the account exists. |
| POST | `/login` | – | Body: `{ email, password }`. Sets auth cookies. |
| POST | `/refresh` | refresh cookie | Rotates the refresh token, issues a new access token. |
| POST | `/logout` | – | Revokes the current refresh token, clears cookies. |
| GET | `/me` | access token | Returns the signed-in user. |
| POST | `/forgot-password` | – | Body: `{ email }`. Always returns success. |
| POST | `/reset-password` | – | Body: `{ token, password }`. Revokes all existing sessions. |

Rate limit: 20 requests / 15 minutes per IP on every route in this group
except `/refresh`, `/logout` and `/me` (successful requests don't count
against the limit).

**Password rule:** ≥8 characters, at least one uppercase letter, one
lowercase letter, one digit.

---

## Posts — `/posts`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | optional | Paginated feed. Query: `q, category, status, sort, page, limit` |
| GET | `/stats` | – | `{ total, byStatus: { under_review, planned, in_progress, completed } }` |
| GET | `/roadmap` | optional | `{ planned: Post[], in_progress: Post[], completed: Post[] }` |
| GET | `/:slug` | optional | Single request, with `hasVoted` and status history |
| POST | `/` | required | Create a request. Body: `{ title, description, category }` |
| PATCH | `/:id` | author or admin | Partial update: any of `title, description, category` |
| DELETE | `/:id` | author or admin | Deletes the request and its comments |
| POST | `/:id/vote` | required | Upvote (idempotent if already voted) |
| DELETE | `/:id/vote` | required | Remove your vote |
| PATCH | `/:id/status` | **admin only** | Body: `{ status, note? }`. Must be a legal transition — see below |

**`category`**: `ui-ux` \| `integrations` \| `performance` \| `general`

**`status`**: `under_review` \| `planned` \| `in_progress` \| `completed`

**`sort`**: `trending` (default) \| `top` \| `newest` \| `discussed` \|
`relevance` (used automatically when `q` is set)

**Status transitions** (`from → allowed to`):

```
under_review → planned, in_progress
planned      → under_review, in_progress
in_progress  → planned, completed
completed    → in_progress
```

Any other transition returns `400 BAD_REQUEST`.

### Example

```bash
curl -X POST http://localhost:4000/api/v1/posts \
  -H "Content-Type: application/json" \
  -H "Cookie: rp_access=<token>" \
  -d '{"title":"Dark mode","description":"Follow the OS setting.","category":"ui-ux"}'
```

---

## Comments

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/posts/:postId/comments` | – | Full thread, nested as a tree |
| POST | `/posts/:postId/comments` | required | Body: `{ body, parentId? }` |
| PATCH | `/comments/:id` | author only | Body: `{ body }` |
| DELETE | `/comments/:id` | author or admin | Soft-deletes if it has replies, otherwise removes it |

Replies are capped at depth 4; a reply attempted past that depth is
flattened onto the deepest allowed level rather than rejected.

---

## Misc

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ status: "ok", uptime }` |
| GET | `/dev/outbox` | **development only** — the simulated email outbox |

---

## Error codes

| Code | Status | Meaning |
|---|---|---|
| `BAD_REQUEST` | 400 | Validation failed — see `details` |
| `UNAUTHORIZED` | 401 | No/invalid access token |
| `ACCESS_EXPIRED` | 401 | Access token expired — client should call `/auth/refresh` once |
| `REFRESH_INVALID` | 401 | Refresh token missing, expired or unrecognized |
| `REFRESH_REUSED` | 401 | An already-rotated refresh token was replayed — every session in that family was revoked |
| `EMAIL_NOT_VERIFIED` | 403 | Login blocked pending email confirmation |
| `FORBIDDEN` | 403 | Authenticated, but not allowed to do this |
| `NOT_FOUND` | 404 | No such resource |
| `EMAIL_TAKEN` / `CONFLICT` / `DUPLICATE` | 409 | Uniqueness violation |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL` | 500 | Unexpected server error |
