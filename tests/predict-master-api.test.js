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
    }
  };
}

test('predict-master is seeded in the games catalog and routes to its page', async () => {
  const harness = createHarness();

  try {
    const games = await harness.request('GET', '/api/games');
    assert.equal(games.statusCode, 200);
    const item = games.body.items.find((game) => game.slug === 'predict-master');
    assert.equal(item.name, '预测大师');
    assert.equal(item.route, '/predict-master/');
    assert.equal(item.actionText, '进入预测');

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
  } finally {
    harness.cleanup();
  }
});
