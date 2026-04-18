# Nchat Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Nexa App only H5 one-to-one chat app named Nchat with Nexa authorization, forced first-time profile setup, unique 8-digit chat IDs, instant friendship on search, realtime text messaging, and Telegram-style unread badges.

**Architecture:** Add a standalone `/nchat/` app under `public/` using the existing Nexa-integrated H5 pattern already used by `p-mining`, `tigang-master`, and `nexa-escrow`. Extend `src/db.js` and `src/server.js` with Nchat-specific tables, session endpoints, search/friend/message APIs, and an SSE stream keyed by authenticated user ID so the mobile UI can receive realtime conversation and unread updates.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Express, SQLite via existing `db.prepare(...)` patterns, Server-Sent Events, Node test runner.

---

## Chunk 1: Catalog, route, and data foundation

### Task 1: Add failing coverage for Nchat catalog wiring and page shell

**Files:**
- Create: `tests/nchat-page.test.js`
- Modify: `tests/games-page-layout.test.js`

- [ ] **Step 1: Write failing tests for Nchat route and page shell**

```js
test('nchat is wired as a standalone Nexa-only app route', () => {
  const config = fs.readFileSync(configPath, 'utf8');
  const server = fs.readFileSync(serverPath, 'utf8');

  assert.match(config, /slug:\s*'nchat'/);
  assert.match(config, /route:\s*'\/nchat\/'/);
  assert.match(server, /'nchat':\s*'\/nchat\/'/);
});

test('nchat html includes chat tab, profile tab, and profile setup modal hooks', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /data-nchat-app/);
  assert.match(html, /data-tab-target="chat"/);
  assert.match(html, /data-tab-target="me"/);
  assert.match(html, /id="nchatProfileSetupModal"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/nchat-page.test.js tests/games-page-layout.test.js`  
Expected: FAIL because the Nchat files and route wiring do not exist yet.

- [ ] **Step 3: Add minimal route/catalog placeholders**

Files to touch in later tasks:
- `public/games-config.js`
- `src/db.js`
- `src/server.js`
- `public/nchat/index.html`
- `public/nchat/style.css`
- `public/nchat/script.js`

- [ ] **Step 4: Re-run the same tests**

Run: `node --test tests/nchat-page.test.js tests/games-page-layout.test.js`  
Expected: still failing until all route/page files are added.

- [ ] **Step 5: Commit**

```bash
git add tests/nchat-page.test.js tests/games-page-layout.test.js
git commit -m "test: add failing Nchat route and shell coverage"
```

### Task 2: Add Nchat to public config, backend defaults, and static route map

**Files:**
- Modify: `public/games-config.js`
- Modify: `src/db.js`
- Modify: `src/server.js`
- Test: `tests/nchat-page.test.js`
- Test: `tests/games-page-layout.test.js`

- [ ] **Step 1: Add minimal failing assertions if needed for Nexa-only entry behavior**

```js
assert.match(config, /slug:\s*'nchat'/);
assert.match(config, /route:\s*'\/nchat\/'/);
assert.match(server, /'nchat':\s*'\/nchat\/'/);
```

- [ ] **Step 2: Run the focused tests**

Run: `node --test tests/nchat-page.test.js tests/games-page-layout.test.js`  
Expected: FAIL before config wiring is added.

- [ ] **Step 3: Implement minimal config wiring**

- Add Nchat entry in `public/games-config.js`
- Add default game metadata in `src/db.js`
- Add `/nchat/` route in the static route map in `src/server.js`
- Keep the metadata marked or described as Nexa-only in text where appropriate

- [ ] **Step 4: Run tests again**

Run: `node --test tests/nchat-page.test.js tests/games-page-layout.test.js`  
Expected: route wiring assertions pass, page shell assertions still fail.

- [ ] **Step 5: Commit**

```bash
git add public/games-config.js src/db.js src/server.js tests/nchat-page.test.js tests/games-page-layout.test.js
git commit -m "feat: wire Nchat catalog entry and route"
```

### Task 3: Add Nchat database schema and helper statements

**Files:**
- Modify: `src/db.js`
- Create: `tests/nchat-auth-api.test.js`

- [ ] **Step 1: Write failing schema/API test for Nchat user creation**

```js
test('nchat session sync creates a user row with a unique 8-digit chat id', async () => {
  const response = await harness.request('POST', '/api/nchat/session', {
    openId: 'nchat-open-id-1',
    sessionKey: 'nchat-session-key-1',
    nickname: 'Nchat User'
  });

  assert.equal(response.statusCode, 200);
  assert.match(String(response.body.user.chatId || ''), /^\d{8}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat session sync creates a user row with a unique 8-digit chat id"`  
Expected: FAIL because the API and schema do not exist yet.

- [ ] **Step 3: Add schema in `src/db.js`**

Create tables and indexes for:
- `nchat_users`
- `nchat_friendships`
- `nchat_conversations`
- `nchat_messages`
- `nchat_inbox_state`

Also add prepared statements for:
- lookup by `open_id`
- lookup by `chat_id`
- insert user
- update profile
- create normalized friendship
- create direct conversation
- insert message
- update conversation preview
- select conversation list
- select conversation messages
- upsert inbox state

- [ ] **Step 4: Re-run the test**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat session sync creates a user row with a unique 8-digit chat id"`  
Expected: still FAIL, but now only because the API endpoint is missing.

- [ ] **Step 5: Commit**

```bash
git add src/db.js tests/nchat-auth-api.test.js
git commit -m "feat: add Nchat schema and failing auth api test"
```

## Chunk 2: Session, profile completion, and bootstrap

### Task 4: Implement Nchat session sync and bootstrap contract

**Files:**
- Modify: `src/server.js`
- Modify: `tests/nchat-auth-api.test.js`

- [ ] **Step 1: Add failing tests for session reuse and bootstrap**

```js
test('nchat bootstrap returns current profile and requires setup when nickname or avatar is missing', async () => {
  const bootstrap = await harness.request('GET', '/api/nchat/bootstrap', null, { cookies });

  assert.equal(bootstrap.statusCode, 200);
  assert.equal(bootstrap.body.ok, true);
  assert.equal(bootstrap.body.profileSetupRequired, true);
  assert.match(String(bootstrap.body.user.chatId || ''), /^\d{8}$/);
});
```

- [ ] **Step 2: Run the focused tests**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat"`  
Expected: FAIL because bootstrap endpoints do not exist yet.

- [ ] **Step 3: Implement minimal endpoints**

Add to `src/server.js`:
- `POST /api/nchat/session`
- `GET /api/nchat/session`
- `POST /api/nchat/session/logout`
- `GET /api/nchat/bootstrap`

Implementation notes:
- follow existing cookie/session style from `p-mining` / `nexa-escrow`
- create user row if absent
- allocate 8-digit `chatId` with retry-until-unique helper
- expose `profileSetupRequired` when avatar or nickname missing

- [ ] **Step 4: Run tests to confirm pass**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat"`  
Expected: PASS for session + bootstrap coverage added so far.

- [ ] **Step 5: Commit**

```bash
git add src/server.js tests/nchat-auth-api.test.js
git commit -m "feat: add Nchat session and bootstrap endpoints"
```

### Task 5: Implement forced profile setup save flow

**Files:**
- Modify: `src/server.js`
- Modify: `tests/nchat-auth-api.test.js`
- Create: `public/nchat/index.html`
- Create: `public/nchat/style.css`
- Create: `public/nchat/script.js`
- Test: `tests/nchat-page.test.js`

- [ ] **Step 1: Add failing API and page tests for first-time profile completion**

```js
test('nchat profile save completes first-time setup with nickname and avatar', async () => {
  const response = await harness.request('POST', '/api/nchat/profile', {
    nickname: '幽灵通信',
    avatarUrl: '/uploads/nchat/avatar-a.png'
  }, { cookies });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.profileSetupRequired, false);
  assert.equal(response.body.user.nickname, '幽灵通信');
});
```

```js
assert.match(html, /id="nchatProfileSetupModal"/);
assert.match(html, /id="nchatProfileAvatarInput"/);
assert.match(html, /id="nchatProfileNicknameInput"/);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/nchat-auth-api.test.js tests/nchat-page.test.js`  
Expected: FAIL because page shell and profile save are incomplete.

- [ ] **Step 3: Implement minimal UI shell and profile save API**

Backend:
- add `POST /api/nchat/profile`
- require nickname
- require avatar on first-time setup
- allow nickname/avatar edits later

Frontend:
- add `public/nchat/index.html`, `style.css`, `script.js`
- include:
  - Nexa-only guard state
  - loading/auth state
  - profile setup modal
  - bottom nav shell for `聊天` and `我的`

- [ ] **Step 4: Run tests to confirm green**

Run: `node --test tests/nchat-auth-api.test.js tests/nchat-page.test.js`  
Expected: PASS for profile setup and app shell coverage.

- [ ] **Step 5: Commit**

```bash
git add public/nchat/index.html public/nchat/style.css public/nchat/script.js src/server.js tests/nchat-auth-api.test.js tests/nchat-page.test.js
git commit -m "feat: add Nchat shell and profile setup flow"
```

## Chunk 3: Search, friendship, and conversation list

### Task 6: Implement search by nickname or chat ID

**Files:**
- Modify: `src/server.js`
- Modify: `tests/nchat-auth-api.test.js`
- Modify: `public/nchat/script.js`
- Modify: `public/nchat/index.html`

- [ ] **Step 1: Add failing tests for search**

```js
test('nchat search finds users by nickname and exact 8-digit chat id', async () => {
  const response = await harness.request('GET', '/api/nchat/search?q=007', null, { cookies });

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(response.body.items), true);
});
```

- [ ] **Step 2: Run focused test**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat search"`  
Expected: FAIL because search endpoint does not exist.

- [ ] **Step 3: Implement minimal search**

Backend:
- add `GET /api/nchat/search`
- exact match for 8-digit chat ID
- partial match for nickname
- exclude self

Frontend:
- wire top search input and result list rendering

- [ ] **Step 4: Re-run test**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat search"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server.js public/nchat/script.js public/nchat/index.html tests/nchat-auth-api.test.js
git commit -m "feat: add Nchat user search"
```

### Task 7: Implement instant friendship and direct conversation creation

**Files:**
- Modify: `src/server.js`
- Modify: `tests/nchat-auth-api.test.js`
- Modify: `public/nchat/script.js`

- [ ] **Step 1: Add failing test for direct add-and-chat behavior**

```js
test('nchat add friend instantly creates friendship and direct conversation', async () => {
  const response = await harness.request('POST', '/api/nchat/friends', {
    targetChatId: sellerChatId
  }, { cookies: buyerCookies });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.conversation.id > 0, true);
});
```

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat add friend instantly creates friendship and direct conversation"`  
Expected: FAIL because the API does not exist.

- [ ] **Step 3: Implement minimal friendship logic**

Backend:
- add `POST /api/nchat/friends`
- normalize pair ordering
- no duplicate reversed friendships
- create or reuse direct conversation
- if already friends, return existing conversation

Frontend:
- make search result action open the returned conversation immediately

- [ ] **Step 4: Re-run the focused test**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat add friend instantly creates friendship and direct conversation"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server.js public/nchat/script.js tests/nchat-auth-api.test.js
git commit -m "feat: add Nchat direct friendship flow"
```

### Task 8: Implement conversation list bootstrap and unread row rendering

**Files:**
- Modify: `src/server.js`
- Modify: `public/nchat/index.html`
- Modify: `public/nchat/style.css`
- Modify: `public/nchat/script.js`
- Modify: `tests/nchat-page.test.js`
- Modify: `tests/nchat-auth-api.test.js`

- [ ] **Step 1: Add failing tests for conversation row structure**

```js
assert.match(html, /id="nchatConversationList"/);
assert.match(js, /renderConversationList/);
assert.match(js, /unreadCount/);
```

```js
test('nchat bootstrap returns conversation rows with latest message and unread counts', async () => {
  assert.equal(Array.isArray(bootstrap.body.conversations), true);
});
```

- [ ] **Step 2: Run tests**

Run: `node --test tests/nchat-page.test.js tests/nchat-auth-api.test.js`  
Expected: FAIL until conversation list support exists.

- [ ] **Step 3: Implement minimal conversation list**

Backend:
- return conversation list from bootstrap
- include latest message preview, timestamp, unread count

Frontend:
- render rows with:
  - avatar
  - nickname
  - chat ID
  - latest message
  - timestamp
  - unread badge

- [ ] **Step 4: Re-run tests**

Run: `node --test tests/nchat-page.test.js tests/nchat-auth-api.test.js`  
Expected: PASS for conversation list coverage.

- [ ] **Step 5: Commit**

```bash
git add src/server.js public/nchat/index.html public/nchat/style.css public/nchat/script.js tests/nchat-page.test.js tests/nchat-auth-api.test.js
git commit -m "feat: add Nchat conversation list"
```

## Chunk 4: Messaging, unread clearing, and realtime updates

### Task 9: Implement message history and send message endpoint

**Files:**
- Modify: `src/server.js`
- Modify: `tests/nchat-auth-api.test.js`
- Modify: `public/nchat/script.js`
- Modify: `public/nchat/index.html`

- [ ] **Step 1: Add failing tests for message history and send**

```js
test('nchat friends can send text messages and fetch conversation history', async () => {
  const sendResponse = await harness.request('POST', `/api/nchat/conversations/${conversationId}/messages`, {
    content: 'hello'
  }, { cookies: buyerCookies });

  assert.equal(sendResponse.statusCode, 200);
  assert.equal(sendResponse.body.message.content, 'hello');
});
```

- [ ] **Step 2: Run the focused tests**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat friends can send text messages and fetch conversation history"`  
Expected: FAIL because message endpoints do not exist.

- [ ] **Step 3: Implement minimal message flow**

Backend:
- add `GET /api/nchat/conversations/:id/messages`
- add `POST /api/nchat/conversations/:id/messages`
- validate conversation membership
- validate friendship
- reject empty content
- update latest preview and time
- increment receiver unread count

Frontend:
- load history when conversation opens
- append sender bubble after send success

- [ ] **Step 4: Re-run focused tests**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat friends can send text messages and fetch conversation history"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server.js public/nchat/script.js public/nchat/index.html tests/nchat-auth-api.test.js
git commit -m "feat: add Nchat direct messaging"
```

### Task 10: Implement unread clearing when opening a conversation

**Files:**
- Modify: `src/server.js`
- Modify: `tests/nchat-auth-api.test.js`
- Modify: `public/nchat/script.js`

- [ ] **Step 1: Add failing test for unread count clearing**

```js
test('nchat opening a conversation clears the unread badge for that user', async () => {
  const response = await harness.request('POST', `/api/nchat/conversations/${conversationId}/read`, {}, {
    cookies: receiverCookies
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.unreadCount, 0);
});
```

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat opening a conversation clears the unread badge for that user"`  
Expected: FAIL because read endpoint does not exist.

- [ ] **Step 3: Implement minimal read clearing**

Backend:
- add `POST /api/nchat/conversations/:id/read`
- zero out unread count for current user
- update read markers

Frontend:
- call read endpoint when conversation opens
- remove badge immediately from the list row

- [ ] **Step 4: Re-run focused test**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat opening a conversation clears the unread badge for that user"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server.js public/nchat/script.js tests/nchat-auth-api.test.js
git commit -m "feat: clear Nchat unread badges on open"
```

### Task 11: Add SSE realtime updates for incoming messages and unread counts

**Files:**
- Modify: `src/server.js`
- Modify: `tests/nchat-auth-api.test.js`
- Modify: `public/nchat/script.js`

- [ ] **Step 1: Add failing realtime test**

```js
test('nchat receiver event stream gets notified when sender sends a message', async () => {
  const stream = await harness.requestSse('/api/nchat/events', { cookies: receiverCookies });
  await harness.request('POST', `/api/nchat/conversations/${conversationId}/messages`, {
    content: 'ping'
  }, { cookies: senderCookies });

  const event = await stream.nextEvent();
  assert.equal(event.event, 'nchat.message');
});
```

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat receiver event stream gets notified when sender sends a message"`  
Expected: FAIL because SSE endpoint does not exist.

- [ ] **Step 3: Implement SSE**

Backend:
- add `GET /api/nchat/events`
- keep an event stream set keyed by authenticated user ID
- emit:
  - `nchat.message`
  - `nchat.conversation-updated`

Frontend:
- connect EventSource after bootstrap
- update:
  - active conversation messages
  - list ordering
  - latest preview
  - unread badge value

- [ ] **Step 4: Re-run the focused test**

Run: `node --test tests/nchat-auth-api.test.js --test-name-pattern="nchat receiver event stream gets notified when sender sends a message"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server.js public/nchat/script.js tests/nchat-auth-api.test.js
git commit -m "feat: add Nchat realtime events"
```

## Chunk 5: Mobile polish and final verification

### Task 12: Finish mobile-first UI polish for Nexa H5

**Files:**
- Modify: `public/nchat/index.html`
- Modify: `public/nchat/style.css`
- Modify: `public/nchat/script.js`
- Modify: `tests/nchat-page.test.js`

- [ ] **Step 1: Add failing layout and guard assertions**

```js
assert.match(css, /\.nchat-nav\s*\{/);
assert.match(css, /\.nchat-conversation-list\s*\{/);
assert.match(css, /\.nchat-unread-badge\s*\{/);
assert.match(js, /请在 Nexa App 内打开 Nchat/);
```

- [ ] **Step 2: Run page tests**

Run: `node --test tests/nchat-page.test.js`  
Expected: FAIL until the final mobile polish exists.

- [ ] **Step 3: Implement UI polish**

- match the dark mobile style direction the user referenced
- keep layout compact and touch-friendly
- ensure bottom nav is fixed
- ensure conversation view and list feel Telegram-like in unread emphasis
- ensure unsupported PC/browser state blocks chat usage clearly

- [ ] **Step 4: Re-run page tests**

Run: `node --test tests/nchat-page.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/nchat/index.html public/nchat/style.css public/nchat/script.js tests/nchat-page.test.js
git commit -m "feat: polish Nchat mobile UI"
```

### Task 13: Final verification

**Files:**
- Modify: as needed

- [ ] **Step 1: Run script syntax checks**

Run: `node --check public/nchat/script.js`  
Expected: no output

- [ ] **Step 2: Run page tests**

Run: `node --test tests/nchat-page.test.js`  
Expected: PASS

- [ ] **Step 3: Run Nchat API tests**

Run: `node --test tests/nchat-auth-api.test.js`  
Expected: PASS

- [ ] **Step 4: Run adjacent regression coverage**

Run: `node --test tests/nexa-config-security.test.js tests/games-page-layout.test.js`  
Expected: PASS

- [ ] **Step 5: Commit final verification if any fixes were needed**

```bash
git add public/nchat/index.html public/nchat/style.css public/nchat/script.js src/server.js src/db.js tests/nchat-page.test.js tests/nchat-auth-api.test.js tests/games-page-layout.test.js
git commit -m "feat: ship Nchat first version"
```
