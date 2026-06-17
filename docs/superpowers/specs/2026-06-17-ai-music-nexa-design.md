# AI Music Nexa Integration Design

## Summary

AI Music is a paid Nexa-authorized H5 tool inside the existing Claw800 games and tools hub. Users enter from the games hub, authorize with Nexa, buy generation credits with Nexa USDT, and use those credits to generate AI music through the Godfather Music enterprise API.

The imported `godfather-music-web` package provides the music creation, library, and stem-splitting UI, but its browser-side `hh_` API Key login will be removed for this integration. The Claw800 server owns the enterprise API Key, proxies all Godfather Music API calls, and ties usage to each Nexa `openId`.

## Goals

- Add AI Music to the games and tools hub with a first-class route at `/ai-music/`.
- Require Nexa authorization before paid generation features are available.
- Let users buy generation credits with Nexa USDT.
- Use the pricing rule `1 USDT = 3 generation credits`.
- Keep the Godfather Music enterprise API Key server-side only.
- Preserve the useful parts of the Godfather Music UI: generation modes, my music, downloads, and stem tools.
- Track user credits, purchases, and generation tasks in the existing SQLite database.

## Non-goals

- No user-entered `hh_` API Key.
- No free trial in the first version.
- No subscription plans or variable package pricing in the first version.
- No public music feed, ranking, or social sharing layer beyond what the upstream UI already exposes.
- No custom AI music model; generation is delegated to the Godfather Music enterprise API.
- No migration of existing user songs from external Godfather Music accounts.

## Product Rules

## Entry and Catalog

- The games and tools hub lists a new enabled item:
  - `slug`: `ai-music`
  - `name`: `AI 音乐`
  - `route`: `/ai-music/`
  - action text: `生成音乐`
- The card should appear near other creator tools, above lower-priority casual games.
- Direct route aliases should serve the same app:
  - `/ai-music`
  - `/ai-music/`

## Login

- Users must authorize through Nexa before viewing account-specific data.
- The frontend should reuse the existing Nexa H5 authorization pattern:
  - build `nexaauth://oauth/authorize`
  - exchange returned `code` / `authCode` through `/api/nexa/tip/session`
  - sync the resulting session to an AI Music cookie session endpoint
- Backend identity key is Nexa `openId`.
- The session should be retained for 30 days, matching the retention style used by existing Nexa H5 tools.
- If opened outside Nexa or in a browser that cannot launch Nexa authorization, the page should show a login state with a clear action button instead of failing silently.

## Credits and Payment

- Users buy credits with Nexa USDT.
- First version has one package only:
  - price: `1.00 USDT`
  - granted credits: `3`
- Credits are integer counts.
- One successful generation submission costs `1` credit.
- A generation submission normally produces the upstream default output, which is expected to be two songs.
- The UI should show current remaining credits prominently near the generate action.
- If the user has zero credits, generation actions should open the purchase prompt.

## Credit Deduction

- Deduct `1` credit only after the server successfully creates an upstream generation task and has a task identifier to track.
- If upstream validation fails before a task is created, do not deduct a credit.
- If the upstream task is accepted but later fails, keep the credit deducted in the first version because the upstream generation resource was consumed.
- To prevent double-spend races, the server should reserve or verify credits before calling upstream, then use a conditional database update after upstream task creation:
  - `available_credits >= 1`
  - decrement balance
  - write ledger row
  - write generation row
- If the conditional update fails because another request spent the last credit first, the server should report insufficient credits. This may leave an upstream task created but not user-visible; log it for admin reconciliation rather than granting free usage.

## Music API Proxy

- Browser requests should never include or see the enterprise `HH_API_KEY`.
- The Claw800 server exposes an AI Music proxy namespace, for example:
  - `/api/ai-music/music/*`
  - `/api/ai-music/media`
- The proxy forwards to the upstream base URL from configuration, defaulting to `https://ai6666.com`.
- The proxy injects `Authorization: Bearer ${HH_API_KEY}` on upstream requests.
- The proxy should preserve request methods, query strings, JSON bodies, response status codes, and response bodies where practical.
- Media playback and downloads should use a server-side media proxy equivalent to the original package's `/media?u=...` behavior.

## User Library and Upstream Account Scope

- The first version uses the platform-owned enterprise API Key for all users.
- The Claw800 server must filter or map account-specific data by stored generation task and song identifiers where possible.
- My Music should show songs that the current Nexa user generated through Claw800.
- If an upstream endpoint returns account-wide content that cannot be reliably attributed to the current user, the server should not expose that raw account-wide list directly. It should either:
  - request details for known song IDs linked to the current user, or
  - return only locally tracked task/song records with available media URLs.

## Components

## Frontend App

Location: `public/ai-music/`

Responsibilities:

- Render the AI Music H5 experience.
- Adapt the imported Godfather Music static app to Claw800 routes and auth.
- Replace `hh_` API Key forms with Nexa login and credit purchase UI.
- Call `/api/ai-music/session` for session bootstrap.
- Call `/api/ai-music/credits` for balance.
- Call `/api/ai-music/credits/order` to create a Nexa payment order.
- Call `/api/ai-music/music/*` for generation, polling, library, downloads, and stem operations.

The frontend should keep the imported app's visual structure where it already works, but remove copy that tells users to fetch or paste an API Key.

## Server Session Module

Responsibilities:

- Encode and decode an `ai_music_session` cookie.
- Validate that a session contains `openId` and `sessionKey`.
- Ensure a local AI Music user row exists for each authorized `openId`.
- Return bootstrap state:
  - Nexa account summary
  - credit balance
  - payment package

## Payment Module

Responsibilities:

- Create a Nexa USDT order for `1.00 USDT`.
- Store pending orders keyed by local order number.
- Poll or query payment status using existing Nexa payment helpers.
- Grant `3` credits exactly once when an order is confirmed paid.
- Return pending, paid, expired, or failed status to the frontend.
- Support return-from-Nexa and polling flows, because existing H5 payment pages may resume after the Nexa App order screen returns control to the browser.

## Music Proxy Module

Responsibilities:

- Validate user session for protected music operations.
- Enforce credit checks for generation creation.
- Inject the server-owned Godfather Music API Key.
- Forward non-generation music API requests.
- Track generation tasks and resulting song IDs for the current user.
- Proxy media URLs safely without leaking credentials.

## Data Model

## `ai_music_users`

- `id`
- `open_id`
- `nickname`
- `avatar`
- `created_at`
- `updated_at`

Constraints:

- unique on `open_id`

## `ai_music_credit_accounts`

- `user_id`
- `available_credits`
- `total_purchased_credits`
- `total_used_credits`
- `updated_at`

Constraints:

- one row per AI Music user
- `available_credits` must not go below zero

## `ai_music_credit_ledger`

- `id`
- `user_id`
- `type`
- `credits`
- `balance_after`
- `reference_type`
- `reference_id`
- `note`
- `created_at`

Types:

- `purchase`
- `generation_debit`
- `admin_adjustment` reserved for future admin tooling

## `ai_music_orders`

- `id`
- `user_id`
- `order_no`
- `nexa_order_id`
- `amount`
- `currency`
- `credits`
- `status`
- `created_at`
- `paid_at`
- `updated_at`

Rules:

- unique on `order_no`
- granting credits must be idempotent for paid orders
- allowed statuses: `pending`, `paid`, `expired`, `failed`

## `ai_music_generations`

- `id`
- `user_id`
- `upstream_task_id`
- `request_payload_json`
- `status`
- `credits_charged`
- `created_at`
- `completed_at`
- `updated_at`

Rules:

- `credits_charged` is `1` for normal generation tasks
- `upstream_task_id` should be unique when present
- allowed statuses: `submitted`, `processing`, `completed`, `failed`

## `ai_music_songs`

- `id`
- `user_id`
- `generation_id`
- `upstream_song_id`
- `title`
- `status`
- `cover_url`
- `audio_url`
- `created_at`
- `updated_at`

Rules:

- unique on `upstream_song_id` when present
- rows are created or updated from generation polling results

## API Design

## Session

- `POST /api/ai-music/session`
  - body: `openId`, `sessionKey`, `nickname`, `avatar`
  - creates AI Music session cookie
  - ensures user and credit account rows
  - returns session and credit summary

- `GET /api/ai-music/session`
  - returns current session and credit summary
  - returns `401` when not authorized

- `POST /api/ai-music/session/logout`
  - clears the AI Music session cookie

## Credits

- `GET /api/ai-music/credits`
  - returns `availableCredits`, package price, and package credits

- `POST /api/ai-music/credits/order`
  - creates a `1.00 USDT` Nexa payment order for `3` credits
  - returns Nexa order URL/payload using the same style as existing H5 payment flows
  - stores the order as `pending`

- `GET /api/ai-music/credits/order/:orderNo`
  - returns order status
  - confirms payment and grants credits if the Nexa order is paid
  - safe to poll repeatedly; credit granting remains idempotent

- `POST /api/ai-music/credits/order/:orderNo/refresh`
  - explicitly queries Nexa for the latest status after the user returns from payment
  - grants credits if the remote status is paid

## Music

- `ALL /api/ai-music/music/*`
  - forwards to the corresponding upstream `/ai6api/music/*` endpoint
  - requires AI Music session
  - generation create requests require available credits

- `GET /api/ai-music/media?u=<url>`
  - proxies media playback/download requests
  - requires AI Music session

Generation create behavior:

- For `POST /api/ai-music/music/generate`:
  - require one available credit
  - forward request upstream
  - if upstream returns a task ID, debit one credit and store generation row
  - return upstream response plus updated credit balance
  - if debit fails after upstream task creation, return `402` and log the orphan upstream task ID for reconciliation

Polling behavior:

- For generation status polling:
  - forward request upstream
  - update local generation and song records when song IDs or media URLs appear
  - return upstream response plus current credit balance where useful

## Configuration

Environment variables:

- `HH_UPSTREAM`
  - default: `https://ai6666.com`
- `HH_API_KEY`
  - required in production for AI Music generation
- `AI_MUSIC_PACKAGE_AMOUNT`
  - default: `1.00`
- `AI_MUSIC_PACKAGE_CREDITS`
  - default: `3`

Admin settings may later mirror these values, but environment variables are enough for the first version.

## Error Handling

- Missing Nexa session: return `401` with a user-facing login message.
- Missing `HH_API_KEY`: return `503` and tell the user the service is not configured.
- Insufficient credits: return `402` with package details so the frontend can open purchase flow.
- Nexa payment creation failure: return `502` or `500` with a clear payment failure message.
- Upstream Godfather Music failure before task creation: return upstream error, do not debit credit.
- Upstream timeout: return a retryable error; do not debit unless a task ID was already created.
- Media proxy invalid URL: return `400`.
- Media upstream failure: preserve upstream status when practical.

## Testing

Focused tests should cover:

- Games hub includes the AI Music card and route.
- AI Music page renders without the old `hh_` API Key login gate.
- Nexa auth callback is exchanged and synced into AI Music session.
- Credit purchase order creation uses `1.00 USDT` and grants `3` credits exactly once.
- Generation without credits returns `402`.
- Successful generation creates an upstream task, deducts exactly one credit, and records a generation row.
- Upstream validation failure does not deduct credit.
- Music proxy injects the server-side bearer key and does not expose it to frontend code.
- My Music does not expose raw account-wide upstream results that are not attributed to the current Nexa user.

## Rollout Notes

- Deploy requires `HH_API_KEY` on the server.
- Before enabling in the hub, test with a small Nexa payment and a real generation.
- Keep the first package fixed at `1 USDT = 3 credits` until payment, ledger, and generation accounting are verified in production.
