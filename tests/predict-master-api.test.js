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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claw800-predict-master-api-'));
  const dbPath = path.join(tmpDir, 'claw800.db');
  const previousDbPath = process.env.CLAW800_DB_PATH;
  const previousNexaApiKey = process.env.NEXA_API_KEY;
  const previousNexaAppSecret = process.env.NEXA_APP_SECRET;
  const previousFetch = global.fetch;

  process.env.CLAW800_DB_PATH = dbPath;
  process.env.NEXA_API_KEY = process.env.NEXA_API_KEY || 'test-nexa-api-key';
  process.env.NEXA_APP_SECRET = process.env.NEXA_APP_SECRET || 'test-nexa-app-secret';
  delete require.cache[require.resolve(dbModulePath)];
  delete require.cache[require.resolve(serverModulePath)];

  const db = require(dbModulePath);
  const app = require(serverModulePath);

  return {
    db,
    setFetch(fn) {
      global.fetch = fn;
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

        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = {};
        res.locals = {};
        res.setHeader = function setHeader(name, value) {
          this.headers[String(name).toLowerCase()] = value;
        };
        res.status = function status(code) {
          this.statusCode = code;
          return this;
        };
        res.cookie = function cookie(name, value, opts = {}) {
          const serialized = JSON.stringify({ name, value, opts });
          const current = this.headers['set-cookie'];
          if (!current) {
            this.headers['set-cookie'] = [serialized];
          } else {
            current.push(serialized);
          }
          return this;
        };
        res.clearCookie = function clearCookie(name, opts = {}) {
          return this.cookie(name, '', { ...opts, expires: new Date(0), maxAge: 0 });
        };
        res.json = function json(payload) {
          resolve({ statusCode: this.statusCode, body: payload, headers: this.headers });
          return this;
        };
        res.end = function end(payload) {
          resolve({ statusCode: this.statusCode, body: payload, headers: this.headers });
        };
        res.sendFile = function sendFile(filePath) {
          resolve({ statusCode: this.statusCode, filePath, headers: this.headers });
          return this;
        };

        app.handle(req, res, reject);
        req.emit('end');
      });
    },
    async adminCookies() {
      const login = await this.request('POST', '/api/admin/login', { password: '123456' });
      assert.equal(login.statusCode, 200);
      const serialized = JSON.parse(login.headers['set-cookie'][0]);
      return { [serialized.name]: serialized.value };
    },
    cleanup() {
      db.close();
      delete require.cache[require.resolve(serverModulePath)];
      delete require.cache[require.resolve(dbModulePath)];
      global.fetch = previousFetch;
      if (previousDbPath === undefined) {
        delete process.env.CLAW800_DB_PATH;
      } else {
        process.env.CLAW800_DB_PATH = previousDbPath;
      }
      if (previousNexaApiKey === undefined) {
        delete process.env.NEXA_API_KEY;
      } else {
        process.env.NEXA_API_KEY = previousNexaApiKey;
      }
      if (previousNexaAppSecret === undefined) {
        delete process.env.NEXA_APP_SECRET;
      } else {
        process.env.NEXA_APP_SECRET = previousNexaAppSecret;
      }
    }
  };
}

test('predict-master is seeded in the games catalog and routes to its page', async () => {
  const harness = createHarness();

  try {
    const games = await harness.request('GET', '/api/games');
    assert.equal(games.statusCode, 200);
    const expectedRoutes = new Map([
      ['predict-master', ['/predict-master/?type=trading', '预测']],
      ['predict-master-contract', ['/predict-master/?type=contract', '合约']],
      ['predict-master-up-down', ['/predict-master/?type=up-down', '涨跌']],
      ['predict-master-spread', ['/predict-master/?type=spread', '点差']],
      ['predict-master-tap-trading', ['/predict-master/?type=tap-trading', 'Tap Trading']],
      ['predict-master-football-worldcup', ['/predict-master/?type=trading&activity=football-worldcup', '足球/世界杯预测']]
    ]);
    for (const [slug, [route, name]] of expectedRoutes) {
      const item = games.body.items.find((game) => game.slug === slug);
      assert.ok(item, `${slug} is listed`);
      assert.equal(item.name, name);
      assert.equal(item.route, route);
      assert.equal(item.actionText, '进入预测');
      assert.equal(item.icon, 'UPAL');
    }

    const page = await harness.request('GET', '/predict-master/');
    assert.equal(page.statusCode, 200);
    assert.match(page.filePath, /public\/predict-master\/index\.html$/);
  } finally {
    harness.cleanup();
  }
});

test('admin can save predict-master config without private key echo', async () => {
  const harness = createHarness();
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });

  try {
    const cookies = await harness.adminCookies();
    const save = await harness.request(
      'PUT',
      '/api/admin/predict-master-config',
      {
        baseUrl: 'https://detrade.example',
        apiKey: 'predict-api-key',
        privateKey,
        userId: '1727404213474304',
        username: 'Yxxvz',
        avatar: 'https://example.com/avatar.png',
        currency: 'USDT',
        exchangeRate: '1',
        balanceType: '1'
      },
      { cookies }
    );

    assert.equal(save.statusCode, 200);
    assert.equal(save.body.ok, true);
    assert.equal(save.body.hasPrivateKey, true);
    assert.equal(save.body.privateKey, '');

    const config = await harness.request('GET', '/api/admin/predict-master-config', null, { cookies });
    assert.equal(config.statusCode, 200);
    assert.equal(config.body.apiKey, 'predict-api-key');
    assert.equal(config.body.hasPrivateKey, true);
    assert.equal(config.body.privateKey, '');
    assert.equal(config.body.paymentCompatMode, false);

    const keepSave = await harness.request(
      'PUT',
      '/api/admin/predict-master-config',
      {
        ...config.body,
        privateKey: '',
        keepPrivateKey: true
      },
      { cookies }
    );
    assert.equal(keepSave.statusCode, 200);
    const storedPrivateKey = harness.db.prepare(`SELECT value FROM settings WHERE key = 'predict_master_private_key'`).get();
    assert.equal(storedPrivateKey.value, privateKey.trim());
  } finally {
    harness.cleanup();
  }
});

test('admin can enable predict-master Nexa payment compatibility mode', async () => {
  const harness = createHarness();

  try {
    const cookies = await harness.adminCookies();
    const save = await harness.request(
      'PUT',
      '/api/admin/predict-master-config',
      {
        baseUrl: 'https://detrade.example',
        apiKey: 'predict-api-key',
        privateKey: '',
        userId: '1727404213474304',
        username: 'Yxxvz',
        currency: 'USDT',
        exchangeRate: '1',
        paymentCompatMode: true
      },
      { cookies }
    );

    assert.equal(save.statusCode, 200);
    assert.equal(save.body.ok, true);
    assert.equal(save.body.paymentCompatMode, true);

    const storedMode = harness.db.prepare(`SELECT value FROM settings WHERE key = 'predict_master_payment_compat_mode'`).get();
    assert.equal(storedMode.value, '1');

    const config = await harness.request('GET', '/api/admin/predict-master-config', null, { cookies });
    assert.equal(config.body.paymentCompatMode, true);
  } finally {
    harness.cleanup();
  }
});

test('admin accepts bare base64 Detrade private key from test credentials', async () => {
  const harness = createHarness();
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });
  const barePrivateKey = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  try {
    const cookies = await harness.adminCookies();
    const save = await harness.request(
      'PUT',
      '/api/admin/predict-master-config',
      {
        baseUrl: 'https://detrade.example',
        apiKey: 'predict-api-key',
        privateKey: barePrivateKey,
        userId: '1727404213474304',
        username: 'Yxxvz',
        currency: 'USDT',
        exchangeRate: '1'
      },
      { cookies }
    );

    assert.equal(save.statusCode, 200);
    assert.equal(save.body.ok, true);

    const storedPrivateKey = harness.db.prepare(`SELECT value FROM settings WHERE key = 'predict_master_private_key'`).get();
    assert.match(storedPrivateKey.value, /^-----BEGIN PRIVATE KEY-----/);
  } finally {
    harness.cleanup();
  }
});

test('admin can view recent predict-master upstream callback logs', async () => {
  const harness = createHarness();

  try {
    const cookies = await harness.adminCookies();
    harness.db
      .prepare(
        `INSERT INTO detrade_callback_logs (
          request_path, request_method, query_json, body_json, external_user_id, biz_id, source,
          response_code, response_msg, http_status, success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        '/wallet/amount/deduction',
        'POST',
        '{}',
        JSON.stringify({ userId: '1727404213474304', amount: '10' }),
        '1727404213474304',
        'order-1',
        'PLACE_PREDICT_ORDER',
        30002,
        'Balance not enough',
        200,
        0,
        'Balance not enough'
      );

    const response = await harness.request('GET', '/api/admin/predict-master-callback-logs', null, { cookies });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].requestPath, '/wallet/amount/deduction');
    assert.equal(response.body.items[0].externalUserId, '1727404213474304');
    assert.equal(response.body.items[0].responseCode, 30002);
    assert.equal(response.body.items[0].success, false);
    assert.equal(response.body.items[0].errorMessage, 'Balance not enough');
  } finally {
    harness.cleanup();
  }
});

test('admin can view recent predict-master login logs', async () => {
  const harness = createHarness();

  try {
    const cookies = await harness.adminCookies();
    harness.db
      .prepare(
        `INSERT INTO detrade_login_logs (
          external_user_id, session_key_hash, nickname, avatar, request_base_url, request_payload_json,
          response_url, access_code, success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'nexa-open-id-123',
        'hash',
        'Nexa User',
        'https://example.com/avatar.png',
        'https://detrade.example',
        JSON.stringify({ userId: 'nexa-open-id-123' }),
        'https://detrade.example/embed',
        'abc',
        1,
        ''
      );

    const response = await harness.request('GET', '/api/admin/predict-master-login-logs', null, { cookies });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].externalUserId, 'nexa-open-id-123');
    assert.equal(response.body.items[0].nickname, 'Nexa User');
    assert.equal(response.body.items[0].responseUrl, 'https://detrade.example/embed');
    assert.equal(response.body.items[0].accessCode, 'abc');
    assert.equal(response.body.items[0].success, true);
  } finally {
    harness.cleanup();
  }
});

test('admin can view Nexa payment upstream logs after a 405 failure', async () => {
  const harness = createHarness();

  try {
    const cookies = await harness.adminCookies();
    harness.setFetch(async (url) => ({
      ok: false,
      status: 405,
      async text() {
        return JSON.stringify({ message: 'Method Not Allowed', path: String(url) });
      }
    }));

    const create = await harness.request('POST', '/api/predict-master/payment/create', {
      openId: 'nexa-open-id-405',
      sessionKey: 'nexa-session-key-405',
      amount: '10'
    });
    assert.equal(create.statusCode, 405);
    assert.match(create.body.error, /Nexa 请求失败/);

    const logs = await harness.request('GET', '/api/admin/nexa-payment-upstream-logs', null, { cookies });
    assert.equal(logs.statusCode, 200);
    assert.equal(logs.body.ok, true);
    assert.equal(logs.body.items.length, 2);
    assert.equal(logs.body.items[0].endpointPath, '/partner/api/openapi/payment/create');
    assert.equal(logs.body.items[0].requestMethod, 'POST');
    assert.equal(logs.body.items[0].requestUrl, 'https://merchantapi.nexaexworth.com/partner/api/openapi/payment/create');
    assert.equal(logs.body.items[0].httpStatus, 405);
    assert.equal(logs.body.items[0].success, false);
    assert.match(logs.body.items[0].responseText, /Method Not Allowed/);
    assert.doesNotMatch(JSON.stringify(logs.body.items[0]), /nexa-session-key-405/);
  } finally {
    harness.cleanup();
  }
});

test('admin can view stored Nexa payment upstream logs directly', async () => {
  const harness = createHarness();

  try {
    const cookies = await harness.adminCookies();
    harness.db
      .prepare(
        `INSERT INTO nexa_payment_upstream_logs (
          source, request_method, request_url, endpoint_path, request_body_json,
          http_status, success, response_text, response_json, error_message, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'predict-master-payment-create',
        'POST',
        'https://merchantapi.nexaexworth.com/partner/api/openapi/payment/create',
        '/partner/api/openapi/payment/create',
        JSON.stringify({ apiKey: 'test-nexa-api-key', sessionKey: '[redacted]' }),
        405,
        0,
        '{"message":"Method Not Allowed"}',
        JSON.stringify({ message: 'Method Not Allowed' }),
        'Nexa 请求失败：Method Not Allowed',
        123
      );

    const response = await harness.request('GET', '/api/admin/nexa-payment-upstream-logs', null, { cookies });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].source, 'predict-master-payment-create');
    assert.equal(response.body.items[0].httpStatus, 405);
    assert.equal(response.body.items[0].success, false);
    assert.deepEqual(response.body.items[0].response, { message: 'Method Not Allowed' });
    assert.deepEqual(response.body.items[0].requestBody, { apiKey: 'test-nexa-api-key', sessionKey: '[redacted]' });
  } finally {
    harness.cleanup();
  }
});

test('admin can view recent predict-master operational records', async () => {
  const harness = createHarness();

  try {
    const cookies = await harness.adminCookies();
    harness.db
      .prepare(
        `INSERT INTO detrade_order_pushes (
          order_id, external_user_id, currency, amount, profit, biz_type, status, symbol, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'order-1',
        'nexa-open-id-123',
        'USDT',
        10.5,
        1.25,
        'predict',
        'settled',
        'BTCUSDT',
        JSON.stringify({ orderId: 'order-1' })
      );
    const user = harness.db
      .prepare("INSERT INTO game_users (openid, nickname, avatar) VALUES (?, 'Nexa User', '')")
      .run('nexa-open-id-123');
    harness.db
      .prepare(
        `INSERT INTO detrade_wallet_transactions (
          user_id, external_user_id, currency, direction, amount, usd_amount, biz_id, biz_type,
          source, biz_sub_id, balance_type, balance_after, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        user.lastInsertRowid,
        'nexa-open-id-123',
        'USDT',
        'deduction',
        10,
        10,
        'biz-1',
        'predict',
        'PLACE_PREDICT_ORDER',
        'sub-1',
        1,
        90,
        JSON.stringify({ amount: '10' })
      );
    harness.db
      .prepare(
        `INSERT INTO detrade_predict_shares (
          external_user_id, shares_id, shares_qty, order_id, biz_id, biz_sub_id, status, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'nexa-open-id-123',
        'share-1',
        3,
        'order-1',
        'biz-1',
        'sub-1',
        'active',
        JSON.stringify({ sharesId: 'share-1' })
      );
    harness.db
      .prepare(
        `INSERT INTO detrade_risk_reports (
          external_user_id, risk_status, description, raw_json
        ) VALUES (?, ?, ?, ?)`
      )
      .run('nexa-open-id-123', 'warning', 'Risk warning', JSON.stringify({ riskStatus: 'warning' }));

    const orders = await harness.request('GET', '/api/admin/predict-master-orders', null, { cookies });
    const walletTransactions = await harness.request('GET', '/api/admin/predict-master-wallet-transactions', null, {
      cookies
    });
    const shares = await harness.request('GET', '/api/admin/predict-master-shares', null, { cookies });
    const riskReports = await harness.request('GET', '/api/admin/predict-master-risk-reports', null, { cookies });

    assert.equal(orders.statusCode, 200);
    assert.equal(orders.body.ok, true);
    assert.equal(orders.body.items[0].orderId, 'order-1');
    assert.equal(orders.body.items[0].profit, 1.25);
    assert.deepEqual(orders.body.items[0].raw, { orderId: 'order-1' });

    assert.equal(walletTransactions.statusCode, 200);
    assert.equal(walletTransactions.body.ok, true);
    assert.equal(walletTransactions.body.items[0].direction, 'deduction');
    assert.equal(walletTransactions.body.items[0].source, 'PLACE_PREDICT_ORDER');
    assert.equal(walletTransactions.body.items[0].balanceAfter, 90);

    assert.equal(shares.statusCode, 200);
    assert.equal(shares.body.ok, true);
    assert.equal(shares.body.items[0].sharesId, 'share-1');
    assert.equal(shares.body.items[0].sharesQty, 3);

    assert.equal(riskReports.statusCode, 200);
    assert.equal(riskReports.body.ok, true);
    assert.equal(riskReports.body.items[0].riskStatus, 'warning');
    assert.equal(riskReports.body.items[0].description, 'Risk warning');
  } finally {
    harness.cleanup();
  }
});

test('predict-master login url requires Nexa session identity', async () => {
  const harness = createHarness();

  try {
    const response = await harness.request('POST', '/api/predict-master/login-url', {});
    assert.equal(response.statusCode, 401);
    assert.match(response.body.error, /Nexa/);
  } finally {
    harness.cleanup();
  }
});

test('predict-master login url posts signed Detrade login request with Nexa openId', async () => {
  const harness = createHarness();
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });
  let upstreamRequest;

  try {
    const cookies = await harness.adminCookies();
    await harness.request(
      'PUT',
      '/api/admin/predict-master-config',
      {
        baseUrl: 'https://detrade.example/',
        apiKey: 'predict-api-key',
        privateKey,
        userId: '1727404213474304',
        username: 'Yxxvz',
        avatar: 'https://example.com/avatar.png',
        currency: 'USDT',
        exchangeRate: '1',
        balanceType: '1'
      },
      { cookies }
    );

    harness.setFetch(async (url, options) => {
      upstreamRequest = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            code: 0,
            msg: 'ok',
            data: {
              url: 'https://detrade.example/embed?accessCode=abc',
              accessCode: 'abc'
            }
          };
        },
        async text() {
          return JSON.stringify({
            code: 0,
            data: { url: 'https://detrade.example/embed?accessCode=abc', accessCode: 'abc' }
          });
        }
      };
    });

    const response = await harness.request('POST', '/api/predict-master/login-url', {
      openId: 'nexa-open-id-123',
      sessionKey: 'nexa-session-key-123',
      nickname: 'Nexa User',
      avatar: 'https://example.com/nexa-avatar.png'
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.url, 'https://detrade.example/embed?accessCode=abc');

    assert.equal(upstreamRequest.url, 'https://detrade.example/api/tob/third-party/login/apply');
    assert.equal(upstreamRequest.options.method, 'POST');
    assert.equal(upstreamRequest.options.headers.ApiKey, 'predict-api-key');
    assert.match(upstreamRequest.options.headers.sign, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const payload = JSON.parse(upstreamRequest.options.body);
    assert.deepEqual(payload, {
      userId: 'nexa-open-id-123',
      username: 'Nexa User',
      avatar: 'https://example.com/nexa-avatar.png',
      currency: 'USDT',
      exchangeRate: 1,
      balanceType: 1
    });

    const [encodedHeader, encodedPayload, encodedSignature] = upstreamRequest.options.headers.sign.split('.');
    assert.deepEqual(JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')), { alg: 'RS256', typ: 'JWT' });
    assert.deepEqual(JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')), payload);
    const valid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      publicKey,
      Buffer.from(encodedSignature, 'base64url')
    );
    assert.equal(valid, true);

    const log = harness.db
      .prepare(
        `SELECT external_user_id, nickname, request_base_url, response_url, access_code, success, error_message
         FROM detrade_login_logs
         ORDER BY id DESC
         LIMIT 1`
      )
      .get();
    assert.deepEqual(log, {
      external_user_id: 'nexa-open-id-123',
      nickname: 'Nexa User',
      request_base_url: 'https://detrade.example',
      response_url: 'https://detrade.example/embed?accessCode=abc',
      access_code: 'abc',
      success: 1,
      error_message: ''
    });
  } finally {
    harness.cleanup();
  }
});

test('predict-master login logs Detrade apply failures for admin diagnosis', async () => {
  const harness = createHarness();
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });

  try {
    const cookies = await harness.adminCookies();
    await harness.request(
      'PUT',
      '/api/admin/predict-master-config',
      {
        baseUrl: 'https://detrade.example/',
        apiKey: 'predict-api-key',
        privateKey,
        userId: '1727404213474304',
        username: 'Yxxvz',
        currency: 'USDT',
        exchangeRate: '1'
      },
      { cookies }
    );

    harness.setFetch(async () => ({
      ok: true,
      status: 200,
      async json() {
        return { code: 30001, msg: 'Signature invalid', data: {} };
      },
      async text() {
        return JSON.stringify({ code: 30001, msg: 'Signature invalid', data: {} });
      }
    }));

    const response = await harness.request('POST', '/api/predict-master/login-url', {
      openId: 'nexa-open-id-fail',
      sessionKey: 'nexa-session-key-123',
      nickname: 'Fail User'
    });
    assert.equal(response.statusCode, 502);
    assert.equal(response.body.error, 'Signature invalid');

    const log = harness.db
      .prepare(
        `SELECT external_user_id, nickname, response_url, access_code, success, error_message
         FROM detrade_login_logs
         ORDER BY id DESC
         LIMIT 1`
      )
      .get();
    assert.deepEqual(log, {
      external_user_id: 'nexa-open-id-fail',
      nickname: 'Fail User',
      response_url: '',
      access_code: '',
      success: 0,
      error_message: 'Signature invalid'
    });
  } finally {
    harness.cleanup();
  }
});

test('predict-master recharge payment creates Nexa order and settles to Detrade wallet once', async () => {
  const harness = createHarness();
  const calls = [];

  try {
    harness.setFetch(async (url, options) => {
      const body = JSON.parse(options.body || '{}');
      calls.push({ url, body });
      if (String(url).includes('/partner/api/openapi/payment/create')) {
        const responseBody = {
          code: 0,
          data: {
            orderNo: 'nexa-predict-recharge-1',
            timestamp: '20260613120000',
            nonce: 'nonce-1',
            signType: 'MD5',
            paySign: 'pay-sign-1',
            apiKey: 'test-nexa-api-key'
          }
        };
        return {
          ok: true,
          status: 200,
          async json() {
            return responseBody;
          },
          async text() {
            return JSON.stringify(responseBody);
          }
        };
      }
      if (String(url).includes('/partner/api/openapi/payment/query')) {
        const responseBody = {
          code: 0,
          data: {
            orderNo: 'nexa-predict-recharge-1',
            status: 'SUCCESS',
            amount: '20.00',
            currency: 'USDT',
            paidTime: '2026-06-13 12:00:00'
          }
        };
        return {
          ok: true,
          status: 200,
          async json() {
            return responseBody;
          },
          async text() {
            return JSON.stringify(responseBody);
          }
        };
      }
      throw new Error(`Unexpected Nexa endpoint: ${url}`);
    });

    const create = await harness.request('POST', '/api/predict-master/payment/create', {
      openId: 'nexa-open-id-1',
      sessionKey: 'nexa-session-key-1',
      amount: '20'
    });
    assert.equal(create.statusCode, 200);
    assert.equal(create.body.ok, true);
    assert.equal(create.body.orderNo, 'nexa-predict-recharge-1');
    assert.equal(create.body.amount, '20.00');
    assert.equal(create.body.currency, 'USDT');
    assert.equal(create.body.payment.orderNo, 'nexa-predict-recharge-1');

    const query = await harness.request('POST', '/api/predict-master/payment/query', {
      orderNo: 'nexa-predict-recharge-1'
    });
    const queryAgain = await harness.request('POST', '/api/predict-master/payment/query', {
      orderNo: 'nexa-predict-recharge-1'
    });
    assert.equal(query.statusCode, 200);
    assert.equal(query.body.ok, true);
    assert.equal(query.body.status, 'SUCCESS');
    assert.equal(query.body.settled, true);
    assert.equal(query.body.walletBalance, '20.00');
    assert.equal(queryAgain.body.walletBalance, '20.00');

    const wallet = harness.db
      .prepare(
        `SELECT w.available_balance
         FROM game_wallets w
         JOIN game_users u ON u.id = w.user_id
         WHERE u.openid = ?`
      )
      .get('nexa-open-id-1');
    assert.equal(wallet.available_balance, '20.00');

    const ledgerRows = harness.db
      .prepare("SELECT type, amount, balance_after, related_type, related_id FROM game_wallet_ledger ORDER BY id ASC")
      .all();
    assert.deepEqual(ledgerRows, [
      {
        type: 'detrade_recharge',
        amount: '20.00',
        balance_after: '20.00',
        related_type: 'detrade_recharge',
        related_id: 'nexa-predict-recharge-1'
      }
    ]);

    assert.equal(calls.filter((call) => String(call.url).includes('/payment/create')).length, 1);
    assert.equal(calls.filter((call) => String(call.url).includes('/payment/query')).length, 2);
  } finally {
    harness.cleanup();
  }
});

test('predict-master wallet endpoint returns the local Detrade wallet balance for a Nexa user', async () => {
  const harness = createHarness();

  try {
    const walletBefore = await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-open-id-wallet',
      sessionKey: 'nexa-session-key-wallet'
    });
    assert.equal(walletBefore.statusCode, 200);
    assert.equal(walletBefore.body.ok, true);
    assert.equal(walletBefore.body.walletBalance, '0.00');
    assert.equal(walletBefore.body.currency, 'USDT');

    harness.db
      .prepare(
        `UPDATE game_wallets
         SET available_balance = '12.34'
         WHERE user_id = (SELECT id FROM game_users WHERE openid = ?)`
      )
      .run('nexa-open-id-wallet');

    const walletAfter = await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-open-id-wallet',
      sessionKey: 'nexa-session-key-wallet'
    });
    assert.equal(walletAfter.statusCode, 200);
    assert.equal(walletAfter.body.walletBalance, '12.34');
  } finally {
    harness.cleanup();
  }
});

test('predict-master recharge retries with documented Nexa payment payload after legacy HTTP 405', async () => {
  const harness = createHarness();
  const calls = [];

  try {
    harness.setFetch(async (url, options) => {
      const body = JSON.parse(options.body || '{}');
      calls.push({ url, body });
      if (!Object.prototype.hasOwnProperty.call(body, 'orderNo')) {
        return {
          ok: false,
          status: 405,
          async text() {
            return '';
          }
        };
      }
      const responseBody = {
        code: 0,
        data: {
          orderNo: 'nexa-predict-recharge-doc-1',
          timestamp: '20260613130000',
          nonce: 'nonce-doc-1',
          signType: 'MD5',
          paySign: 'pay-sign-doc-1',
          apiKey: 'test-nexa-api-key'
        }
      };
      return {
        ok: true,
        status: 200,
        async json() {
          return responseBody;
        },
        async text() {
          return JSON.stringify(responseBody);
        }
      };
    });

    const create = await harness.request('POST', '/api/predict-master/payment/create', {
      openId: 'nexa-open-id-doc-retry',
      sessionKey: 'nexa-session-key-doc-retry',
      amount: '2'
    });

    assert.equal(create.statusCode, 200);
    assert.equal(create.body.ok, true);
    assert.equal(create.body.orderNo, 'nexa-predict-recharge-doc-1');
    assert.equal(calls.filter((call) => String(call.url).includes('/payment/create')).length, 2);
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, 'orderNo'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(calls[1].body, 'orderNo'), true);
    assert.equal(calls[1].body.callbackUrl, 'http://127.0.0.1:3000/predict-master/');
    assert.equal(calls[1].body.notifyUrl, 'http://127.0.0.1:3000/api/predict-master/payment/notify');
    assert.equal(calls[1].body.returnUrl, 'http://127.0.0.1:3000/predict-master/');
    assert.match(calls[1].body.orderNo, /^claw800_predict_/);

    const logs = harness.db
      .prepare(
        `SELECT http_status, success, request_body_json
         FROM nexa_payment_upstream_logs
         ORDER BY id ASC`
      )
      .all();
    assert.equal(logs.length, 2);
    assert.equal(logs[0].http_status, 405);
    assert.equal(logs[0].success, 0);
    assert.equal(logs[1].http_status, 200);
    assert.equal(logs[1].success, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(logs[1].request_body_json), 'orderNo'), true);
  } finally {
    harness.cleanup();
  }
});

test('predict-master compatibility mode creates recharge with game-tip style Nexa payload first', async () => {
  const harness = createHarness();
  const calls = [];

  try {
    harness.db
      .prepare(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('predict_master_payment_compat_mode', '1', datetime('now'))"
      )
      .run();

    harness.setFetch(async (url, options) => {
      const body = JSON.parse(options.body || '{}');
      calls.push({ url, body });
      const responseBody = {
        code: 0,
        data: {
          orderNo: 'nexa-predict-recharge-compat-1',
          timestamp: '20260613140000',
          nonce: 'nonce-compat-1',
          signType: 'MD5',
          paySign: 'pay-sign-compat-1',
          apiKey: 'test-nexa-api-key'
        }
      };
      return {
        ok: true,
        status: 200,
        async json() {
          return responseBody;
        },
        async text() {
          return JSON.stringify(responseBody);
        }
      };
    });

    const create = await harness.request('POST', '/api/predict-master/payment/create', {
      openId: 'nexa-open-id-compat',
      sessionKey: 'nexa-session-key-compat',
      amount: '1'
    });

    assert.equal(create.statusCode, 200);
    assert.equal(create.body.orderNo, 'nexa-predict-recharge-compat-1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.amount, '1');
    assert.equal(calls[0].body.subject, 'Claw800 打赏');
    assert.equal(calls[0].body.body, 'Predict Master');
    assert.equal(calls[0].body.notifyUrl, 'http://127.0.0.1:3000/api/predict-master/payment/notify');
    assert.equal(calls[0].body.returnUrl, 'http://127.0.0.1:3000/predict-master/');
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, 'orderNo'), false);
  } finally {
    harness.cleanup();
  }
});

test('predict-master compatibility mode does not fall back to documented Nexa payment payload after HTTP 405', async () => {
  const harness = createHarness();
  const calls = [];

  try {
    harness.db
      .prepare(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('predict_master_payment_compat_mode', '1', datetime('now'))"
      )
      .run();

    harness.setFetch(async (url, options) => {
      const body = JSON.parse(options.body || '{}');
      calls.push({ url, body });
      return {
        ok: false,
        status: 405,
        async json() {
          return {};
        },
        async text() {
          return '{}';
        }
      };
    });

    const create = await harness.request('POST', '/api/predict-master/payment/create', {
      openId: 'nexa-open-id-compat-405',
      sessionKey: 'nexa-session-key-compat-405',
      amount: '1'
    });

    assert.equal(create.statusCode, 405);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.subject, 'Claw800 打赏');
    assert.equal(calls[0].body.body, 'Predict Master');
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, 'orderNo'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, 'callbackUrl'), false);
  } finally {
    harness.cleanup();
  }
});
