const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const EventEmitter = require('node:events');
const crypto = require('node:crypto');

const dbModulePath = path.join(__dirname, '..', 'src', 'db.js');
const serverModulePath = path.join(__dirname, '..', 'src', 'server.js');

function createHarness() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claw800-ai-music-api-'));
  const dbPath = path.join(tmpDir, 'claw800.db');
  const previousDbPath = process.env.CLAW800_DB_PATH;
  const previousHhApiKey = process.env.HH_API_KEY;
  const previousFetch = global.fetch;

  process.env.CLAW800_DB_PATH = dbPath;

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
        const chunks = [];
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
        res.write = function write(payload) {
          if (payload !== undefined) {
            chunks.push(Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload)));
          }
          return true;
        };
        res.end = function end(payload) {
          if (payload !== undefined) {
            chunks.push(Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload)));
          }
          const resolvedBody = chunks.length ? Buffer.concat(chunks) : payload;
          resolve({ statusCode: this.statusCode, body: resolvedBody, headers: this.headers });
          this.emit('finish');
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
      if (previousHhApiKey === undefined) delete process.env.HH_API_KEY;
      else process.env.HH_API_KEY = previousHhApiKey;
    }
  };
}

function extractCookie(syncResponse) {
  const serialized = JSON.parse(syncResponse.headers['set-cookie'][0]);
  return { [serialized.name]: serialized.value };
}

function adminCookies(password = '123456') {
  return {
    admin_token: crypto.createHash('sha256').update(String(password)).digest('hex')
  };
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
      'ai_music_asset_ledger',
      'ai_music_callback_logs',
      'ai_music_credit_accounts',
      'ai_music_credit_ledger',
      'ai_music_favorites',
      'ai_music_generations',
      'ai_music_market_listings',
      'ai_music_market_orders',
      'ai_music_orders',
      'ai_music_songs',
      'ai_music_users',
      'ai_music_wallets'
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
    assert.equal(response.body.profileRequired, true);
    assert.equal(response.body.user.nickname, '');
    assert.equal(response.body.credits.availableCredits, 0);
    assert.deepEqual(response.body.package, { tier: '1u', amount: '1.00', currency: 'USDT', credits: 2 });
    assert.deepEqual(response.body.packages, [
      { tier: '1u', amount: '1.00', currency: 'USDT', credits: 2 },
      { tier: '10u', amount: '10.00', currency: 'USDT', credits: 25 },
      { tier: '100u', amount: '100.00', currency: 'USDT', credits: 300 }
    ]);
    assert.match(response.headers['set-cookie'][0], /"name":"ai_music_session"/);

    const user = harness.db.prepare('SELECT * FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-session');
    assert.equal(user.nickname, '');
    const account = harness.db.prepare('SELECT * FROM ai_music_credit_accounts WHERE user_id = ?').get(user.id);
    assert.equal(account.available_credits, 0);
  } finally {
    harness.cleanup();
  }
});

test('ai music profile save is required after login and stores author nickname', async () => {
  const harness = createHarness();
  try {
    const { response, cookies } = await createAiMusicSession(harness, 'ai-music-open-id-profile');
    assert.equal(response.body.profileRequired, true);
    assert.equal(response.body.user.nickname, '');

    const empty = await harness.request('POST', '/api/ai-music/profile', { nickname: '   ' }, { cookies });
    assert.equal(empty.statusCode, 400);

    const saved = await harness.request('POST', '/api/ai-music/profile', { nickname: '行李箱作者' }, { cookies });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.body.ok, true);
    assert.equal(saved.body.profileRequired, false);
    assert.equal(saved.body.user.nickname, '行李箱作者');

    const bootstrap = await harness.request('GET', '/api/ai-music/session', null, { cookies });
    assert.equal(bootstrap.body.profileRequired, false);
    assert.equal(bootstrap.body.user.nickname, '行李箱作者');
  } finally {
    harness.cleanup();
  }
});

test('ai music legacy placeholder nicknames still require profile setup', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-legacy-profile');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-legacy-profile');
    harness.db.prepare('UPDATE ai_music_users SET nickname = ? WHERE id = ?').run('AI Music User', user.id);

    const bootstrap = await harness.request('GET', '/api/ai-music/session', null, { cookies });
    assert.equal(bootstrap.statusCode, 200);
    assert.equal(bootstrap.body.profileRequired, true);
    assert.equal(bootstrap.body.user.nickname, 'AI Music User');
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
    assert.deepEqual(credits.body.package, { tier: '1u', amount: '1.00', currency: 'USDT', credits: 2 });
    assert.equal(credits.body.packages.length, 3);
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

test('ai music credit order returns Nexa payment launch fields', async () => {
  const harness = createHarness();
  try {
    const config = await harness.request('PUT', '/api/admin/site-config', {
      title: 'claw800.com',
      nexaApiBaseUrl: 'https://merchantapi.nexaexworth.com',
      nexaApiKey: 'ai-music-test-nexa-key',
      nexaAppSecret: 'ai-music-test-nexa-secret'
    }, { cookies: adminCookies() });
    assert.equal(config.statusCode, 200);

    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-pay');
    let capturedRequest = null;
    harness.setFetch(async (_url, init = {}) => {
      capturedRequest = JSON.parse(String(init.body || '{}'));
      return new Response(JSON.stringify({
        code: 0,
        data: {
          orderNo: 'nexa-ai-music-legacy-order',
          paySign: 'signed-ai-music-order',
          signType: 'MD5',
          nonce: 'ai-music-nonce',
          timestamp: '1781707457848'
        }
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const response = await harness.request('POST', '/api/ai-music/credits/order', { tier: '10u' }, { cookies });

    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    assert.equal(response.body.ok, true);
    assert.equal(response.body.order.status, 'pending');
    assert.equal(response.body.order.amount, '10.00');
    assert.equal(response.body.order.credits, 25);
    assert.deepEqual(response.body.package, { tier: '10u', amount: '10.00', currency: 'USDT', credits: 25 });
    assert.equal(response.body.payment.orderNo, response.body.order.orderNo);
    assert.equal(response.body.order.orderNo, 'nexa-ai-music-legacy-order');
    assert.equal(response.body.payment.paySign, 'signed-ai-music-order');
    assert.equal(response.body.payment.signType, 'MD5');
    assert.equal(response.body.payment.nonce, 'ai-music-nonce');
    assert.equal(response.body.payment.timestamp, '1781707457848');
    assert.equal(response.body.payment.apiKey, 'ai-music-test-nexa-key');
    assert.equal(capturedRequest.amount, '10.00');
    assert.equal(capturedRequest.body, 'AI 音乐 25 次生成');
    assert.equal(capturedRequest.openid, 'ai-music-open-id-pay');
    assert.equal('orderNo' in capturedRequest, false);
    assert.equal('callbackUrl' in capturedRequest, false);
    assert.equal(capturedRequest.returnUrl.endsWith('/ai-music/'), true);
    assert.equal(capturedRequest.notifyUrl.endsWith('/api/ai-music/credits/notify'), true);
  } finally {
    harness.cleanup();
  }
});

test('ai music credit order rejects unknown package tiers', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-bad-tier');
    const response = await harness.request('POST', '/api/ai-music/credits/order', { tier: '3u' }, { cookies });

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.ok, false);
    assert.match(response.body.error, /套餐/);
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

test('admin site config stores ai music api settings without echoing the key', async () => {
  const harness = createHarness();
  try {
    const cookies = adminCookies();
    const update = await harness.request('PUT', '/api/admin/site-config', {
      title: 'claw800.com',
      aiMusicApiBaseUrl: 'https://ai6666.com/',
      aiMusicApiKey: 'hh_admin_saved_key'
    }, { cookies });

    assert.equal(update.statusCode, 200);
    assert.equal(update.body.ok, true);

    const config = await harness.request('GET', '/api/admin/site-config', null, { cookies });
    assert.equal(config.statusCode, 200);
    assert.equal(config.body.aiMusicApiBaseUrl, 'https://ai6666.com');
    assert.equal(config.body.aiMusicApiKey, '');
    assert.equal(config.body.hasAiMusicApiKey, true);

    const keepUpdate = await harness.request('PUT', '/api/admin/site-config', {
      ...config.body,
      title: 'claw800.com',
      aiMusicApiKey: '••••••••已保存'
    }, { cookies });
    assert.equal(keepUpdate.statusCode, 200);

    const { cookies: musicCookies } = await createAiMusicSession(harness, 'ai-music-open-id-admin-key');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-admin-key');
    harness.db.prepare(`
      UPDATE ai_music_credit_accounts
      SET available_credits = 1, total_purchased_credits = 1
      WHERE user_id = ?
    `).run(user.id);
    let capturedAuth = '';
    harness.setFetch(async (_url, init = {}) => {
      capturedAuth = String(init.headers?.Authorization || '');
      return new Response(JSON.stringify({ generation_id: 'admin-key-task' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const generate = await harness.request('POST', '/api/ai-music/music/generate', { prompt: 'piano' }, { cookies: musicCookies });
    assert.equal(generate.statusCode, 200);
    assert.equal(capturedAuth, 'Bearer hh_admin_saved_key');
  } finally {
    harness.cleanup();
  }
});

test('ai music config rejects saved key masks before building upstream headers', async () => {
  const harness = createHarness();
  try {
    harness.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('ai_music_api_key', ?)").run('••••••••AI 音乐 Key 已保存');
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-mask-key');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-mask-key');
    harness.db.prepare(`
      UPDATE ai_music_credit_accounts
      SET available_credits = 1, total_purchased_credits = 1
      WHERE user_id = ?
    `).run(user.id);
    let fetchCalled = false;
    harness.setFetch(async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ generation_id: 'should-not-call' }), { status: 200 });
    });

    const generate = await harness.request('POST', '/api/ai-music/music/generate', { prompt: 'piano' }, { cookies });

    assert.equal(generate.statusCode, 503);
    assert.equal(fetchCalled, false);
    assert.match(generate.body.error, /AI 音乐 API Key/);
  } finally {
    harness.cleanup();
  }
});

test('ai music payment notify marks paid, grants credits, and writes callback logs', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-notify');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-notify');
    harness.db.prepare(`
      INSERT INTO ai_music_orders (user_id, order_no, nexa_order_id, amount, currency, credits, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, 'ai_music_notify_order', '', '1.00', 'USDT', 3, 'pending');

    const notify = await harness.request('POST', '/api/ai-music/credits/notify', {
      orderNo: 'ai_music_notify_order',
      status: 'SUCCESS',
      orderId: 'nexa-order-paid',
      paidTime: '2026-06-17 10:00:00'
    });

    assert.equal(notify.statusCode, 200);
    assert.deepEqual(notify.body, { code: '0', msg: 'success' });

    const credits = await harness.request('GET', '/api/ai-music/credits/order/ai_music_notify_order', null, { cookies });
    assert.equal(credits.body.order.status, 'paid');
    assert.equal(credits.body.credits.availableCredits, 3);
    const log = harness.db.prepare('SELECT * FROM ai_music_callback_logs WHERE order_no = ?').get('ai_music_notify_order');
    assert.equal(log.success, 1);
    assert.match(log.body_json, /nexa-order-paid/);
  } finally {
    harness.cleanup();
  }
});

test('admin can list ai music recharge orders, market orders, withdrawals, and callback logs', async () => {
  const harness = createHarness();
  try {
    const cookies = adminCookies();
    const { cookies: musicCookies } = await createAiMusicSession(harness, 'ai-music-open-id-admin-list');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-admin-list');
    harness.db.prepare(`
      INSERT INTO ai_music_orders (user_id, order_no, nexa_order_id, amount, currency, credits, status, notify_payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, 'ai_music_admin_order', 'nexa-admin-order', '1.00', 'USDT', 3, 'paid', JSON.stringify({ status: 'SUCCESS' }));
    await harness.request('POST', '/api/ai-music/credits/notify', {
      orderNo: 'ai_music_admin_order',
      status: 'SUCCESS'
    }, { cookies: musicCookies });

    const orders = await harness.request('GET', '/api/admin/ai-music-orders', null, { cookies });
    assert.equal(orders.statusCode, 200);
    assert.equal(orders.body.ok, true);
    assert.equal(orders.body.items[0].orderNo, 'ai_music_admin_order');
    assert.equal(orders.body.items[0].openId, 'ai-music-open-id-admin-list');

    const rechargeOrders = await harness.request('GET', '/api/admin/ai-music-recharge-orders', null, { cookies });
    assert.equal(rechargeOrders.statusCode, 200);
    assert.equal(rechargeOrders.body.ok, true);
    assert.equal(rechargeOrders.body.items[0].orderNo, 'ai_music_admin_order');

    const { cookies: buyerCookies } = await createAiMusicSession(harness, 'ai-music-open-id-admin-market-buyer');
    assert.ok(buyerCookies);
    const buyer = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-admin-market-buyer');
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(user.id, 'admin-market-song', '后台市场歌曲', 'complete', '/cover.jpg', '/audio.mp3');
    const listing = harness.db.prepare(`
      INSERT INTO ai_music_market_listings (upstream_song_id, seller_user_id, price, currency, status)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin-market-song', user.id, '8.00', 'USDT', 'active');
    harness.db.prepare(`
      INSERT INTO ai_music_market_orders (order_no, listing_id, upstream_song_id, buyer_user_id, seller_user_id, amount, currency, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('ai_music_admin_market_order', listing.lastInsertRowid, 'admin-market-song', buyer.id, user.id, '8.00', 'USDT', 'paid');
    const marketOrders = await harness.request('GET', '/api/admin/ai-music-market-orders', null, { cookies });
    assert.equal(marketOrders.statusCode, 200);
    assert.equal(marketOrders.body.ok, true);
    assert.equal(marketOrders.body.items[0].orderNo, 'ai_music_admin_market_order');
    assert.equal(marketOrders.body.items[0].title, '后台市场歌曲');
    assert.equal(marketOrders.body.items[0].buyerOpenId, 'ai-music-open-id-admin-market-buyer');

    harness.db.prepare('UPDATE ai_music_wallets SET balance = ? WHERE user_id = ?').run('10.00', user.id);
    const withdrawA = await harness.request('POST', '/api/ai-music/assets/withdraw', { amount: '2.00' }, { cookies: musicCookies });
    const withdrawB = await harness.request('POST', '/api/ai-music/assets/withdraw', { amount: '3.00' }, { cookies: musicCookies });
    assert.equal(withdrawA.statusCode, 200);
    assert.equal(withdrawB.statusCode, 200);
    const withdrawals = await harness.request('GET', '/api/admin/ai-music-withdrawals', null, { cookies });
    assert.equal(withdrawals.statusCode, 200);
    assert.equal(withdrawals.body.ok, true);
    const withdrawalA = withdrawals.body.items.find((item) => item.amount === '2.00');
    const withdrawalB = withdrawals.body.items.find((item) => item.amount === '3.00');
    assert.ok(withdrawalA);
    assert.ok(withdrawalB);
    const approve = await harness.request('POST', `/api/admin/ai-music-withdrawals/${withdrawalA.id}/approve`, { note: 'ok' }, { cookies });
    const reject = await harness.request('POST', `/api/admin/ai-music-withdrawals/${withdrawalB.id}/reject`, { note: 'bad' }, { cookies });
    assert.equal(approve.statusCode, 200);
    assert.equal(approve.body.item.status, 'completed');
    assert.equal(reject.statusCode, 200);
    assert.equal(reject.body.item.status, 'rejected');
    const wallet = harness.db.prepare('SELECT balance FROM ai_music_wallets WHERE user_id = ?').get(user.id);
    assert.equal(wallet.balance, '8.00');

    const logs = await harness.request('GET', '/api/admin/ai-music-callback-logs', null, { cookies });
    assert.equal(logs.statusCode, 200);
    assert.equal(logs.body.ok, true);
    assert.equal(logs.body.items[0].orderNo, 'ai_music_admin_order');
  } finally {
    harness.cleanup();
  }
});

test('games api exposes ai music card with direct route', async () => {
  const harness = createHarness();
  try {
    const response = await harness.request('GET', '/api/games');

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.items[0].slug, 'ai-music');
    const item = response.body.items.find((game) => game.slug === 'ai-music');
    assert.equal(item.name, 'AI 音乐');
    assert.equal(item.route, '/ai-music/');
    assert.equal(item.is_enabled, 1);
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

test('ai music my songs returns authored songs and songs where current user owns copyright', async () => {
  const harness = createHarness();
  try {
    const { cookies: aliceCookies } = await createAiMusicSession(harness, 'ai-music-open-id-alice-songs');
    const { cookies: bobCookies } = await createAiMusicSession(harness, 'ai-music-open-id-bob-songs');
    const alice = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-alice-songs');
    const bob = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-bob-songs');
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(alice.id, 'alice-upstream-song', 'Alice Song', 'complete', 'https://cdn.example/alice.jpg', 'https://cdn.example/alice.mp3');
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(bob.id, 'bob-upstream-song', 'Bob Song', 'complete', 'https://cdn.example/bob.jpg', 'https://cdn.example/bob.mp3');
    let fetchCalled = false;
    harness.setFetch(async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({
        songs: [
          { id: 'upstream-global-song', title: 'Global Upstream Song' }
        ],
        total: 1
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const aliceSongs = await harness.request('GET', '/api/ai-music/music/my-songs', null, { cookies: aliceCookies });

    assert.equal(aliceSongs.statusCode, 200);
    assert.equal(fetchCalled, false);
    assert.equal(aliceSongs.body.total, 1);
    assert.deepEqual(aliceSongs.body.songs.map((song) => song.id), ['alice-upstream-song']);
    assert.deepEqual(aliceSongs.body.songs.map((song) => song.title), ['Alice Song']);

    harness.db.prepare('UPDATE ai_music_songs SET copyright_user_id = ? WHERE upstream_song_id = ?').run(bob.id, 'alice-upstream-song');
    const bobSongs = await harness.request('GET', '/api/ai-music/music/my-songs', null, { cookies: bobCookies });
    const aliceAfterSale = await harness.request('GET', '/api/ai-music/music/my-songs', null, { cookies: aliceCookies });

    assert.equal(bobSongs.statusCode, 200);
    assert.equal(bobSongs.body.songs.some((song) => song.id === 'alice-upstream-song'), true);
    assert.equal(bobSongs.body.songs.find((song) => song.id === 'alice-upstream-song').copyright_user_id, bob.id);
    assert.equal(aliceAfterSale.body.songs.some((song) => song.id === 'alice-upstream-song'), true);
  } finally {
    harness.cleanup();
  }
});

test('ai music market listing appears publicly and paid notify transfers copyright to buyer', async () => {
  const harness = createHarness();
  try {
    const { cookies: sellerCookies } = await createAiMusicSession(harness, 'ai-music-open-id-market-seller');
    const { cookies: buyerCookies } = await createAiMusicSession(harness, 'ai-music-open-id-market-buyer');
    const seller = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-market-seller');
    const buyer = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-market-buyer');
    harness.db.prepare('UPDATE ai_music_users SET nickname = ? WHERE id = ?').run('卖家作者', seller.id);
    harness.db.prepare('UPDATE ai_music_users SET nickname = ? WHERE id = ?').run('买家用户', buyer.id);
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(seller.id, 'market-song-1', 'Market Song', 'complete', '/covers/market.jpg', '/audio/market.mp3');

    const list = await harness.request('POST', '/api/ai-music/music/song/market-song-1/list', { price: '9.5' }, { cookies: sellerCookies });
    const market = await harness.request('GET', '/api/ai-music/market/listings');

    assert.equal(list.statusCode, 200);
    assert.equal(list.body.listing.price, '9.50');
    assert.equal(market.statusCode, 200);
    assert.equal(market.body.listings[0].song.id, 'market-song-1');
    assert.equal(market.body.listings[0].song.author_nickname, '卖家作者');
    assert.equal(market.body.listings[0].song.copyright_nickname, '卖家作者');

    const listingId = market.body.listings[0].id;
    harness.db.prepare(`
      INSERT INTO ai_music_market_orders (order_no, listing_id, upstream_song_id, buyer_user_id, seller_user_id, amount, currency, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('ai_music_market_test_order', listingId, 'market-song-1', buyer.id, seller.id, '9.50', 'USDT', 'pending');

    const notify = await harness.request('POST', '/api/ai-music/market/notify', {
      orderNo: 'ai_music_market_test_order',
      status: 'SUCCESS',
      tradeNo: 'nexa-market-paid'
    });
    const buyerSongs = await harness.request('GET', '/api/ai-music/music/my-songs', null, { cookies: buyerCookies });
    const sellerSongs = await harness.request('GET', '/api/ai-music/music/my-songs', null, { cookies: sellerCookies });
    const sellerAssets = await harness.request('GET', '/api/ai-music/assets', null, { cookies: sellerCookies });
    const overWithdraw = await harness.request('POST', '/api/ai-music/assets/withdraw', { amount: '10.00' }, { cookies: sellerCookies });
    const withdraw = await harness.request('POST', '/api/ai-music/assets/withdraw', { amount: '2.50' }, { cookies: sellerCookies });
    const row = harness.db.prepare('SELECT copyright_user_id FROM ai_music_songs WHERE upstream_song_id = ?').get('market-song-1');

    assert.equal(notify.statusCode, 200);
    assert.equal(row.copyright_user_id, buyer.id);
    assert.equal(buyerSongs.body.songs.some((song) => song.id === 'market-song-1'), true);
    assert.equal(sellerSongs.body.songs.some((song) => song.id === 'market-song-1'), true);
    assert.equal(buyerSongs.body.songs.find((song) => song.id === 'market-song-1').copyright_nickname, '买家用户');
    assert.equal(sellerAssets.statusCode, 200);
    assert.equal(sellerAssets.body.assets.balance, '9.50');
    assert.equal(sellerAssets.body.assets.entries[0].type, 'sale_income');
    assert.equal(overWithdraw.statusCode, 400);
    assert.equal(overWithdraw.body.error, '提现金额不能大于余额');
    assert.equal(withdraw.statusCode, 200);
    assert.equal(withdraw.body.assets.balance, '7.00');
    assert.equal(withdraw.body.assets.entries[0].type, 'withdraw_pending');
    assert.match(withdraw.body.message, /T\+1 到账/);
  } finally {
    harness.cleanup();
  }
});

test('ai music song rename updates the local library title immediately', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-rename-local');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-rename-local');
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(user.id, 'rename-local-song', 'Old Song Name', 'complete', '/covers/rename.jpg', '/audio/rename.mp3');

    const renamed = await harness.request('POST', '/api/ai-music/music/song/rename-local-song/rename', {
      title: 'New Song Name'
    }, { cookies });
    const songs = await harness.request('GET', '/api/ai-music/music/my-songs', null, { cookies });
    const row = harness.db.prepare('SELECT title FROM ai_music_songs WHERE upstream_song_id = ?').get('rename-local-song');

    assert.equal(renamed.statusCode, 200);
    assert.equal(renamed.body.title, 'New Song Name');
    assert.equal(row.title, 'New Song Name');
    assert.equal(songs.body.songs[0].title, 'New Song Name');
  } finally {
    harness.cleanup();
  }
});

test('ai music local favorites show up in my music favorites tab', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-favorite-local');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-favorite-local');
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(user.id, 'favorite-local-song', 'Favorite Song', 'complete', '/covers/fav.jpg', '/audio/fav.mp3');

    const favorite = await harness.request('POST', '/api/ai-music/music/song/favorite-local-song/favorite', {}, { cookies });
    const favorites = await harness.request('GET', '/api/ai-music/music/my-songs?tab=favorites', null, { cookies });
    const unfavorite = await harness.request('POST', '/api/ai-music/music/song/favorite-local-song/favorite', {}, { cookies });
    const empty = await harness.request('GET', '/api/ai-music/music/my-songs?tab=favorites', null, { cookies });

    assert.equal(favorite.statusCode, 200);
    assert.equal(favorite.body.user_favorited, true);
    assert.equal(favorites.statusCode, 200);
    assert.equal(favorites.body.total, 1);
    assert.equal(favorites.body.songs[0].id, 'favorite-local-song');
    assert.equal(favorites.body.songs[0].user_favorited, true);
    assert.equal(unfavorite.body.user_favorited, false);
    assert.equal(empty.body.total, 0);
  } finally {
    harness.cleanup();
  }
});

test('ai music public square can favorite songs for logged in users', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-square-favorite');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-square-favorite');
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(user.id, 'square-favorite-song', 'Square Favorite Song', 'complete', '/covers/square-fav.jpg', '/audio/square-fav.mp3');

    const favorite = await harness.request('POST', '/api/ai-music/public/songs/square-favorite-song/favorite', {}, { cookies });
    const square = await harness.request('GET', '/api/ai-music/public/songs', null, { cookies });
    const favorites = await harness.request('GET', '/api/ai-music/music/my-songs?tab=favorites', null, { cookies });

    assert.equal(favorite.statusCode, 200);
    assert.equal(favorite.body.user_favorited, true);
    assert.equal(square.body.songs[0].user_favorited, true);
    assert.equal(favorites.body.songs[0].id, 'square-favorite-song');
  } finally {
    harness.cleanup();
  }
});

test('ai music my songs refreshes missing media from upstream song detail', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-missing-media');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-missing-media');
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(user.id, 'missing-media-song', 'Missing Media Song', 'complete', '', '');
    harness.setHhApiKey('hh_server_secret');
    let fetchedUrl = '';
    harness.setFetch(async (url, init = {}) => {
      fetchedUrl = String(url);
      assert.equal(String(init.headers?.Authorization || ''), 'Bearer hh_server_secret');
      return new Response(JSON.stringify({
        data: {
          id: 'missing-media-song',
          songTitle: 'Recovered Song',
          coverImageUrl: '/covers/recovered.jpg',
          streamUrl: '/audio/recovered.mp3'
        }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const songs = await harness.request('GET', '/api/ai-music/music/my-songs', null, { cookies });
    const row = harness.db.prepare('SELECT title, cover_url, audio_url FROM ai_music_songs WHERE upstream_song_id = ?').get('missing-media-song');

    assert.equal(songs.statusCode, 200);
    assert.equal(fetchedUrl.endsWith('/ai6api/music/song/missing-media-song'), true);
    assert.equal(songs.body.songs[0].title, 'Recovered Song');
    assert.equal(songs.body.songs[0].image_url, '/covers/recovered.jpg');
    assert.equal(songs.body.songs[0].playable_url, '/audio/recovered.mp3');
    assert.equal(row.cover_url, '/covers/recovered.jpg');
    assert.equal(row.audio_url, '/audio/recovered.mp3');
  } finally {
    harness.cleanup();
  }
});

test('ai music my songs replaces temporary signed media urls with stable song endpoints', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-signed-media');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-signed-media');
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      'signed-media-song',
      'Signed Media Song',
      'complete',
      'https://hh-wav-1329438625.cos.ap-chengdu.myqcloud.com/music/cover/signed-media-song.jpg?q-sign-time=1%3B2&q-signature=old',
      'https://hh-wav-1329438625.cos.ap-chengdu.myqcloud.com/music/mp3/signed-media-song.mp3?q-sign-time=1%3B2&q-signature=old'
    );
    harness.setHhApiKey('hh_server_secret');
    harness.setFetch(async () => new Response(JSON.stringify({
      data: {
        id: 'signed-media-song',
        title: 'Signed Media Song',
        cover_url: 'https://hh-wav-1329438625.cos.ap-chengdu.myqcloud.com/music/cover/signed-media-song.jpg?q-sign-time=3%3B4&q-signature=new',
        playable_url: 'https://hh-wav-1329438625.cos.ap-chengdu.myqcloud.com/music/mp3/signed-media-song.mp3?q-sign-time=3%3B4&q-signature=new'
      }
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const songs = await harness.request('GET', '/api/ai-music/music/my-songs', null, { cookies });
    const row = harness.db.prepare('SELECT cover_url, audio_url FROM ai_music_songs WHERE upstream_song_id = ?').get('signed-media-song');

    assert.equal(songs.statusCode, 200);
    assert.equal(songs.body.songs[0].image_url, '/music/song/signed-media-song/cover/');
    assert.equal(songs.body.songs[0].playable_url, '/music/song/signed-media-song/audio/');
    assert.equal(row.cover_url, '/music/song/signed-media-song/cover/');
    assert.equal(row.audio_url, '/music/song/signed-media-song/audio/');
  } finally {
    harness.cleanup();
  }
});

test('ai music generation status stores returned songs for the current user library', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-library-sync');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-library-sync');
    harness.db.prepare(`
      INSERT INTO ai_music_generations (user_id, upstream_task_id, request_payload_json, status, credits_charged)
      VALUES (?, ?, '{}', 'submitted', 1)
    `).run(user.id, 'library-task-1');
    harness.setHhApiKey('hh_server_secret');
    harness.setFetch(async () => new Response(JSON.stringify({
      status: 'success',
      songs: [
        {
          id: 'library-song-1',
          title: 'Library Song',
          image_url: 'https://cdn.example/library.jpg',
          playable_url: 'https://cdn.example/library.mp3'
        }
      ]
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const status = await harness.request('GET', '/api/ai-music/music/generation/library-task-1/status', null, { cookies });
    const songs = await harness.request('GET', '/api/ai-music/music/my-songs', null, { cookies });

    assert.equal(status.statusCode, 200);
    assert.equal(songs.statusCode, 200);
    assert.equal(songs.body.total, 1);
    assert.equal(songs.body.songs[0].id, 'library-song-1');
    assert.equal(songs.body.songs[0].title, 'Library Song');
    assert.equal(songs.body.songs[0].playable_url, 'https://cdn.example/library.mp3');
  } finally {
    harness.cleanup();
  }
});

test('ai music my songs syncs recent completed generations before listing local library', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-library-auto-sync');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-library-auto-sync');
    harness.db.prepare(`
      INSERT INTO ai_music_generations (user_id, upstream_task_id, request_payload_json, status, credits_charged)
      VALUES (?, ?, '{}', 'submitted', 1)
    `).run(user.id, 'auto-sync-task-1');
    harness.setHhApiKey('hh_server_secret');

    let statusCalls = 0;
    harness.setFetch(async (url) => {
      assert.match(String(url), /\/ai6api\/music\/generation\/auto-sync-task-1\/status$/);
      statusCalls += 1;
      return new Response(JSON.stringify({
        status: 'success',
        songs: [
          {
            id: 'auto-sync-song-1',
            title: 'Auto Sync Song',
            image_url: 'https://cdn.example/auto-sync.jpg',
            playable_url: 'https://cdn.example/auto-sync.mp3'
          }
        ]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const songs = await harness.request('GET', '/api/ai-music/music/my-songs', null, { cookies });

    assert.equal(songs.statusCode, 200);
    assert.equal(statusCalls, 1);
    assert.equal(songs.body.total, 1);
    assert.equal(songs.body.songs[0].id, 'auto-sync-song-1');
    assert.equal(songs.body.songs[0].title, 'Auto Sync Song');
  } finally {
    harness.cleanup();
  }
});

test('ai music public square and song links are playable without login', async () => {
  const harness = createHarness();
  try {
    const { cookies: aliceCookies } = await createAiMusicSession(harness, 'ai-music-open-id-public-alice');
    const { cookies: bobCookies } = await createAiMusicSession(harness, 'ai-music-open-id-public-bob');
    const alice = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-public-alice');
    const bob = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-public-bob');
    assert.ok(aliceCookies);
    assert.ok(bobCookies);
    harness.db.prepare('UPDATE ai_music_users SET nickname = ? WHERE id = ?').run('Alice 作者', alice.id);
    harness.db.prepare('UPDATE ai_music_users SET nickname = ? WHERE id = ?').run('Bob 作者', bob.id);
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(alice.id, 'public-song-a', 'Public Song A', 'complete', '/covers/a.jpg', 'https://ai6666.com/audio/a.mp3');
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(bob.id, 'public-song-b', 'Public Song B', 'complete', 'https://ai6666.com/covers/b.jpg', '/audio/b.mp3');

    const square = await harness.request('GET', '/api/ai-music/public/songs');
    const detail = await harness.request('GET', '/api/ai-music/public/songs/public-song-a');

    assert.equal(square.statusCode, 200);
    assert.equal(square.body.ok, true);
    assert.deepEqual(square.body.songs.map((song) => song.id), ['public-song-b', 'public-song-a']);
    assert.deepEqual(square.body.songs.map((song) => song.author_nickname), ['Bob 作者', 'Alice 作者']);
    assert.equal(square.body.songs[0].share_url, '/ai-music/song/public-song-b');
    assert.equal(square.body.songs[0].play_count, 0);
    assert.equal(square.body.songs[0].audio_url.startsWith('/api/ai-music/public/media?u='), true);
    assert.equal(square.body.songs[0].audio_url, '/api/ai-music/public/media?u=https%3A%2F%2Fai6666.com%2Faudio%2Fb.mp3');
    assert.equal(square.body.songs[1].image_url, '/api/ai-music/public/media?u=https%3A%2F%2Fai6666.com%2Fcovers%2Fa.jpg');
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.body.song.id, 'public-song-a');
    assert.equal(detail.body.song.title, 'Public Song A');
    assert.equal(detail.body.song.author_nickname, 'Alice 作者');
    assert.equal(detail.body.song.play_count, 0);
  } finally {
    harness.cleanup();
  }
});

test('ai music public song play count increments without login', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-public-play-count');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-public-play-count');
    assert.ok(cookies);
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url, play_count)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
    `).run(user.id, 'play-count-song', 'Play Count Song', 'complete', '/covers/count.jpg', '/audio/count.mp3', 4);

    const first = await harness.request('POST', '/api/ai-music/public/songs/play-count-song/play', {});
    const second = await harness.request('POST', '/api/ai-music/public/songs/play-count-song/play', {});
    const detail = await harness.request('GET', '/api/ai-music/public/songs/play-count-song');
    const missing = await harness.request('POST', '/api/ai-music/public/songs/not-found/play', {});

    assert.equal(first.statusCode, 200);
    assert.equal(first.body.play_count, 5);
    assert.equal(second.body.playCount, 6);
    assert.equal(detail.body.song.play_count, 6);
    assert.equal(missing.statusCode, 404);
  } finally {
    harness.cleanup();
  }
});

test('ai music public song lyrics are available without login for stored public songs', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-public-lyrics');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-public-lyrics');
    assert.ok(cookies);
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(user.id, 'public-lyrics-song', 'Public Lyrics Song', 'complete', '/covers/lyrics.jpg', '/audio/lyrics.mp3');
    harness.setHhApiKey('hh_server_secret');
    let fetchedUrl = '';
    harness.setFetch(async (url, init = {}) => {
      fetchedUrl = String(url);
      assert.equal(String(init.headers?.Authorization || ''), 'Bearer hh_server_secret');
      return new Response(JSON.stringify({
        data: {
          result: {
            lines: [
              { startTime: 1000, text: '第一句' },
              { startTime: 2500, text: '第二句' }
            ]
          }
        },
        lyrics: '{"not":"lyrics"}'
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const ok = await harness.request('GET', '/api/ai-music/public/songs/public-lyrics-song/lyrics');
    const missing = await harness.request('GET', '/api/ai-music/public/songs/not-found/lyrics');

    assert.equal(ok.statusCode, 200);
    assert.equal(ok.body.lyrics, '[0:01.00]第一句\n[0:02.50]第二句');
    assert.equal(fetchedUrl, 'https://ai6666.com/ai6api/music/song/public-lyrics-song/lyrics');
    assert.equal(missing.statusCode, 404);
  } finally {
    harness.cleanup();
  }
});

test('ai music public media proxy only serves stored song media without login', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-public-media');
    const user = harness.db.prepare('SELECT id FROM ai_music_users WHERE open_id = ?').get('ai-music-open-id-public-media');
    assert.ok(cookies);
    harness.db.prepare(`
      INSERT INTO ai_music_songs (user_id, generation_id, upstream_song_id, title, status, cover_url, audio_url)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(user.id, 'public-media-song', 'Public Media Song', 'complete', 'https://ai6666.com/covers/media.jpg', 'https://ai6666.com/audio/media.mp3');
    harness.setHhApiKey('hh_server_secret');
    let fetchedUrl = '';
    let fetchedAuth = '';
    harness.setFetch(async (url, init = {}) => {
      fetchedUrl = String(url);
      fetchedAuth = String(init.headers?.Authorization || '');
      assert.equal(String(init.headers?.Range || ''), 'bytes=0-1023');
      assert.equal(String(init.headers?.Referer || ''), 'https://ai6666.com/');
      assert.equal(String(init.headers?.['User-Agent'] || ''), 'claw800-ai-music');
      const response = new Response(Buffer.from('mp3-bytes'), {
        status: 206,
        headers: {
          'content-type': 'audio/mpeg',
          'content-length': '9',
          'content-range': 'bytes 0-8/9',
          'accept-ranges': 'bytes'
        }
      });
      response.arrayBuffer = async () => {
        throw new Error('media proxy should stream instead of buffering full audio');
      };
      return response;
    });

    const ok = await harness.request('GET', '/api/ai-music/public/media?u=' + encodeURIComponent('https://ai6666.com/audio/media.mp3'), null, {
      headers: { range: 'bytes=0-1023' }
    });
    const forbidden = await harness.request('GET', '/api/ai-music/public/media?u=' + encodeURIComponent('https://ai6666.com/audio/not-stored.mp3'));

    assert.equal(ok.statusCode, 206);
    assert.equal(String(ok.body), 'mp3-bytes');
    assert.equal(ok.headers['content-type'], 'audio/mpeg');
    assert.equal(ok.headers['content-range'], 'bytes 0-8/9');
    assert.equal(ok.headers['accept-ranges'], 'bytes');
    assert.equal(fetchedUrl, 'https://ai6666.com/audio/media.mp3');
    assert.equal(fetchedAuth, 'Bearer hh_server_secret');
    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.body.error, 'MEDIA_NOT_PUBLIC');
  } finally {
    harness.cleanup();
  }
});

test('ai music media proxy can force attachment downloads with filename', async () => {
  const harness = createHarness();
  try {
    const { cookies } = await createAiMusicSession(harness, 'ai-music-open-id-media-download');
    harness.setHhApiKey('hh_server_secret');
    harness.setFetch(async () => new Response(Buffer.from('mp3-download'), {
      status: 200,
      headers: {
        'content-type': 'audio/mpeg',
        'content-length': '12'
      }
    }));

    const response = await harness.request(
      'GET',
      '/api/ai-music/media?u=' + encodeURIComponent('https://ai6666.com/audio/download.mp3') + '&download=1&filename=' + encodeURIComponent('我的歌.mp3'),
      null,
      { cookies }
    );

    assert.equal(response.statusCode, 200);
    assert.equal(String(response.body), 'mp3-download');
    assert.match(response.headers['content-disposition'], /attachment/);
    assert.match(response.headers['content-disposition'], /filename\*=UTF-8''/);
    assert.match(response.headers['content-disposition'], /%E6%88%91%E7%9A%84%E6%AD%8C\.mp3/);
  } finally {
    harness.cleanup();
  }
});
