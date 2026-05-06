# Lucky Star Investment Website Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone bilingual corporate website for LUCKY STAR INVESTMENT L.L.C at `/lucky-star/`.

**Architecture:** Add a self-contained static page under `public/lucky-star/` with its own HTML, CSS, JS, and copied image assets. Use data attributes and a tiny script for Chinese/English switching, while keeping all source facts in the page for static testability.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, existing Express static server, Node `node:test`.

---

## File Structure

- Create: `public/lucky-star/index.html`
- Create: `public/lucky-star/style.css`
- Create: `public/lucky-star/script.js`
- Create: `public/lucky-star/assets/office-logo.jpg`
- Create: `public/lucky-star/assets/lounge-screen.jpg`
- Create: `public/lucky-star/assets/city-lounge.jpg`
- Create: `public/lucky-star/assets/executive-room.jpg`
- Create: `public/lucky-star/assets/open-lounge.jpg`
- Create: `public/lucky-star/assets/reception.jpg`
- Create: `public/lucky-star/assets/workspace.jpg`
- Create: `tests/lucky-star-page.test.js`

## Chunk 1: Static Contract

### Task 1: Add failing page contract test

- [ ] **Step 1: Write the failing test**

Create `tests/lucky-star-page.test.js` with assertions that:

- `public/lucky-star/index.html`, `style.css`, and `script.js` exist.
- The HTML contains `LUCKY STAR INVESTMENT L.L.C`.
- The HTML contains license number `1324352`, commercial register number `2248245`, chamber membership number `526077`, capital `150,000 AED`, and validity date `2026-03-13`.
- The HTML exposes language buttons for Chinese and English.
- Every local image referenced from `assets/` exists.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/lucky-star-page.test.js`

Expected: FAIL because the page files do not exist yet.

## Chunk 2: Website Implementation

### Task 2: Create page assets and structure

- [ ] **Step 1: Copy selected source images**

Copy seven office photos into `public/lucky-star/assets/` with stable descriptive names.

- [ ] **Step 2: Implement minimal HTML**

Create `index.html` with semantic sections for hero, profile, sectors, registration, office gallery, and contact. Include data attributes for bilingual text and initial Chinese copy.

- [ ] **Step 3: Implement CSS**

Create responsive, polished corporate styling with brand red/green accents, restrained sections, professional typography, and mobile-safe layouts.

- [ ] **Step 4: Implement language toggle**

Create `script.js` to switch `[data-zh]` / `[data-en]` text and update `lang`, active button state, and local storage.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/lucky-star-page.test.js`

Expected: PASS.

## Chunk 3: Browser Verification

### Task 3: Verify locally

- [ ] **Step 1: Start the existing server**

Run: `PORT=3017 HOST=127.0.0.1 node src/server.js`

Expected: server starts on `http://127.0.0.1:3017`.

- [ ] **Step 2: Check page response**

Run: `curl -I -s http://127.0.0.1:3017/lucky-star/`

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 3: Inspect the page in browser if available**

Open `http://127.0.0.1:3017/lucky-star/` and confirm hero, gallery, bilingual toggle, and contact section render without overlap.
