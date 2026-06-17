const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const EventEmitter = require('node:events');

const dbModulePath = path.join(__dirname, '..', 'src', 'db.js');
const serverModulePath = path.join(__dirname, '..', 'src', 'server.js');

function createHarness() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claw800-ai-music-api-'));
  const dbPath = path.join(tmpDir, 'claw800.db');
  const previousDbPath = process.env.CLAW800_DB_PATH;
  const previousPackageAmount = process.env.AI_MUSIC_PACKAGE_AMOUNT;
  const previousPackageCredits = process.env.AI_MUSIC_PACKAGE_CREDITS;
  const previousHhApiKey = process.env.HH_API_KEY;
  const previousFetch = global.fetch;

  process.env.CLAW800_DB_PATH = dbPath;
  process.env.AI_MUSIC_PACKAGE_AMOUNT = '1.00';
  process.env.AI_MUSIC_PACKAGE_CREDITS = '3';

  delete require.cache[require.resolve(dbModulePath)];
  delete require.cache[require.resolve(serverModulePath)];

  const db = require(dbModulePath);
  const app = require(serverModulePath);

  return {
    db,
    setFetch(fn) {
      global.fetch = fn;
    },
    setHhApiKey(value) {
      if (value === undefined) delete process.env.HH_API_KEY;
      else process.env.HH_API_KEY = value;
    },
    async request(method, routePath, body, options = {}) {
      return new Promise((resolve, reject) => {
        const req = new EventEmitter();
        req.method = method;
        req.url = routePath;
        req.originalUrl = routePath;
        req.headers = { ...(options.headers || {}) };
        req.connection = {};
        req.socket = {};
        req.body = body;
        req.query = {};
        req.cookies = { ...(options.cookies || {}) };

        const [pathname, queryString = ''] = routePath.split('?');
        req.path = pathname;
        const params = new URLSearchParams(queryString);
        for (const [key, value] of params.entries()) {
          req.query[key] = value;
        }

        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = {};
        res.locals = {};
        res.setHeader = function setHeader(name, value) {
          this.headers[String(name).toLowerCase()] = value;
        };
        res.getHeader = function getHeader(name) {
          return this.headers[String(name).toLowerCase()];
        };
        res.status = function status(code) {
          this.statusCode = code;
          return this;
        };
        res.cookie = function cookie(name, value, opts = {}) {
          const serialized = JSON.stringify({ name, value, opts });
          const current = this.headers['set-cookie'];
          if (!current) this.headers['set-cookie'] = [serialized];
          else current.push(serialized);
          return this;
        };
        res.clearCookie = function clearCookie(name, opts = {}) {
          return this.cookie(name, '', { ...opts, expires: new Date(0), maxAge: 0 });
        };
        res.json = function json(payload) {
          resolve({ statusCode: this.statusCode, body: payload, headers: this.headers });
          return this;
        };
        res.send = function send(payload) {
          resolve({ statusCode: this.statusCode, body: payload, headers: this.headers });
          return this;
        };
        res.end = function end(payload) {
          resolve({ statusCode: this.statusCode, body: payload, headers: this.headers });
        };

        app.handle(req, res, reject);
        req.emit('end');
      });
    },
    cleanup() {
      db.close();
      global.fetch = previousFetch;
      delete require.cache[require.resolve(serverModulePath)];
      delete require.cache[require.resolve(dbModulePath)];
      if (previousDbPath === undefined) delete process.env.CLAW800_DB_PATH;
      else process.env.CLAW800_DB_PATH = previousDbPath;
      if (previousPackageAmount === undefined) delete process.env.AI_MUSIC_PACKAGE_AMOUNT;
      else process.env.AI_MUSIC_PACKAGE_AMOUNT = previousPackageAmount;
      if (previousPackageCredits === undefined) delete process.env.AI_MUSIC_PACKAGE_CREDITS;
      else process.env.AI_MUSIC_PACKAGE_CREDITS = previousPackageCredits;
      if (previousHhApiKey === undefined) delete process.env.HH_API_KEY;
      else process.env.HH_API_KEY = previousHhApiKey;
    }
  };
}

function extractCookie(syncResponse) {
  const serialized = JSON.parse(syncResponse.headers['set-cookie'][0]);
  return { [serialized.name]: serialized.value };
}

async function createAiMusicSession(harness, openId = 'ai-music-open-id-1') {
  const response = await harness.request('POST', '/api/ai-music/session', {
    openId,
    sessionKey: `${openId}-session-key`,
    nickname: 'AI Music User',
    avatar: '/avatar.png'
  });
  return {
    response,
    cookies: extractCookie(response)
  };
}

test('ai music schema is created for fresh databases', () => {
  const harness = createHarness();
  try {
    const tableNames = harness.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'ai_music_%' ORDER BY name")
      .all()
      .map((row) => row.name);

    assert.deepEqual(tableNames, [
      'ai_music_credit_accounts',
      'ai_music_credit_ledger',
      'ai_music_generations',
      'ai_music_orders',
      'ai_music_songs',
      'ai_music_users'
    ]);
  } finally {
    harness.cleanup();
  }
});

test('ai music session creates user and zero-credit account', async () => {
  const harness = createHarness();
  try {
    const response = await harness.request('POST', '/api/ai-music/session', {
      openId: 'ai-music-open-id-session',
      sessionKey: 'ai-music-session-key',
      nickname: 'Composer',
      avatar: '/composer.png'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.session.openId, 'ai-music-open-id-session');
    assert.equal(response.body.credits.availableCredits, 0);
    assert.deepEqual(response.body.package, { amount: '1.00', currency: 'USDT', credits: 3 });
    assert.match(response.headers['set-cookie'][0], /"name":"ai_music_session"/);

    const user = harness.db.prepare('SELECT * FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-session');
    assert.equal(user.nickname, 'Composer');
    const account = harness.db.prepare('SELECT * FROM ai_music_credit_accounts WHERE user_id = ?').get(user.id);
    assert.equal(account.available_credits, 0);
  } finally {
    harness.cleanup();
  }
});

test('ai music credits endpoint requires session and returns balance', async () => {
  const harness = createHarness();
  try {
    const unauthorized = await harness.request('GET', '/api/ai-music/credits');
    assert.equal(unauthorized.statusCode, 401);

    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-credits');
    const credits = await harness.request('GET', '/api/ai-music/credits', null, { cookies });

    assert.equal(credits.statusCode, 200);
    assert.equal(credits.body.ok, true);
    assert.equal(credits.body.credits.availableCredits, 0);
    assert.deepEqual(credits.body.package, { amount: '1.00', currency: 'USDT', credits: 3 });
  } finally {
    harness.cleanup();
  }
});

test('ai music credit order requires session', async () => {
  const harness = createHarness();
  try {
    const response = await harness.request('POST', '/api/ai-music/credits/order', {});

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.ok, false);
  } finally {
    harness.cleanup();
  }
});

test('ai music paid credit order grants three credits exactly once', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-order');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-order');
    harness.db.prepare(`
      INSERT INTO ai_music_orders (user_id, order_no, nexa_order_id, amount, currency, credits, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, 'ai_music_test_order_once', 'nexa-paid-1', '1.00', 'USDT', 3, 'paid');

    const first = await harness.request('GET', '/api/ai-music/credits/order/ai_music_test_order_once', null, { cookies });
    const second = await harness.request('GET', '/api/ai-music/credits/order/ai_music_test_order_once', null, { cookies });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(first.body.credits.availableCredits, 3);
    assert.equal(second.body.credits.availableCredits, 3);

    const account = harness.db.prepare('SELECT * FROM ai_music_credit_accounts WHERE user_id = ?').get(user.id);
    assert.equal(account.available_credits, 3);
    assert.equal(account.total_purchased_credits, 3);
    const ledgerRows = harness.db.prepare('SELECT COUNT(*) AS count FROM ai_music_credit_ledger WHERE reference_id = ?').get('ai_music_test_order_once');
    assert.equal(ledgerRows.count, 1);
  } finally {
    harness.cleanup();
  }
});

test('ai music proxy returns 503 when server api key is missing', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-no-key');
    harness.setHhApiKey(undefined);

    const response = await harness.request('GET', '/api/ai-music/music/credits', null, { cookies });

    assert.equal(response.statusCode, 503);
    assert.equal(response.body.ok, false);
  } finally {
    harness.cleanup();
  }
});

test('ai music generation requires available credits before calling upstream', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-no-credits');
    harness.setHhApiKey('hh_test_key');
    let fetchCalled = false;
    harness.setFetch(async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const response = await harness.request('POST', '/api/ai-music/music/generate', { prompt: 'lofi' }, { cookies });

    assert.equal(response.statusCode, 402);
    assert.equal(response.body.ok, false);
    assert.equal(fetchCalled, false);
  } finally {
    harness.cleanup();
  }
});

test('ai music generation deducts one credit after upstream task is created', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-generate');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-generate');
    harness.db.prepare(`
      UPDATE ai_music_credit_accounts
      SET available_credits = 3, total_purchased_credits = 3
      WHERE user_id = ?
    `).run(user.id);
    harness.setHhApiKey('hh_server_secret');
    let capturedRequest = null;
    harness.setFetch(async (url, init = {}) => {
      capturedRequest = { url: String(url), init };
      return new Response(JSON.stringify({ ok: true, task_id: 'upstream-task-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const response = await harness.request('POST', '/api/ai-music/music/generate', { prompt: 'lofi' }, { cookies });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.task_id, 'upstream-task-1');
    assert.equal(response.body.credits.availableCredits, 2);
    assert.equal(capturedRequest.init.headers.Authorization, 'Bearer hh_server_secret');
    assert.match(capturedRequest.url, /\/ai6api\/music\/generate$/);
    const generation = harness.db.prepare('SELECT * FROM ai_music_generations WHERE upstream_task_id = ?').get('upstream-task-1');
    assert.equal(generation.user_id, user.id);
    const ledgerRows = harness.db.prepare("SELECT COUNT(*) AS count FROM ai_music_credit_ledger WHERE type = 'generation_debit'").get();
    assert.equal(ledgerRows.count, 1);
  } finally {
    harness.cleanup();
  }
});

test('ai music generation does not deduct credits when upstream rejects request', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-upstream-fail');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-upstream-fail');
    harness.db.prepare(`
      UPDATE ai_music_credit_accounts
      SET available_credits = 3, total_purchased_credits = 3
      WHERE user_id = ?
    `).run(user.id);
    harness.setHhApiKey('hh_server_secret');
    harness.setFetch(async () => new Response(JSON.stringify({ error: 'bad prompt' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    }));

    const response = await harness.request('POST', '/api/ai-music/music/generate', { prompt: '' }, { cookies });

    assert.equal(response.statusCode, 400);
    const account = harness.db.prepare('SELECT * FROM ai_music_credit_accounts WHERE user_id = ?').get(user.id);
    assert.equal(account.available_credits, 3);
    const ledgerRows = harness.db.prepare("SELECT COUNT(*) AS count FROM ai_music_credit_ledger WHERE type = 'generation_debit'").get();
    assert.equal(ledgerRows.count, 0);
  } finally {
    harness.cleanup();
  }
});
