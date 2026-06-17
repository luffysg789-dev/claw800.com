# AI Music Nexa Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI Music H5 entry in the games hub where Nexa-authorized users buy `1 USDT = 3` generation credits and spend credits through a server-side Godfather Music API proxy.

**Architecture:** Add focused AI Music database tables and server helpers to the existing Express/SQLite app, then adapt the imported static Godfather Music frontend under `public/ai-music/`. The frontend never sees `HH_API_KEY`; all music and media requests go through `/api/ai-music/*`.

**Tech Stack:** Node.js, Express, better-sqlite3, static ES modules, Node test runner.

---

## Chunk 1: Backend Data, Session, Credits, and Proxy

### Task 1: AI Music Database Schema

**Files:**
- Modify: `src/db.js`
- Test: `tests/ai-music-api.test.js`

- [ ] **Step 1: Write failing schema test**
  - Create `tests/ai-music-api.test.js` with a harness like `tests/nchat-auth-api.test.js`.
  - Assert requiring `src/db.js` creates `ai_music_users`, `ai_music_credit_accounts`, `ai_music_credit_ledger`, `ai_music_orders`, `ai_music_generations`, and `ai_music_songs`.
  - Run: `node --test tests/ai-music-api.test.js`
  - Expected: FAIL because tables do not exist.

- [ ] **Step 2: Add schema**
  - Add `CREATE TABLE IF NOT EXISTS` blocks in `src/db.js`.
  - Add unique indexes for `open_id`, `order_no`, `upstream_task_id`, and `upstream_song_id`.

- [ ] **Step 3: Verify schema test passes**
  - Run: `node --test tests/ai-music-api.test.js`
  - Expected: PASS.

### Task 2: Session and Credits API

**Files:**
- Modify: `src/server.js`
- Test: `tests/ai-music-api.test.js`

- [ ] **Step 1: Write failing session tests**
  - Assert `POST /api/ai-music/session` requires `openId` and `sessionKey`.
  - Assert valid session creates a cookie, AI Music user, credit account with zero credits, and returns package `{ amount: "1.00", credits: 3 }`.
  - Assert `GET /api/ai-music/credits` returns `401` without cookie and balance with cookie.
  - Run: `node --test tests/ai-music-api.test.js`
  - Expected: FAIL because routes do not exist.

- [ ] **Step 2: Implement session helpers and routes**
  - Add constants `AI_MUSIC_SESSION_COOKIE_NAME`, `AI_MUSIC_SESSION_MAX_AGE_MS`, `AI_MUSIC_PACKAGE_AMOUNT`, `AI_MUSIC_PACKAGE_CREDITS`.
  - Add encode/decode/build session helpers near existing Nexa session helpers.
  - Add `ensureAiMusicUserAccount`, `getAiMusicCreditSummary`, and `requireAiMusicSession`.
  - Add `POST/GET /api/ai-music/session`, `POST /api/ai-music/session/logout`, and `GET /api/ai-music/credits`.

- [ ] **Step 3: Verify tests pass**
  - Run: `node --test tests/ai-music-api.test.js`
  - Expected: PASS.

### Task 3: Credit Purchase Order API

**Files:**
- Modify: `src/server.js`
- Test: `tests/ai-music-api.test.js`

- [ ] **Step 1: Write failing purchase tests**
  - Stub Nexa credentials/env enough to call order creation without real network where possible.
  - Assert unauthenticated purchase returns `401`.
  - Assert paid-order credit granting is idempotent at the helper/API boundary.
  - Run: `node --test tests/ai-music-api.test.js`
  - Expected: FAIL because order API does not exist.

- [ ] **Step 2: Implement order rows and credit grant helper**
  - Add `grantAiMusicCreditsForOrder` transaction.
  - Add `POST /api/ai-music/credits/order` for a `1.00 USDT` order using existing Nexa payment payload helpers.
  - Add `GET /api/ai-music/credits/order/:orderNo` and `POST /api/ai-music/credits/order/:orderNo/refresh`.

- [ ] **Step 3: Verify tests pass**
  - Run: `node --test tests/ai-music-api.test.js`
  - Expected: PASS.

### Task 4: Music API and Media Proxy

**Files:**
- Modify: `src/server.js`
- Test: `tests/ai-music-api.test.js`

- [ ] **Step 1: Write failing proxy tests**
  - Assert missing `HH_API_KEY` returns `503`.
  - Assert generation without credits returns `402`.
  - Assert generation with credits forwards to upstream with server-side bearer key and deducts exactly one credit after an upstream task id is returned.
  - Assert upstream validation failure does not deduct credit.

- [ ] **Step 2: Implement proxy helpers and routes**
  - Add `getAiMusicConfig`, `post/get upstream fetch` helper using built-in `fetch`.
  - Add `app.all('/api/ai-music/music/*')`.
  - Special-case `POST /generate` for credit check and debit.
  - Add `GET /api/ai-music/media`.

- [ ] **Step 3: Verify tests pass**
  - Run: `node --test tests/ai-music-api.test.js`
  - Expected: PASS.

## Chunk 2: Frontend and Games Hub

### Task 5: Copy and Adapt AI Music Frontend

**Files:**
- Create: `public/ai-music/index.html`
- Create/Modify: `public/ai-music/assets/*`
- Test: `tests/ai-music-page.test.js`

- [ ] **Step 1: Copy static app assets**
  - Copy `index.html` and `assets/` from `/Users/cici/Downloads/godfather-music-web-1.0.0`.

- [ ] **Step 2: Write failing page test**
  - Assert `/public/ai-music/index.html` exists.
  - Assert copied frontend no longer contains `hh_` API Key login copy.
  - Assert API base uses `/api/ai-music/music`.

- [ ] **Step 3: Adapt auth/API modules**
  - Replace API Key storage with Nexa session bootstrap.
  - Add credit display and purchase action.
  - Update media URL helper to `/api/ai-music/media?u=...`.

- [ ] **Step 4: Verify page test passes**
  - Run: `node --test tests/ai-music-page.test.js`
  - Expected: PASS.

### Task 6: Games Hub Entry and Route

**Files:**
- Modify: `public/games-config.js`
- Modify: `src/db.js`
- Modify: `src/server.js`
- Test: `tests/games-page-layout.test.js`
- Test: `tests/ai-music-page.test.js`

- [ ] **Step 1: Write failing hub/route tests**
  - Assert `public/games-config.js` includes enabled `ai-music` card with route `/ai-music/`.
  - Assert Express serves `/ai-music/` index file.

- [ ] **Step 2: Implement hub and route**
  - Add default games config entry.
  - Add `DEFAULT_GAMES_CATALOG` entry in `src/db.js`.
  - Add route handler for `/ai-music`.

- [ ] **Step 3: Verify tests pass**
  - Run: `node --test tests/games-page-layout.test.js tests/ai-music-page.test.js`
  - Expected: PASS.

## Final Verification

- [ ] Run backend targeted tests:
  - `node --test tests/ai-music-api.test.js tests/nexa-pay.test.js`
- [ ] Run frontend targeted tests:
  - `node --test tests/ai-music-page.test.js tests/games-page-layout.test.js`
- [ ] Run auth regression:
  - `node --test tests/nchat-auth-api.test.js tests/p-mining-auth-api.test.js tests/nexa-escrow-auth-api.test.js`
- [ ] Start server locally:
  - `PORT=3000 HOST=127.0.0.1 node src/server.js`
- [ ] Open `/ai-music/` and visually check login/credits shell.
