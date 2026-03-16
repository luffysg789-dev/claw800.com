# Games Admin Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend-managed game configuration so admin edits flow through to the games list and individual game pages.

**Architecture:** Store game metadata in `games_catalog`, expose admin/public game APIs, render the admin editor in `public/admin.js`, and add a shared frontend loader that hydrates `games.html` plus individual game pages with graceful static fallbacks.

**Tech Stack:** Express, better-sqlite3, vanilla JS, static HTML/CSS.

---

## Chunk 1: Backend storage and APIs
- [ ] Confirm `games_catalog` schema and seed rows exist in `src/db.js`.
- [ ] Confirm public/admin routes in `src/server.js` return normalized rows and accept updates.

## Chunk 2: Admin UI
- [ ] Add a `游戏列表` admin view wired through `setView()`.
- [ ] Render editable game cards with fields for name, description, cover image, sound file, visibility, and sort order.
- [ ] Support image/audio file pickers that convert to data URLs before save.
- [ ] Save updates through `/api/admin/games/:id` and refresh the list.

## Chunk 3: Frontend game config loading
- [ ] Add a shared `public/games-config.js` loader with static fallbacks.
- [ ] Render `games.html` cards from `/api/games`, falling back to defaults if the API is unavailable.
- [ ] Hydrate each game page title/subtitle/config from `/api/games/:slug`.

## Chunk 4: Per-game behavior
- [ ] Update `muyu.js` to prefer uploaded audio, then bundled audio, then synth fallback.
- [ ] Update `fortune.js` and `minesweeper.js` to consume uploaded sound overrides if present.

## Chunk 5: Verification
- [ ] Run syntax checks for `src/server.js`, `public/admin.js`, `public/games-config.js`, `public/muyu.js`, `public/fortune.js`, and `public/minesweeper.js`.
- [ ] Spot-check the HTML references and relevant IDs with `rg`.
