# Muyu Dark Media Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the 木鱼 game to use a dark visual theme, white text, image-based woodfish/mallet visuals, and a provided strike audio file while preserving existing gameplay.

**Architecture:** Keep the current `muyu.html` / `muyu.js` structure, but swap the CSS-drawn visuals for asset-backed presentation and add an audio playback path that prefers a bundled MP3 and falls back to generated sound. Styling stays in `public/styles.css` so mobile and desktop continue sharing one responsive source.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, local media assets.

---

### Task 1: Add local woodfish media assets

**Files:**
- Create: `public/assets/muyu-fish.svg`
- Create: `public/assets/muyu-mallet.svg`
- Create: `public/audio/muyu-strike.mp3`

- [ ] Add a reusable woodfish SVG inspired by the provided reference.
- [ ] Add a reusable mallet SVG inspired by the provided reference.
- [ ] Copy the provided strike MP3 into the public audio folder.

### Task 2: Update woodfish page markup

**Files:**
- Modify: `public/muyu.html`

- [ ] Replace the current CSS-only woodfish body with image-backed markup.
- [ ] Keep existing IDs (`muyuStrikeBtn`, `muyuHint`, stat IDs, action button IDs) so current JS wiring stays valid.
- [ ] Preserve accessibility labels and strike interaction.

### Task 3: Refresh dark visual theme

**Files:**
- Modify: `public/styles.css`

- [ ] Change the woodfish page shell to a black / near-black theme with white text.
- [ ] Style the woodfish and mallet images to fit the new dark layout.
- [ ] Keep responsive mobile layout intact while centering the main stage.
- [ ] Ensure action buttons and stat cards remain readable on dark background.

### Task 4: Prefer uploaded strike audio

**Files:**
- Modify: `public/muyu.js`

- [ ] Add an `Audio` element path for `/audio/muyu-strike.mp3`.
- [ ] Play that file on strike when available.
- [ ] Fall back to the existing generated sound if loading or playback fails.
- [ ] Keep background music and count logic unchanged.

### Task 5: Verify behavior

**Files:**
- Verify: `public/muyu.html`
- Verify: `public/muyu.js`
- Verify: `public/styles.css`

- [ ] Run `node -c public/muyu.js`.
- [ ] Confirm the media files exist in the expected public paths.
- [ ] Smoke-check the HTML / CSS references with targeted `rg` or `sed` output.
