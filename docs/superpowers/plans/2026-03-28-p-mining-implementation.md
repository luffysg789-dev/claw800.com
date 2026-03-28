# P-Mining Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new mobile-first `P-Mining` mining-game prototype inside the existing games project, matching the provided dark glassmorphism UI while simulating Nexa-authenticated user state, mining claims, invite flows, and records locally.

**Architecture:** Add a standalone static game page under `public/p-mining/`, register it in the shared game directory, and implement the prototype as a focused front-end module with small state helpers for host-user bootstrap, local persistence, simulated network stats, claim cooldown logic, invite validation, and tab rendering. Cover the integration with static page tests plus focused state tests so the prototype can evolve toward a later Firebase-backed version without redesigning the UI layer.

**Tech Stack:** Static HTML/CSS/JavaScript, existing Express static routing and game config flow, Node `node:test`, browser `localStorage`, simulated Nexa host bridge

---

## Chunk 1: Entry Registration And Page Shell

### Task 1: Register `p-mining` in shared game config and server defaults

**Files:**
- Modify: `public/games-config.js`
- Modify: `src/db.js`
- Modify: `src/server.js`
- Test: `tests/p-mining-page.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('p-mining is listed in config, db defaults, and route map', () => {
  assert.match(config, /slug:\s*'p-mining'/);
  assert.match(config, /name:\s*'P-Mining'/);
  assert.match(config, /route:\s*'\/p-mining\/'/);
  assert.match(config, /p-mining:\s*'开始挖矿'/);
  assert.match(db, /slug:\s*'p-mining'/);
  assert.match(server, /p-mining:\s*'\/p-mining\/'/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/p-mining-page.test.js`
Expected: FAIL because the `p-mining` config and route entries do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add a new default game entry for `p-mining` in `public/games-config.js`, then mirror the standalone route/default metadata in `src/db.js` and `src/server.js` using the same pattern as other directory-based games.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/p-mining-page.test.js`
Expected: PASS for the config and route assertions.

- [ ] **Step 5: Commit**

```bash
git add public/games-config.js src/db.js src/server.js tests/p-mining-page.test.js
git commit -m "feat: register p-mining game entry"
```

### Task 2: Create the standalone `P-Mining` page shell

**Files:**
- Create: `public/p-mining/index.html`
- Test: `tests/p-mining-page.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('p-mining html includes host header, tab panels, and script mounts', () => {
  assert.match(html, /<title>Claw800 P-Mining<\/title>/);
  assert.match(html, /data-p-mining-app/);
  assert.match(html, /data-tab="mining"/);
  assert.match(html, /data-tab="invite"/);
  assert.match(html, /data-tab="records"/);
  assert.match(html, /data-tab="profile"/);
  assert.match(html, /id="pMiningClaimButton"/);
  assert.match(html, /id="pMiningStatsGrid"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/p-mining-page.test.js`
Expected: FAIL because `public/p-mining/index.html` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `public/p-mining/index.html` with:
- a top brand row that matches the provided `P-Mining` header
- a host-status pill for network connection
- one root app container
- four tab panels and the bottom navigation shell
- placeholders for balance card, circular claim button, stats grid, invite blocks, records list, and profile blocks
- shared `games-config.js` bootstrap include

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/p-mining-page.test.js`
Expected: PASS for the shell structure assertions.

- [ ] **Step 5: Commit**

```bash
git add public/p-mining/index.html tests/p-mining-page.test.js
git commit -m "feat: add p-mining page shell"
```

## Chunk 2: Visual Layout And Static Contracts

### Task 3: Add the mining-page visual system and card layout

**Files:**
- Create: `public/p-mining/style.css`
- Modify: `public/p-mining/index.html`
- Test: `tests/p-mining-page.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('p-mining css includes dark glass tokens, bottom nav, and circular claim layout', () => {
  assert.match(css, /--p-mining-accent:\s*#F27D26/i);
  assert.match(css, /--p-mining-power:\s*#/);
  assert.match(css, /\.p-mining-balance-card\s*\{/);
  assert.match(css, /\.p-mining-claim-ring\s*\{/);
  assert.match(css, /\.p-mining-nav\s*\{/);
  assert.match(css, /padding-bottom:\s*calc\(.*env\(safe-area-inset-bottom\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/p-mining-page.test.js`
Expected: FAIL because the stylesheet and visual contract do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `public/p-mining/style.css` and refine the HTML class structure so the page renders:
- black-to-deep-gray background
- glassmorphism cards with subtle borders and blur
- large orange balance number
- yellow power highlight
- fixed frosted bottom navigation
- mobile-safe spacing and desktop centered preview width

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/p-mining-page.test.js`
Expected: PASS for the visual token and layout assertions.

- [ ] **Step 5: Commit**

```bash
git add public/p-mining/index.html public/p-mining/style.css tests/p-mining-page.test.js
git commit -m "feat: style p-mining prototype layout"
```

### Task 4: Lock the static UI content for stats, invite, records, and profile sections

**Files:**
- Modify: `public/p-mining/index.html`
- Modify: `public/p-mining/style.css`
- Test: `tests/p-mining-page.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('p-mining html includes the expected mining, invite, records, and profile sections', () => {
  assert.match(html, /当前持有 P/);
  assert.match(html, /邀请好友/);
  assert.match(html, /领取记录/);
  assert.match(html, /当前总积分/);
  assert.match(html, /P 是 Nexa 生态内的积分系统/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/p-mining-page.test.js`
Expected: FAIL because the detailed section copy and structure are not complete yet.

- [ ] **Step 3: Write minimal implementation**

Expand the page markup so each tab contains the expected static labels, placeholders, list containers, and rule text from the approved spec and provided UI reference.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/p-mining-page.test.js`
Expected: PASS for the static content assertions.

- [ ] **Step 5: Commit**

```bash
git add public/p-mining/index.html public/p-mining/style.css tests/p-mining-page.test.js
git commit -m "feat: add p-mining section content"
```

## Chunk 3: Local State Helpers And Nexa Host Simulation

### Task 5: Add pure helpers for host user bootstrap, formatting, and storage defaults

**Files:**
- Create: `public/p-mining/script.js`
- Create: `tests/p-mining-state.test.js`
- Test: `tests/p-mining-state.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('getMockNexaUser returns connected host user data', () => {
  const user = getMockNexaUser();
  assert.equal(typeof user.uid, 'string');
  assert.equal(typeof user.email, 'string');
  assert.equal(user.networkConnected, true);
});

test('createDefaultMiningState seeds balance, power, and invite code', () => {
  const state = createDefaultMiningState({ uid: 'u_1' });
  assert.equal(state.balance, 0);
  assert.equal(state.power, 10);
  assert.equal(typeof state.inviteCode, 'string');
});

test('formatMiningNumber always keeps one decimal place', () => {
  assert.equal(formatMiningNumber(12), '12.0');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/p-mining-state.test.js`
Expected: FAIL because the state helper module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create exportable helpers in `public/p-mining/script.js` for:
- mock Nexa host user bootstrap
- default per-user mining state
- invite-code generation
- one-decimal formatting
- `localStorage` read/write wrappers with fallback behavior

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/p-mining-state.test.js`
Expected: PASS for the pure bootstrap and formatting helpers.

- [ ] **Step 5: Commit**

```bash
git add public/p-mining/script.js tests/p-mining-state.test.js
git commit -m "feat: add p-mining state bootstrap helpers"
```

### Task 6: Add pure helpers for network stats simulation and mining reward math

**Files:**
- Modify: `public/p-mining/script.js`
- Modify: `tests/p-mining-state.test.js`
- Test: `tests/p-mining-state.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('calculateClaimReward uses the specified mining formula', () => {
  const reward = calculateClaimReward({
    userPower: 20,
    networkPower: 200,
    dailyCap: 71917808
  });
  assert.equal(reward, 49942.9);
});

test('advanceNetworkStats updates mined totals and remaining supply', () => {
  const next = advanceNetworkStats(createDefaultNetworkStats(), 60_000);
  assert.ok(next.totalMined > 0);
  assert.ok(next.remainingSupply < 210000000000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/p-mining-state.test.js`
Expected: FAIL because reward math and network simulation helpers do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add helpers for:
- default network stats seed values
- reward formula calculation with one-decimal rounding
- time-based network stat advancement
- next halving date / estimated finish display fields

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/p-mining-state.test.js`
Expected: PASS for the mining formula and simulated network progression assertions.

- [ ] **Step 5: Commit**

```bash
git add public/p-mining/script.js tests/p-mining-state.test.js
git commit -m "feat: add p-mining reward and network helpers"
```

## Chunk 4: Claim Flow, Cooldown, And Records

### Task 7: Add pure claim-state and record-writing behavior

**Files:**
- Modify: `public/p-mining/script.js`
- Modify: `tests/p-mining-state.test.js`
- Test: `tests/p-mining-state.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('canClaim returns false during the 60-second cooldown', () => {
  assert.equal(canClaim({ lastClaimAt: Date.now() - 20_000, now: Date.now() }), false);
});

test('applyClaimResult updates balance, lastClaimAt, and claim records', () => {
  const next = applyClaimResult(baseState, {
    reward: 49942.9,
    claimedAt: 1710000000000
  });
  assert.equal(next.balance, 49942.9);
  assert.equal(next.claimRecords[0].reward, 49942.9);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/p-mining-state.test.js`
Expected: FAIL because cooldown and claim-state reducers do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add pure helpers for:
- claim eligibility
- cooldown remaining seconds
- claim-state reducer
- prepend-and-cap record insertion for claim logs
- `isProcessing` style guard state for UI use

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/p-mining-state.test.js`
Expected: PASS for cooldown and record updates.

- [ ] **Step 5: Commit**

```bash
git add public/p-mining/script.js tests/p-mining-state.test.js
git commit -m "feat: add p-mining claim state reducers"
```

### Task 8: Wire the DOM claim button, countdown ring, and tab switching

**Files:**
- Modify: `public/p-mining/script.js`
- Modify: `public/p-mining/index.html`
- Modify: `tests/p-mining-page.test.js`
- Modify: `tests/p-mining-state.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('p-mining script wires tab buttons, countdown updates, and claim action hooks', () => {
  assert.match(js, /function switchTab\(/);
  assert.match(js, /function renderClaimState\(/);
  assert.match(js, /function handleClaimButtonClick\(/);
  assert.match(js, /window\.setInterval\(/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/p-mining-page.test.js tests/p-mining-state.test.js`
Expected: FAIL because the DOM interaction layer is not implemented yet.

- [ ] **Step 3: Write minimal implementation**

Implement the browser-facing module code that:
- finds the app nodes
- renders the active tab
- updates balance/power/minute reward labels
- animates the circular cooldown progress via CSS variables
- locks repeated clicks while processing
- persists updated state to storage after claims

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/p-mining-page.test.js tests/p-mining-state.test.js`
Expected: PASS for the script hook assertions and previously added pure-state tests.

- [ ] **Step 5: Commit**

```bash
git add public/p-mining/index.html public/p-mining/script.js tests/p-mining-page.test.js tests/p-mining-state.test.js
git commit -m "feat: wire p-mining claim flow"
```

## Chunk 5: Invite Flow, Records Tabs, And Profile Rendering

### Task 9: Add invite validation and power-bonus reducers

**Files:**
- Modify: `public/p-mining/script.js`
- Modify: `tests/p-mining-state.test.js`
- Test: `tests/p-mining-state.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('bindInviteCode rejects self-binding and duplicate binding', () => {
  assert.throws(() => bindInviteCode(baseState, baseState.inviteCode), /self/i);
  const bound = bindInviteCode(baseState, '2G4WQC');
  assert.throws(() => bindInviteCode(bound, 'ABC123'), /already bound/i);
});

test('bindInviteCode adds +10 power and records invite activity', () => {
  const next = bindInviteCode(baseState, '2G4WQC');
  assert.equal(next.power, 20);
  assert.equal(next.invitePowerBonus, 10);
  assert.equal(next.inviteRecords.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/p-mining-state.test.js`
Expected: FAIL because invite reducers and validation do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add pure invite helpers for:
- self-bind detection
- single-bind enforcement
- simple allowlist validation against demo invite codes
- power bonus application
- invite / power-change record writing

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/p-mining-state.test.js`
Expected: PASS for invite validation and power-bonus behavior.

- [ ] **Step 5: Commit**

```bash
git add public/p-mining/script.js tests/p-mining-state.test.js
git commit -m "feat: add p-mining invite reducers"
```

### Task 10: Render invite, record, and profile panels with interactive UI states

**Files:**
- Modify: `public/p-mining/script.js`
- Modify: `public/p-mining/index.html`
- Modify: `public/p-mining/style.css`
- Modify: `tests/p-mining-page.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('p-mining script includes invite submit, copy action, record filter, and profile render hooks', () => {
  assert.match(js, /function handleInviteSubmit\(/);
  assert.match(js, /function handleCopyInviteCode\(/);
  assert.match(js, /function renderRecordsPanel\(/);
  assert.match(js, /function renderProfilePanel\(/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/p-mining-page.test.js`
Expected: FAIL because the invite/records/profile DOM behavior is not implemented yet.

- [ ] **Step 3: Write minimal implementation**

Implement the browser UI layer so:
- invite code can be copied
- invite input can be submitted and error states shown inline
- records tab filter buttons switch list content
- profile panel renders host user email, UID, totals, and bind status
- logout button clears local mining state but leaves the mock host bridge intact

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/p-mining-page.test.js tests/p-mining-state.test.js`
Expected: PASS for the new script-hook assertions and all prior tests.

- [ ] **Step 5: Commit**

```bash
git add public/p-mining/index.html public/p-mining/style.css public/p-mining/script.js tests/p-mining-page.test.js tests/p-mining-state.test.js
git commit -m "feat: finish p-mining secondary panels"
```

## Chunk 6: Polish, Regression Coverage, And Final Verification

### Task 11: Add regression checks for persistence, missing host data, and empty-state rendering

**Files:**
- Modify: `tests/p-mining-page.test.js`
- Modify: `tests/p-mining-state.test.js`
- Modify: `public/p-mining/script.js`

- [ ] **Step 1: Write the failing test**

```js
test('loadMiningState falls back safely when storage is corrupt', () => {
  assert.doesNotThrow(() => loadMiningState(corruptStorage, hostUser));
});

test('getMockNexaUser fallback still returns a usable guest-like host shell when fields are missing', () => {
  const user = normalizeHostUser({});
  assert.equal(user.networkConnected, false);
  assert.equal(typeof user.uid, 'string');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/p-mining-page.test.js tests/p-mining-state.test.js`
Expected: FAIL because the fallback behavior is not fully covered or implemented yet.

- [ ] **Step 3: Write minimal implementation**

Tighten the host normalization and storage fallback code so corrupt cached state, partial host payloads, and empty record lists render safely without breaking the page.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/p-mining-page.test.js tests/p-mining-state.test.js`
Expected: PASS with all `p-mining` tests green.

- [ ] **Step 5: Commit**

```bash
git add public/p-mining/script.js tests/p-mining-page.test.js tests/p-mining-state.test.js
git commit -m "test: cover p-mining fallback states"
```

### Task 12: Run full verification for the new prototype entry

**Files:**
- Test: `tests/p-mining-page.test.js`
- Test: `tests/p-mining-state.test.js`
- Test: existing games config coverage if impacted

- [ ] **Step 1: Run focused `p-mining` tests**

Run: `node --test tests/p-mining-page.test.js tests/p-mining-state.test.js`
Expected: PASS with no failures.

- [ ] **Step 2: Run adjacent regression tests for shared game directory behavior**

Run: `node --test tests/games-page-layout.test.js`
Expected: PASS to confirm the new game entry does not break shared game list behavior.

- [ ] **Step 3: Manual browser verification**

Open `/p-mining/` and verify:
- mining tab matches the approved UI shape
- cooldown ring animates and restores after refresh
- invite bind flow enforces one-time/self-bind rules
- records switch correctly
- profile renders host user info

- [ ] **Step 4: Commit final polish if needed**

```bash
git add public/p-mining/index.html public/p-mining/style.css public/p-mining/script.js tests/p-mining-page.test.js tests/p-mining-state.test.js
git commit -m "feat: complete p-mining prototype"
```
