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
      ['predict-master', ['/predict-master/?type=trading', '高低期权']],
      ['predict-master-contract', ['/predict-master/?type=contract', '合约']],
      ['predict-master-up-down', ['/predict-master/?type=up-down&productPath=trade-center%2Fup-down', '涨跌']],
      ['predict-master-spread', ['/predict-master/?type=spread', '点差']],
      ['predict-master-tap-trading', ['/predict-master/?type=tap-trading&productPath=trade-center%2Ftap-trading', '快速交易']],
      [
        'predict-master-football-worldcup',
        ['/predict-master/?type=predict&activity=football-worldcup&productPath=dashboard%2Fpredict%2Fsports', '预测']
      ]
    ]);
    const expectedActionText = new Map([
      ['predict-master', '进入高低期权'],
      ['predict-master-contract', '进入合约'],
      ['predict-master-up-down', '进入涨跌'],
      ['predict-master-spread', '进入点差'],
      ['predict-master-tap-trading', '进入快速交易'],
      ['predict-master-football-worldcup', '进入预测']
    ]);
    for (const [slug, [route, name]] of expectedRoutes) {
      const item = games.body.items.find((game) => game.slug === slug);
      assert.ok(item, `${slug} is listed`);
      assert.equal(item.name, name);
      assert.equal(item.route, route);
      assert.equal(item.actionText, expectedActionText.get(slug));
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
    const platformPublicKey = '-----BEGIN PUBLIC KEY-----\npredict-upstream-public-key\n-----END PUBLIC KEY-----';
    const save = await harness.request(
      'PUT',
      '/api/admin/predict-master-config',
      {
        baseUrl: 'https://detrade.example',
        apiKey: 'predict-api-key',
        privateKey,
        publicKey: platformPublicKey,
        userId: '1727404213474304',
        username: 'Yxxvz',
        avatar: 'https://example.com/avatar.png',
        currency: 'USDT',
        exchangeRate: '1',
        balanceType: '1',
        feePermille: '5'
      },
      { cookies }
    );

    assert.equal(save.statusCode, 200);
    assert.equal(save.body.ok, true);
    assert.equal(save.body.hasPrivateKey, true);
    assert.equal(save.body.privateKey, '');
    assert.equal(save.body.publicKey, platformPublicKey);

    const config = await harness.request('GET', '/api/admin/predict-master-config', null, { cookies });
    assert.equal(config.statusCode, 200);
    assert.equal(config.body.apiKey, 'predict-api-key');
    assert.equal(config.body.hasPrivateKey, true);
    assert.equal(config.body.privateKey, '');
    assert.equal(config.body.publicKey, platformPublicKey);
    assert.equal(config.body.feePermille, '5');
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
    const storedPublicKey = harness.db.prepare(`SELECT value FROM settings WHERE key = 'predict_master_public_key'`).get();
    assert.equal(storedPublicKey.value, platformPublicKey);
    const storedFeePermille = harness.db.prepare(`SELECT value FROM settings WHERE key = 'predict_master_fee_permille'`).get();
    assert.equal(storedFeePermille.value, '5');
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

test('predict-master client error logs capture SDK order failures for admin diagnosis', async () => {
  const harness = createHarness();

  try {
    const cookies = await harness.adminCookies();
    const create = await harness.request('POST', '/api/predict-master/client-error', {
      source: 'sdk-on-error',
      pageUrl: 'https://claw800.com/predict-master/?type=predict&activity=football-worldcup',
      productType: 'predict',
      activity: 'football-worldcup',
      productPath: 'dashboard/predict/sports',
      accessCode: 'access-code-123',
      message: 'Platform key not found.',
      stack: 'Error: Platform key not found.',
      userAgent: 'NexaWebView',
      context: {
        sdkEntry: 'https://testwww.exchange2currency.com',
        productUrl: 'https://testwww.exchange2currency.com/dashboard/predict/sports'
      }
    });
    assert.equal(create.statusCode, 200);
    assert.equal(create.body.ok, true);

    const response = await harness.request('GET', '/api/admin/predict-master-client-error-logs', null, { cookies });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].source, 'sdk-on-error');
    assert.equal(response.body.items[0].productType, 'predict');
    assert.equal(response.body.items[0].activity, 'football-worldcup');
    assert.equal(response.body.items[0].productPath, 'dashboard/predict/sports');
    assert.equal(response.body.items[0].message, 'Platform key not found.');
    assert.equal(response.body.items[0].context.productUrl, 'https://testwww.exchange2currency.com/dashboard/predict/sports');
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
    assert.deepEqual(
      logs.body.items.map((item) => item.source).sort(),
      ['predict-payment-create-github-doc-strict', 'predict-payment-create-legacy'].sort()
    );
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

test('admin can view predict-master recharge orders', async () => {
  const harness = createHarness();

  try {
    const cookies = await harness.adminCookies();
    const user = harness.db
      .prepare("INSERT INTO game_users (openid, nickname, avatar) VALUES (?, 'Recharge User', '')")
      .run('nexa-recharge-admin-user');
    harness.db
      .prepare(
        `INSERT INTO detrade_recharge_orders (
          order_no, partner_order_no, user_id, external_user_id, amount, currency, status, paid_at, settled_at
        ) VALUES (?, ?, ?, ?, ?, 'USDT', 'SUCCESS', datetime('now'), datetime('now'))`
      )
      .run('T-admin-recharge-1', 'pm-admin-recharge-1', user.lastInsertRowid, 'nexa-recharge-admin-user', '12.50');

    const response = await harness.request('GET', '/api/admin/predict-master-recharge-orders', null, { cookies });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].orderNo, 'T-admin-recharge-1');
    assert.equal(response.body.items[0].partnerOrderNo, 'pm-admin-recharge-1');
    assert.equal(response.body.items[0].externalUserId, 'nexa-recharge-admin-user');
    assert.equal(response.body.items[0].nickname, 'Recharge User');
    assert.equal(response.body.items[0].amount, '12.50');
    assert.equal(response.body.items[0].currency, 'USDT');
    assert.equal(response.body.items[0].status, 'SUCCESS');
    assert.equal(response.body.items[0].displayStatus, '完成');
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

test('predict-master login url allows explicit desktop dev auth with configured test user', async () => {
  const harness = createHarness();
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
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
        exchangeRate: '1'
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
            data: {
              url: 'https://detrade.example/embed?accessCode=dev',
              accessCode: 'dev'
            }
          };
        },
        async text() {
          return JSON.stringify({
            code: 0,
            data: { url: 'https://detrade.example/embed?accessCode=dev', accessCode: 'dev' }
          });
        }
      };
    });

    const response = await harness.request('POST', '/api/predict-master/login-url', {
      devAuth: true
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.devAuth, true);

    const payload = JSON.parse(upstreamRequest.options.body);
    assert.deepEqual(payload, {
      userId: '1727404213474304',
      username: 'Yxxvz',
      avatar: 'https://example.com/avatar.png',
      currency: 'USDT',
      exchangeRate: 1
    });
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
         FROM detrade_wallets w
         JOIN game_users u ON u.id = w.user_id
         WHERE u.openid = ?`
      )
      .get('nexa-open-id-1');
    assert.equal(wallet.available_balance, '20.00');

    const xiangqiWallet = harness.db
      .prepare(
        `SELECT w.available_balance
         FROM game_wallets w
         JOIN game_users u ON u.id = w.user_id
         WHERE u.openid = ?`
      )
      .get('nexa-open-id-1');
    assert.equal(xiangqiWallet, undefined);

    const ledgerRows = harness.db
      .prepare("SELECT type, amount, balance_after, related_type, related_id FROM detrade_wallet_ledger ORDER BY id ASC")
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

    const userId = harness.db.prepare('SELECT id FROM game_users WHERE openid = ?').get('nexa-open-id-wallet').id;
    harness.db
      .prepare("INSERT INTO game_wallets (user_id, currency, available_balance, frozen_balance) VALUES (?, 'USDT', '99.00', '0.00')")
      .run(userId);

    const walletStillSeparate = await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-open-id-wallet',
      sessionKey: 'nexa-session-key-wallet'
    });
    assert.equal(walletStillSeparate.statusCode, 200);
    assert.equal(walletStillSeparate.body.walletBalance, '0.00');

    harness.db
      .prepare(
        `UPDATE detrade_wallets
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

test('predict-master order deduction does not charge an extra platform trading fee', async () => {
  const harness = createHarness();

  try {
    await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-predict-fee-user',
      sessionKey: 'session-predict-fee-user'
    });
    const userId = harness.db.prepare('SELECT id FROM game_users WHERE openid = ?').get('nexa-predict-fee-user').id;
    harness.db.prepare("UPDATE detrade_wallets SET available_balance = '100.00' WHERE user_id = ?").run(userId);
    harness.db
      .prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('predict_master_fee_permille', '5', datetime('now'))")
      .run();

    const payload = {
      userId: 'nexa-predict-fee-user',
      amount: '10.00',
      currency: 'USDT',
      bizId: 'fee-order-1',
      bizType: 'binary',
      source: 'PLACE_BINARY_ORDER',
      bizSubId: 'fee-sub-1'
    };
    const deduction = await harness.request('POST', '/wallet/amount/deduction', payload);
    assert.equal(deduction.statusCode, 200);
    assert.equal(deduction.body.code, 200);
    assert.deepEqual(deduction.body.data, { usdAmount: '10.00' });

    const walletAfter = harness.db.prepare('SELECT available_balance FROM detrade_wallets WHERE user_id = ?').get(userId);
    assert.equal(walletAfter.available_balance, '90.00');
    const transactions = harness.db
      .prepare(
        `SELECT direction, source, amount, balance_after
         FROM detrade_wallet_transactions
         WHERE user_id = ?
         ORDER BY id ASC`
      )
      .all(userId);
    assert.deepEqual(transactions, [
      { direction: 'deduction', source: 'PLACE_BINARY_ORDER', amount: '10.00', balance_after: '90.00' }
    ]);

    const repeated = await harness.request('POST', '/wallet/amount/deduction', payload);
    assert.equal(repeated.statusCode, 200);
    assert.equal(repeated.body.code, 200);
    const walletAfterRepeated = harness.db.prepare('SELECT available_balance FROM detrade_wallets WHERE user_id = ?').get(userId);
    assert.equal(walletAfterRepeated.available_balance, '90.00');
    const transactionCount = harness.db
      .prepare('SELECT COUNT(*) AS count FROM detrade_wallet_transactions WHERE user_id = ?')
      .get(userId);
    assert.equal(transactionCount.count, 1);
  } finally {
    harness.cleanup();
  }
});

test('predict-master accepts Detrade contract fee deduction callbacks', async () => {
  const harness = createHarness();

  try {
    await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-predict-contract-fee-user',
      sessionKey: 'session-predict-contract-fee-user'
    });
    const userId = harness.db.prepare('SELECT id FROM game_users WHERE openid = ?').get('nexa-predict-contract-fee-user').id;
    harness.db.prepare("UPDATE detrade_wallets SET available_balance = '20.00' WHERE user_id = ?").run(userId);

    const payload = {
      userId: 'nexa-predict-contract-fee-user',
      amount: 0.00445,
      balanceType: 1,
      bizId: '1155651986101763',
      bizSubId: '1244011',
      bizType: 'CONTRACT_ORDER',
      currency: 'USDT',
      source: 'CONTRACT_FEE'
    };
    const deduction = await harness.request('POST', '/wallet/amount/deduction', payload);
    assert.equal(deduction.statusCode, 200);
    assert.equal(deduction.body.code, 200);
    assert.deepEqual(deduction.body.data, { usdAmount: '0.00445' });

    const walletAfter = harness.db.prepare('SELECT available_balance FROM detrade_wallets WHERE user_id = ?').get(userId);
    assert.equal(walletAfter.available_balance, '19.99555');
    const transaction = harness.db
      .prepare(
        `SELECT direction, source, amount, balance_after
         FROM detrade_wallet_transactions
         WHERE user_id = ?`
      )
      .get(userId);
    assert.deepEqual(transaction, {
      direction: 'deduction',
      source: 'CONTRACT_FEE',
      amount: '0.00445',
      balance_after: '19.99555'
    });

    const repeated = await harness.request('POST', '/wallet/amount/deduction', payload);
    assert.equal(repeated.statusCode, 200);
    assert.equal(repeated.body.code, 200);
    const transactionCount = harness.db
      .prepare('SELECT COUNT(*) AS count FROM detrade_wallet_transactions WHERE user_id = ?')
      .get(userId);
    assert.equal(transactionCount.count, 1);
  } finally {
    harness.cleanup();
  }
});

test('predict-master withdrawal creates a review item and admin can approve it', async () => {
  const harness = createHarness();

  try {
    const walletBefore = await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-predict-withdraw-approve',
      sessionKey: 'session-predict-withdraw-approve'
    });
    assert.equal(walletBefore.statusCode, 200);

    const userId = harness.db
      .prepare('SELECT id FROM game_users WHERE openid = ?')
      .get('nexa-predict-withdraw-approve').id;
    harness.db
      .prepare("UPDATE detrade_wallets SET available_balance = '20.00' WHERE user_id = ?")
      .run(userId);
    harness.db
      .prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('predict_master_fee_permille', '10', datetime('now'))")
      .run();

    const create = await harness.request('POST', '/api/predict-master/withdraw/create', {
      openId: 'nexa-predict-withdraw-approve',
      sessionKey: 'session-predict-withdraw-approve',
      amount: '6.25'
    });
    assert.equal(create.statusCode, 200);
    assert.equal(create.body.ok, true);
    assert.equal(create.body.status, 'review_pending');
    assert.equal(create.body.amount, '6.25');
    assert.equal(create.body.feeAmount, '0.06');
    assert.equal(create.body.arrivalAmount, '6.19');
    assert.equal(create.body.feePermille, '10');
    assert.equal(create.body.currency, 'USDT');
    assert.equal(create.body.walletBalance, '13.75');
    assert.match(create.body.withdrawNo, /^pmwd/);

    const row = harness.db
      .prepare('SELECT withdraw_no, user_id, external_user_id, amount, status FROM detrade_withdrawals WHERE withdraw_no = ?')
      .get(create.body.withdrawNo);
    assert.deepEqual(row, {
      withdraw_no: create.body.withdrawNo,
      user_id: userId,
      external_user_id: 'nexa-predict-withdraw-approve',
      amount: '6.25',
      status: 'review_pending'
    });

    const ledgerItems = harness.db
      .prepare('SELECT type, amount, balance_after, related_type, related_id FROM detrade_wallet_ledger WHERE related_id = ? ORDER BY id ASC')
      .all(create.body.withdrawNo);
    assert.deepEqual(ledgerItems, [
      {
        type: 'withdraw_debit',
        amount: '-6.19',
        balance_after: '13.81',
        related_type: 'withdraw',
        related_id: create.body.withdrawNo
      },
      {
        type: 'withdraw_fee',
        amount: '-0.06',
        balance_after: '13.75',
        related_type: 'withdraw_fee',
        related_id: create.body.withdrawNo
      }
    ]);

    const cookies = await harness.adminCookies();
    const list = await harness.request('GET', '/api/admin/predict-master-withdrawals?status=review_pending', null, {
      cookies
    });
    assert.equal(list.statusCode, 200);
    assert.equal(list.body.ok, true);
    assert.equal(list.body.items[0].withdrawNo, create.body.withdrawNo);
    assert.equal(list.body.items[0].openId, 'nexa-predict-withdraw-approve');

    const approve = await harness.request(
      'POST',
      `/api/admin/predict-master-withdrawals/${create.body.withdrawNo}/approve`,
      { note: 'ok' },
      { cookies }
    );
    assert.equal(approve.statusCode, 200);
    assert.equal(approve.body.ok, true);
    assert.equal(approve.body.status, 'success');

    const approved = harness.db
      .prepare('SELECT status, review_note, reviewed_by, finished_at FROM detrade_withdrawals WHERE withdraw_no = ?')
      .get(create.body.withdrawNo);
    assert.equal(approved.status, 'success');
    assert.equal(approved.review_note, 'ok');
    assert.equal(approved.reviewed_by, 'admin');
    assert.notEqual(approved.finished_at, '');

    const walletAfter = harness.db
      .prepare('SELECT available_balance FROM detrade_wallets WHERE user_id = ?')
      .get(userId);
    assert.equal(walletAfter.available_balance, '13.75');
  } finally {
    harness.cleanup();
  }
});

test('predict-master withdrawal rejection refunds the Detrade wallet', async () => {
  const harness = createHarness();

  try {
    await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-predict-withdraw-reject',
      sessionKey: 'session-predict-withdraw-reject'
    });
    const userId = harness.db
      .prepare('SELECT id FROM game_users WHERE openid = ?')
      .get('nexa-predict-withdraw-reject').id;
    harness.db
      .prepare("UPDATE detrade_wallets SET available_balance = '9.00' WHERE user_id = ?")
      .run(userId);

    const create = await harness.request('POST', '/api/predict-master/withdraw/create', {
      openId: 'nexa-predict-withdraw-reject',
      sessionKey: 'session-predict-withdraw-reject',
      amount: '4.50'
    });
    assert.equal(create.statusCode, 200);
    assert.equal(create.body.walletBalance, '4.50');

    const cookies = await harness.adminCookies();
    const reject = await harness.request(
      'POST',
      `/api/admin/predict-master-withdrawals/${create.body.withdrawNo}/reject`,
      { note: '资料不完整' },
      { cookies }
    );
    assert.equal(reject.statusCode, 200);
    assert.equal(reject.body.ok, true);
    assert.equal(reject.body.status, 'rejected');

    const rejected = harness.db
      .prepare('SELECT status, review_note, reviewed_by FROM detrade_withdrawals WHERE withdraw_no = ?')
      .get(create.body.withdrawNo);
    assert.deepEqual(rejected, {
      status: 'rejected',
      review_note: '资料不完整',
      reviewed_by: 'admin'
    });

    const walletAfter = harness.db
      .prepare('SELECT available_balance FROM detrade_wallets WHERE user_id = ?')
      .get(userId);
    assert.equal(walletAfter.available_balance, '9.00');

    const refund = harness.db
      .prepare("SELECT type, amount, balance_after FROM detrade_wallet_ledger WHERE related_id = ? AND type = 'withdraw_refund'")
      .get(create.body.withdrawNo);
    assert.deepEqual(refund, {
      type: 'withdraw_refund',
      amount: '4.50',
      balance_after: '9.00'
    });
  } finally {
    harness.cleanup();
  }
});

test('predict-master withdrawal rejects insufficient balance', async () => {
  const harness = createHarness();

  try {
    await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-predict-withdraw-low',
      sessionKey: 'session-predict-withdraw-low'
    });
    const userId = harness.db.prepare('SELECT id FROM game_users WHERE openid = ?').get('nexa-predict-withdraw-low').id;
    harness.db
      .prepare("UPDATE detrade_wallets SET available_balance = '1.00' WHERE user_id = ?")
      .run(userId);

    const create = await harness.request('POST', '/api/predict-master/withdraw/create', {
      openId: 'nexa-predict-withdraw-low',
      sessionKey: 'session-predict-withdraw-low',
      amount: '2.00'
    });
    assert.equal(create.statusCode, 409);
    assert.equal(create.body.ok, false);
    assert.equal(create.body.error, 'INSUFFICIENT_BALANCE');
    assert.equal(
      harness.db.prepare('SELECT COUNT(*) AS count FROM detrade_withdrawals').get().count,
      0
    );
  } finally {
    harness.cleanup();
  }
});

test('predict-master withdrawal rejects amounts not greater than 1 USDT', async () => {
  const harness = createHarness();

  try {
    await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-predict-withdraw-min',
      sessionKey: 'session-predict-withdraw-min'
    });

    const create = await harness.request('POST', '/api/predict-master/withdraw/create', {
      openId: 'nexa-predict-withdraw-min',
      sessionKey: 'session-predict-withdraw-min',
      amount: '1'
    });

    assert.equal(create.statusCode, 400);
    assert.equal(create.body.ok, false);
    assert.equal(create.body.error, '提现金额必须大于 1 USDT');
    assert.equal(harness.db.prepare('SELECT COUNT(*) AS count FROM detrade_withdrawals').get().count, 0);
  } finally {
    harness.cleanup();
  }
});

test('predict-master records endpoint returns recharge and withdrawal history for the current user', async () => {
  const harness = createHarness();

  try {
    await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-predict-records',
      sessionKey: 'session-predict-records'
    });
    const userId = harness.db.prepare('SELECT id FROM game_users WHERE openid = ?').get('nexa-predict-records').id;
    harness.db
      .prepare("UPDATE detrade_wallets SET available_balance = '30.00' WHERE user_id = ?")
      .run(userId);

    harness.db
      .prepare(
        `INSERT INTO detrade_recharge_orders (
          order_no, partner_order_no, user_id, external_user_id, amount, currency, status, paid_at, settled_at
        ) VALUES (?, ?, ?, ?, ?, 'USDT', 'SUCCESS', datetime('now'), datetime('now'))`
      )
      .run('T-record-recharge-1', 'pm-record-recharge-1', userId, 'nexa-predict-records', '8.00');

    const pending = await harness.request('POST', '/api/predict-master/withdraw/create', {
      openId: 'nexa-predict-records',
      sessionKey: 'session-predict-records',
      amount: '5.00'
    });
    assert.equal(pending.statusCode, 200);

    const approved = await harness.request('POST', '/api/predict-master/withdraw/create', {
      openId: 'nexa-predict-records',
      sessionKey: 'session-predict-records',
      amount: '3.00'
    });
    assert.equal(approved.statusCode, 200);
    const cookies = await harness.adminCookies();
    const approve = await harness.request(
      'POST',
      `/api/admin/predict-master-withdrawals/${approved.body.withdrawNo}/approve`,
      {},
      { cookies }
    );
    assert.equal(approve.statusCode, 200);

    await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-predict-records-other',
      sessionKey: 'session-predict-records-other'
    });
    const otherUserId = harness.db
      .prepare('SELECT id FROM game_users WHERE openid = ?')
      .get('nexa-predict-records-other').id;
    harness.db
      .prepare(
        `INSERT INTO detrade_recharge_orders (
          order_no, partner_order_no, user_id, external_user_id, amount, currency, status
        ) VALUES (?, ?, ?, ?, ?, 'USDT', 'SUCCESS')`
      )
      .run('T-record-other-1', 'pm-record-other-1', otherUserId, 'nexa-predict-records-other', '99.00');

    const records = await harness.request('POST', '/api/predict-master/records', {
      openId: 'nexa-predict-records',
      sessionKey: 'session-predict-records'
    });
    assert.equal(records.statusCode, 200);
    assert.equal(records.body.ok, true);
    assert.equal(records.body.items.length, 3);
    assert.deepEqual(
      records.body.items.map((item) => [item.type, item.amount, item.status, item.displayStatus]),
      [
        ['withdraw', '3.00', 'success', '完成'],
        ['withdraw', '5.00', 'review_pending', '提现中'],
        ['recharge', '8.00', 'SUCCESS', '完成']
      ]
    );
    assert.equal(records.body.items.some((item) => item.amount === '99.00'), false);
  } finally {
    harness.cleanup();
  }
});

test('predict-master records cancel pending recharge orders after five minutes', async () => {
  const harness = createHarness();

  try {
    await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-predict-expired-recharge',
      sessionKey: 'session-predict-expired-recharge'
    });
    const userId = harness.db.prepare('SELECT id FROM game_users WHERE openid = ?').get('nexa-predict-expired-recharge').id;
    harness.db
      .prepare(
        `INSERT INTO detrade_recharge_orders (
          order_no, partner_order_no, user_id, external_user_id, amount, currency, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'USDT', 'PENDING', datetime('now', '-6 minutes'), datetime('now', '-6 minutes'))`
      )
      .run('T-record-expired-recharge-1', 'pm-record-expired-recharge-1', userId, 'nexa-predict-expired-recharge', '2.00');

    const records = await harness.request('POST', '/api/predict-master/records', {
      openId: 'nexa-predict-expired-recharge',
      sessionKey: 'session-predict-expired-recharge'
    });

    assert.equal(records.statusCode, 200);
    assert.equal(records.body.ok, true);
    assert.equal(records.body.items.length, 1);
    assert.equal(records.body.items[0].status, 'CANCELLED');
    assert.equal(records.body.items[0].displayStatus, '失败');

    const stored = harness.db.prepare('SELECT status FROM detrade_recharge_orders WHERE order_no = ?').get('T-record-expired-recharge-1');
    assert.equal(stored.status, 'CANCELLED');
  } finally {
    harness.cleanup();
  }
});

test('predict-master records cancel any unfinished recharge orders after five minutes', async () => {
  const harness = createHarness();

  try {
    await harness.request('POST', '/api/predict-master/wallet', {
      openId: 'nexa-predict-expired-unfinished-recharge',
      sessionKey: 'session-predict-expired-unfinished-recharge'
    });
    const userId = harness.db.prepare('SELECT id FROM game_users WHERE openid = ?').get('nexa-predict-expired-unfinished-recharge').id;
    harness.db
      .prepare(
        `INSERT INTO detrade_recharge_orders (
          order_no, partner_order_no, user_id, external_user_id, amount, currency, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'USDT', ?, datetime('now', '-2 hours'), datetime('now', '-2 hours'))`
      )
      .run(
        'T-record-expired-unfinished-recharge-1',
        'pm-record-expired-unfinished-recharge-1',
        userId,
        'nexa-predict-expired-unfinished-recharge',
        '6.00',
        'pending'
      );

    const records = await harness.request('POST', '/api/predict-master/records', {
      openId: 'nexa-predict-expired-unfinished-recharge',
      sessionKey: 'session-predict-expired-unfinished-recharge'
    });

    assert.equal(records.statusCode, 200);
    assert.equal(records.body.items[0].status, 'CANCELLED');
    assert.equal(records.body.items[0].displayStatus, '失败');

    const stored = harness.db.prepare('SELECT status FROM detrade_recharge_orders WHERE order_no = ?').get('T-record-expired-unfinished-recharge-1');
    assert.equal(stored.status, 'CANCELLED');
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
    assert.equal(calls[0].body.body, '预测大师');
    assert.equal(calls[0].body.notifyUrl, 'http://127.0.0.1:3000/api/nexa/tip/notify');
    assert.equal(calls[0].body.returnUrl, 'http://127.0.0.1:3000/xiangqi/');
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, 'orderNo'), false);
  } finally {
    harness.cleanup();
  }
});

test('predict-master compatibility mode falls back to documented Nexa payment payload after HTTP 405', async () => {
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
      if (calls.length === 2) {
        const responseBody = {
          code: 0,
          data: {
            orderNo: 'nexa-predict-recharge-compat-fallback-1',
            timestamp: '20260613143000',
            nonce: 'nonce-compat-fallback-1',
            signType: 'MD5',
            paySign: 'pay-sign-compat-fallback-1',
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

    assert.equal(create.statusCode, 200);
    assert.equal(create.body.orderNo, 'nexa-predict-recharge-compat-fallback-1');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].body.amount, '1');
    assert.equal(calls[0].body.subject, 'Claw800 打赏');
    assert.equal(calls[0].body.body, '预测大师');
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, 'orderNo'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, 'callbackUrl'), false);
    assert.equal(calls[1].body.amount, '1.00');
    assert.equal(calls[1].body.body, '预测大师');
    assert.equal(calls[1].body.notifyUrl, 'http://127.0.0.1:3000/api/nexa/tip/notify');
    assert.equal(calls[1].body.returnUrl, 'http://127.0.0.1:3000/xiangqi/');
    assert.equal(calls[1].body.callbackUrl, 'http://127.0.0.1:3000/xiangqi/');
    assert.equal(Object.prototype.hasOwnProperty.call(calls[1].body, 'orderNo'), true);
    assert.match(calls[1].body.orderNo, /^pm\d+[a-f0-9]{6}$/);
  } finally {
    harness.cleanup();
  }
});

test('predict-master recharge rejects amounts below 1 USDT', async () => {
  const harness = createHarness();

  try {
    const create = await harness.request('POST', '/api/predict-master/payment/create', {
      openId: 'nexa-open-id-small-recharge',
      sessionKey: 'nexa-session-key-small-recharge',
      amount: '0.1'
    });

    assert.equal(create.statusCode, 400);
    assert.equal(create.body.error, '充值金额必须大于 1 USDT');
  } finally {
    harness.cleanup();
  }
});
