const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const EventEmitter = require('node:events');
const crypto = require('node:crypto');

const dbModulePath = path.join(__dirname, '..', 'src', 'db.js');
const serverModulePath = path.join(__dirname, '..', 'src', 'server.js');
const adminHtmlPath = path.join(__dirname, '..', 'public', 'admin.html');
const adminJsPath = path.join(__dirname, '..', 'public', 'admin.js');

function createHarness() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claw800-u-card-query-'));
  const dbPath = path.join(tmpDir, 'claw800.db');
  const previousDbPath = process.env.CLAW800_DB_PATH;

  process.env.CLAW800_DB_PATH = dbPath;
  delete require.cache[require.resolve(dbModulePath)];
  delete require.cache[require.resolve(serverModulePath)];

  const db = require(dbModulePath);
  const app = require(serverModulePath);

  return {
    db,
    async request(method, routePath, body, cookies = {}) {
      return new Promise((resolve, reject) => {
        const req = new EventEmitter();
        req.method = method;
        req.url = routePath;
        req.originalUrl = routePath;
        req.headers = {};
        req.connection = {};
        req.socket = {};
        req.body = body;
        req.cookies = { ...cookies };
        req.query = {};

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
        res.cookie = function cookie(name, value) {
          this.headers['set-cookie'] = [`${name}=${value}`];
          return this;
        };
        res.clearCookie = function clearCookie(name) {
          this.headers['set-cookie'] = [`${name}=; Max-Age=0`];
          return this;
        };
        res.status = function status(code) {
          this.statusCode = code;
          return this;
        };
        res.json = function json(payload) {
          resolve({ statusCode: this.statusCode, body: payload, headers: this.headers });
          return this;
        };
        res.end = function end(chunk) {
          resolve({ statusCode: this.statusCode, body: chunk || null, headers: this.headers });
          return this;
        };

        app.handle(req, res, reject);
        req.emit('end');
      });
    },
    cleanup() {
      db.close();
      delete require.cache[require.resolve(serverModulePath)];
      delete require.cache[require.resolve(dbModulePath)];
      if (previousDbPath === undefined) {
        delete process.env.CLAW800_DB_PATH;
      } else {
        process.env.CLAW800_DB_PATH = previousDbPath;
      }
    }
  };
}

async function loginAdmin(harness) {
  const response = await harness.request('POST', '/api/admin/login', { password: '123456' });
  assert.equal(response.statusCode, 200);
  const serialized = response.headers['set-cookie'][0];
  const [pair] = serialized.split(';');
  const [name, value] = pair.split('=');
  return { [name]: value };
}

test('public U card products endpoint requires upstream config', async () => {
  const harness = createHarness();
  try {
    const response = await harness.request('GET', '/api/u-card/products');
    assert.equal(response.statusCode, 503);
    assert.match(response.body.error, /U 卡上游配置不完整/);
  } finally {
    harness.cleanup();
  }
});

test('public U card products endpoint signs and normalizes upstream products', async () => {
  const harness = createHarness();
  const previousFetch = global.fetch;
  try {
    const cookies = await loginAdmin(harness);
    const generated = await harness.request('POST', '/api/admin/u-card/upstream-config/generate-keypair', {}, cookies);
    const save = await harness.request(
      'PUT',
      '/api/admin/u-card/upstream-config',
      {
        appId: 'upal-app-001',
        developerPrivateKey: generated.body.developerPrivateKey,
        platformPublicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A\n-----END PUBLIC KEY-----'
      },
      cookies
    );
    assert.equal(save.statusCode, 200);

    let captured = null;
    let capturedPayment = null;
    let mockPaymentQueryStatus = 'PENDING';
    global.fetch = async (url, options = {}) => {
      if (String(url).includes('/partner/api/openapi/payment/create')) {
        capturedPayment = {
          url: String(url),
          body: JSON.parse(String(options.body || '{}'))
        };
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              code: '0',
              data: {
                orderNo: 'nexa-u-card-order-1',
                paySign: 'pay-sign',
                signType: 'MD5',
                nonce: 'nonce',
                timestamp: '1234567890'
              }
            });
          },
          async json() {
            return {
              code: '0',
              data: {
                orderNo: 'nexa-u-card-order-1',
                paySign: 'pay-sign',
                signType: 'MD5',
                nonce: 'nonce',
                timestamp: '1234567890'
              }
            };
          }
        };
      }
      if (String(url).includes('/partner/api/openapi/payment/query')) {
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              code: '0',
              data: {
                orderNo: 'nexa-u-card-order-1',
                status: mockPaymentQueryStatus,
                amount: '10.00',
                currency: 'USDT',
                paidTime: '2026-05-15 12:00:00'
              }
            });
          },
          async json() {
            return {
              code: '0',
              data: {
                orderNo: 'nexa-u-card-order-1',
                status: mockPaymentQueryStatus,
                amount: '10.00',
                currency: 'USDT',
                paidTime: '2026-05-15 12:00:00'
              }
            };
          }
        };
      }
      if (String(url).includes('/open-api/cardholders')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true, data: { id: 'cardholder-001' } };
          }
        };
      }
      if (String(url).includes('/open-api/cards/open')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              ok: true,
              data: {
                requestId: 'REQ_UCARD_001',
                status: 'PROCESSING',
                productCode: 'virtual-usd'
              }
            };
          }
        };
      }
      captured = {
        url: String(url),
        method: options.method,
        headers: options.headers,
        body: String(options.body || '')
      };
      const signedPayload = [
        captured.headers['x-app-id'],
        captured.headers['x-timestamp'],
        captured.headers['x-nonce'],
        captured.body
      ].join('.');
      assert.equal(
        crypto.verify(
          'RSA-SHA256',
          Buffer.from(signedPayload),
          generated.body.customerPublicKey,
          Buffer.from(captured.headers['x-signature'], 'base64')
        ),
        true
      );
      assert.match(captured.headers['x-timestamp'], /^\d{10}$/);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: {
              products: [
                {
                  productCode: 'virtual-usd',
                  productName: 'Virtual USD Card',
                  feeAmount: '5.00',
                  currency: 'USDT',
                  cardCurrency: 'USD',
                  description: 'Global virtual card'
                }
              ]
            }
          };
        }
      };
    };

    const response = await harness.request('GET', '/api/u-card/products');
    assert.equal(response.statusCode, 200);
    assert.equal(captured.url, 'https://b.alipay.bot/backend/open-api/cards/products');
    assert.equal(captured.method, 'POST');
    assert.equal(captured.headers['x-app-id'], 'upal-app-001');
    assert.deepEqual(JSON.parse(captured.body), {});
    assert.deepEqual(response.body.items, [
      {
        id: 'virtual-usd',
        product_code: 'virtual-usd',
        name: 'Virtual USD Card',
        fee_amount: '5.00',
        currency: 'USDT',
        card_currency: 'USD',
        description: 'Global virtual card'
      }
    ]);

    const adminProducts = await harness.request('GET', '/api/admin/u-card/products', null, cookies);
    assert.equal(adminProducts.statusCode, 200);
    assert.equal(adminProducts.body.items[0].upstream_fee_amount, '5.00');
    assert.equal(adminProducts.body.items[0].local_fee_amount, '5.00');

    const updatedProduct = await harness.request(
      'PUT',
      '/api/admin/u-card/products/virtual-usd',
      {
        localFeeAmount: '10.00',
        localCurrency: 'USDT',
        isEnabled: 1
      },
      cookies
    );
    assert.equal(updatedProduct.statusCode, 200);
    assert.equal(updatedProduct.body.item.local_fee_amount, '10.00');

    const configuredProducts = await harness.request('GET', '/api/u-card/products');
    assert.equal(configuredProducts.statusCode, 200);
    assert.equal(configuredProducts.body.items[0].fee_amount, '10.00');

    harness.db
      .prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))")
      .run('nexa_api_key', 'nexa-api-key');
    harness.db
      .prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))")
      .run('nexa_app_secret', 'nexa-app-secret');
    const payment = await harness.request(
      'POST',
      '/api/u-card/payment/create',
      {
        productCode: 'virtual-usd',
        openId: 'nexa-open-id',
        sessionKey: 'nexa-session-key'
      }
    );
    assert.equal(payment.statusCode, 200, JSON.stringify(payment.body));
    assert.equal(payment.body.amount, '10.00');
    assert.equal(payment.body.currency, 'USDT');
    assert.equal(payment.body.payment.orderNo, 'nexa-u-card-order-1');
    assert.match(payment.body.application.application_no, /^UC/);
    assert.equal(payment.body.application.status, 'awaiting_payment');
    assert.equal(capturedPayment.body.amount, '10.00');
    assert.equal(capturedPayment.body.sessionKey, 'nexa-session-key');

    const applicationNo = payment.body.application.application_no;
    const unpaidPublicList = await harness.request('GET', '/api/u-card/applications?openId=nexa-open-id');
    assert.equal(unpaidPublicList.statusCode, 200);
    assert.deepEqual(unpaidPublicList.body.items, []);

    mockPaymentQueryStatus = 'SUCCESS';
    const confirmed = await harness.request(
      'POST',
      `/api/u-card/applications/${applicationNo}/confirm-payment`,
      { openId: 'nexa-open-id' }
    );
    assert.equal(confirmed.statusCode, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.item.status, 'needs_profile');

    const listed = await harness.request('GET', '/api/u-card/applications?openId=nexa-open-id');
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.items.length, 1);
    assert.equal(listed.body.items[0].status, 'needs_profile');

    const profiled = await harness.request(
      'POST',
      `/api/u-card/applications/${applicationNo}/profile`,
      {
        openId: 'nexa-open-id',
        holder: {
          firstName: 'Open',
          lastName: 'Api',
          nationality: '中国',
          birthday: '1990-01-01',
          phoneCode: '+86',
          phone: '13800000000',
          email: 'open@example.com',
          country: '中国',
          state: '广东',
          city: '深圳',
          postalCode: '518000',
          address: 'Demo Street 1'
        }
      }
    );
    assert.equal(profiled.statusCode, 200, JSON.stringify(profiled.body));
    assert.equal(profiled.body.item.status, 'review_pending');
    assert.equal(profiled.body.item.cardholder_id, 'cardholder-001');
    assert.equal(profiled.body.item.upstream_application_id, 'REQ_UCARD_001');

    const recovered = await harness.request(
      'POST',
      '/api/u-card/applications/recover-paid',
      {
        orderNo: 'nexa-u-card-order-legacy',
        openId: 'nexa-open-id',
        productCode: 'virtual-usd',
        productName: 'Virtual USD Card',
        amount: '10.00',
        currency: 'USDT'
      }
    );
    assert.equal(recovered.statusCode, 200, JSON.stringify(recovered.body));
    assert.equal(recovered.body.item.status, 'needs_profile');
    assert.equal(recovered.body.item.order_no, 'nexa-u-card-order-legacy');

    const adminApplications = await harness.request('GET', '/api/admin/u-card/applications', null, cookies);
    assert.equal(adminApplications.statusCode, 200);
    assert.equal(adminApplications.body.items.length, 2);
    assert.deepEqual(
      adminApplications.body.items.map((item) => item.payment_status).sort(),
      ['SUCCESS', 'SUCCESS']
    );
  } finally {
    global.fetch = previousFetch;
    harness.cleanup();
  }
});

test('U card query seeds default platforms and returns cards for a selected platform without login', async () => {
  const harness = createHarness();
  try {
    const publicPlatforms = await harness.request('GET', '/api/u-card/platforms');
    assert.equal(publicPlatforms.statusCode, 200);
    assert.deepEqual(
      publicPlatforms.body.items.map((item) => item.name),
      [
        'ChatGPT',
        'Anthropic',
        'Grok',
        'Gemini',
        'Codex',
        'Google',
        'Amazon',
        'Telegram',
        'PlayStation',
        'Midjourney',
        'eBay',
        'Notion',
        'Tiktok',
        'X',
        'SUNO',
        'Sora'
      ]
    );

    const cookies = await loginAdmin(harness);
    const chatgpt = publicPlatforms.body.items.find((item) => item.name === 'ChatGPT');
    const sora = publicPlatforms.body.items.find((item) => item.name === 'Sora');
    const created = await harness.request(
      'POST',
      '/api/admin/u-card/cards',
      { name: 'Wild AI Card', bin: '438888', issuerRegion: '美国', platformIds: [chatgpt.id, sora.id] },
      cookies
    );
    assert.equal(created.statusCode, 200);
    assert.equal(created.body.ok, true);

    const lookup = await harness.request('GET', `/api/u-card/platforms/${chatgpt.id}/cards`);
    assert.equal(lookup.statusCode, 200);
    assert.deepEqual(lookup.body.items, [
      {
        id: created.body.item.id,
        name: 'Wild AI Card',
        bin: '438888',
        issuer_region: '美国'
      }
    ]);
  } finally {
    harness.cleanup();
  }
});

test('admin U card panel includes upstream credential configuration controls', () => {
  const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
  const adminJs = fs.readFileSync(adminJsPath, 'utf8');
  const uCardSection = adminHtml.match(/<div id="adminUCardSection"[\s\S]*?<div id="adminOrdersSection"/)?.[0] || '';

  assert.match(adminHtml, /<button id="navUCardUpstreamConfig"[\s\S]*U 卡上游配置/);
  assert.match(adminHtml, /<button id="navUCardProducts"[\s\S]*U 卡卡种配置/);
  assert.match(adminHtml, /<button id="navUCardApplications"[\s\S]*U 卡申请订单/);
  assert.doesNotMatch(uCardSection, /id="uCardNavUpstreamConfig"/);
  assert.match(adminHtml, /id="uCardUpstreamConfigSection"/);
  assert.match(adminHtml, /name="uCardUpalAppId"/);
  assert.match(adminHtml, /name="uCardUpalDeveloperPrivateKey"/);
  assert.match(adminHtml, /id="uCardGenerateDeveloperKeypairBtn"/);
  assert.match(adminHtml, /id="uCardTestUpstreamProductsBtn"/);
  assert.match(adminHtml, /name="uCardUpalCustomerPublicKey"/);
  assert.match(adminHtml, /name="uCardUpalPlatformPublicKey"/);
  assert.match(adminHtml, /id="uCardUpstreamConfigMessage"/);
  assert.match(adminJs, /\/api\/admin\/u-card\/upstream-config/);
  assert.match(adminJs, /\/api\/admin\/u-card\/upstream-config\/generate-keypair/);
  assert.match(adminJs, /\/api\/admin\/u-card\/upstream-config\/test-products/);
  assert.match(adminJs, /\/api\/admin\/u-card\/products/);
  assert.match(adminJs, /\/api\/admin\/u-card\/applications/);
  assert.match(adminJs, /saveUCardProductConfig/);
  assert.match(adminJs, /uCardProductSaveMessage-/);
  assert.match(adminJs, /inlineMessage\.textContent = t\('uCardProductSaved'\)/);
  assert.match(adminJs, /loadUCardApplicationsAdmin/);
  assert.match(adminJs, /setUCardUpstreamConfigMessage\(t\('uCardUpstreamConfigSaved'\), 'message success'\)/);
  assert.match(adminJs, /navUCardUpstreamConfig:\s*'U 卡上游配置'/);
  assert.match(adminJs, /navUCardProducts:\s*'U 卡卡种配置'/);
  assert.match(adminJs, /navUCardApplications:\s*'U 卡申请订单'/);
  assert.match(adminJs, /adminUCardUpstreamConfigSection\.classList\.toggle\('hidden', view !== 'u-card-upstream-config'\)/);
  assert.match(adminJs, /adminUCardProductsSection\.classList\.toggle\('hidden', view !== 'u-card-products'\)/);
  assert.match(adminJs, /adminUCardApplicationsSection\.classList\.toggle\('hidden', view !== 'u-card-applications'\)/);
  assert.match(adminJs, /keepUCardUpalDeveloperPrivateKey:\s*String\(payload\.uCardUpalDeveloperPrivateKey \|\| ''\)\.trim\(\) === SAVED_U_CARD_UPAL_PRIVATE_KEY_MASK/);
});

test('admin can save U card upstream credentials without private key disclosure', async () => {
  const harness = createHarness();
  try {
    const cookies = await loginAdmin(harness);

    const generated = await harness.request('POST', '/api/admin/u-card/upstream-config/generate-keypair', {}, cookies);
    assert.equal(generated.statusCode, 200);
    assert.equal(generated.body.ok, true);
    assert.match(generated.body.developerPrivateKey, /-----BEGIN PRIVATE KEY-----/);
    assert.match(generated.body.customerPublicKey, /-----BEGIN PUBLIC KEY-----/);

    const save = await harness.request(
      'PUT',
      '/api/admin/u-card/upstream-config',
      {
        appId: 'upal-app-001',
        developerPrivateKey: generated.body.developerPrivateKey,
        platformPublicKey: '-----BEGIN PUBLIC KEY-----\nplatform-key\n-----END PUBLIC KEY-----'
      },
      cookies
    );
    assert.equal(save.statusCode, 200);
    assert.equal(save.body.ok, true);
    assert.equal(save.body.appId, 'upal-app-001');
    assert.equal(save.body.developerPrivateKey, '');
    assert.equal(save.body.hasDeveloperPrivateKey, true);
    assert.equal(save.body.customerPublicKey, generated.body.customerPublicKey);

    const adminConfig = await harness.request('GET', '/api/admin/u-card/upstream-config', null, cookies);
    assert.equal(adminConfig.statusCode, 200);
    assert.equal(adminConfig.body.appId, 'upal-app-001');
    assert.equal(adminConfig.body.developerPrivateKey, '');
    assert.equal(adminConfig.body.hasDeveloperPrivateKey, true);
    assert.equal(adminConfig.body.customerPublicKey, generated.body.customerPublicKey);
    assert.match(adminConfig.body.platformPublicKey, /platform-key/);

    const keepSave = await harness.request(
      'PUT',
      '/api/admin/u-card/upstream-config',
      {
        appId: 'upal-app-002',
        developerPrivateKey: '',
        platformPublicKey: 'platform-public-key-2'
      },
      cookies
    );
    assert.equal(keepSave.statusCode, 200);
    assert.equal(keepSave.body.appId, 'upal-app-002');
    assert.equal(keepSave.body.hasDeveloperPrivateKey, true);
    assert.equal(keepSave.body.customerPublicKey, generated.body.customerPublicKey);

    const storedPrivateKey = harness.db.prepare("SELECT value FROM settings WHERE key = 'u_card_upal_developer_private_key'").get();
    assert.equal(storedPrivateKey.value, generated.body.developerPrivateKey);

    const maskedSave = await harness.request(
      'PUT',
      '/api/admin/u-card/upstream-config',
      {
        appId: 'upal-app-003',
        developerPrivateKey: '••••••••私钥已保存',
        keepUCardUpalDeveloperPrivateKey: true,
        platformPublicKey: 'platform-public-key-3'
      },
      cookies
    );
    assert.equal(maskedSave.statusCode, 200);
    const storedAfterMaskedSave = harness.db.prepare("SELECT value FROM settings WHERE key = 'u_card_upal_developer_private_key'").get();
    assert.equal(storedAfterMaskedSave.value, generated.body.developerPrivateKey);
  } finally {
    harness.cleanup();
  }
});

test('admin can edit U card platforms and cards', async () => {
  const harness = createHarness();
  try {
    const cookies = await loginAdmin(harness);
    const platforms = await harness.request('GET', '/api/admin/u-card/platforms', null, cookies);
    assert.equal(platforms.statusCode, 200);
    const chatgpt = platforms.body.items.find((item) => item.name === 'ChatGPT');
    const sora = platforms.body.items.find((item) => item.name === 'Sora');
    const telegram = platforms.body.items.find((item) => item.name === 'Telegram');

    const platformUpdate = await harness.request(
      'PUT',
      `/api/admin/u-card/platforms/${chatgpt.id}`,
      { name: 'ChatGPT Plus', sortOrder: 99, isEnabled: 1 },
      cookies
    );
    assert.equal(platformUpdate.statusCode, 200);
    assert.equal(platformUpdate.body.item.name, 'ChatGPT Plus');
    assert.equal(platformUpdate.body.item.sort_order, 99);

    const created = await harness.request(
      'POST',
      '/api/admin/u-card/cards',
      { name: 'Starter Card', bin: '411111', issuerRegion: '香港', platformIds: [sora.id] },
      cookies
    );
    assert.equal(created.statusCode, 200);

    const cardUpdate = await harness.request(
      'PUT',
      `/api/admin/u-card/cards/${created.body.item.id}`,
      { name: 'Pro Card', bin: '522222', issuerRegion: '新加坡', platformIds: [telegram.id], sortOrder: 12, isEnabled: 1 },
      cookies
    );
    assert.equal(cardUpdate.statusCode, 200);
    assert.equal(cardUpdate.body.item.name, 'Pro Card');
    assert.equal(cardUpdate.body.item.bin, '522222');
    assert.equal(cardUpdate.body.item.issuer_region, '新加坡');
    assert.deepEqual(cardUpdate.body.item.platforms.map((item) => item.name), ['Telegram']);

    const oldLookup = await harness.request('GET', `/api/u-card/platforms/${sora.id}/cards`);
    assert.equal(oldLookup.statusCode, 200);
    assert.deepEqual(oldLookup.body.items, []);

    const newLookup = await harness.request('GET', `/api/u-card/platforms/${telegram.id}/cards`);
    assert.equal(newLookup.statusCode, 200);
    assert.deepEqual(newLookup.body.items, [{ id: created.body.item.id, name: 'Pro Card', bin: '522222', issuer_region: '新加坡' }]);
  } finally {
    harness.cleanup();
  }
});

test('admin can delete U card platforms and cards', async () => {
  const harness = createHarness();
  try {
    const cookies = await loginAdmin(harness);
    const platforms = await harness.request('GET', '/api/admin/u-card/platforms', null, cookies);
    assert.equal(platforms.statusCode, 200);
    const chatgpt = platforms.body.items.find((item) => item.name === 'ChatGPT');
    const sora = platforms.body.items.find((item) => item.name === 'Sora');

    const created = await harness.request(
      'POST',
      '/api/admin/u-card/cards',
      { name: 'Delete Me Card', bin: '433333', platformIds: [chatgpt.id, sora.id] },
      cookies
    );
    assert.equal(created.statusCode, 200);

    const deleteCard = await harness.request('DELETE', `/api/admin/u-card/cards/${created.body.item.id}`, null, cookies);
    assert.equal(deleteCard.statusCode, 200);
    assert.equal(deleteCard.body.ok, true);

    const cardLookup = await harness.request('GET', `/api/u-card/platforms/${chatgpt.id}/cards`);
    assert.equal(cardLookup.statusCode, 200);
    assert.deepEqual(cardLookup.body.items, []);

    const tempPlatform = await harness.request(
      'POST',
      '/api/admin/u-card/platforms',
      { name: 'Temporary Platform', sortOrder: 200 },
      cookies
    );
    assert.equal(tempPlatform.statusCode, 200);

    const deletePlatform = await harness.request(
      'DELETE',
      `/api/admin/u-card/platforms/${tempPlatform.body.item.id}`,
      null,
      cookies
    );
    assert.equal(deletePlatform.statusCode, 200);
    assert.equal(deletePlatform.body.ok, true);

    const deletedLookup = await harness.request('GET', `/api/u-card/platforms/${tempPlatform.body.item.id}/cards`);
    assert.equal(deletedLookup.statusCode, 404);
  } finally {
    harness.cleanup();
  }
});

test('admin can sync U card data from the upstream Figma source', async () => {
  const harness = createHarness();
  const previousFetch = global.fetch;
  try {
    const cardTypes = Array.from({ length: 30 }, (_, index) => `unused-${index}`);
    cardTypes[23] = '493724';
    cardTypes[24] = '493710';
    cardTypes[25] = '4413';
    cardTypes[26] = '4565';
    cardTypes[27] = '5378';
    cardTypes[28] = '5157';
    cardTypes[29] = '5395';
    const rows = Array.from({ length: 58 }, (_, index) => {
      const cells = [`PLATFORM${index + 1}`, `平台${index + 1}`];
      for (let cellIndex = 2; cellIndex <= 27; cellIndex += 1) {
        cells.push('✓');
      }
      return cells.join('\t');
    }).join('\n');
    const componentSource = `const ru = \`${rows}\`, At = ${JSON.stringify(cardTypes)};`;

    global.fetch = async (url) => {
      const text = String(url).includes('/_components/')
        ? componentSource
        : '<html><head><link rel="preload" href="/_components/v2/test.js" as="script"></head></html>';
      return {
        ok: true,
        status: 200,
        async text() {
          return text;
        }
      };
    };

    const cookies = await loginAdmin(harness);
    const sync = await harness.request('POST', '/api/admin/u-card/sync-upstream', null, cookies);
    assert.equal(sync.statusCode, 200);
    assert.equal(sync.body.platformCount, 58);
    assert.equal(sync.body.cardCount, 7);

    const platforms = await harness.request('GET', '/api/u-card/platforms');
    assert.equal(platforms.body.items.length, 58);
    assert.equal(platforms.body.items[0].name, 'PLATFORM1 (平台1)');

    const lookup = await harness.request('GET', `/api/u-card/platforms/${platforms.body.items[0].id}/cards`);
    assert.equal(lookup.statusCode, 200);
    assert.deepEqual(
      lookup.body.items.map((item) => ({ name: item.name, bin: item.bin, issuer_region: item.issuer_region })),
      [
        { name: 'US 4413', bin: '4413', issuer_region: '美国' },
        { name: 'SG 493724', bin: '493724', issuer_region: '新加坡' },
        { name: 'SG 493710', bin: '493710', issuer_region: '新加坡' },
        { name: 'US 5378', bin: '5378', issuer_region: '美国' },
        { name: 'SG 4565', bin: '4565', issuer_region: '新加坡' },
        { name: 'SG 5395', bin: '5395', issuer_region: '新加坡' }
      ]
    );
  } finally {
    global.fetch = previousFetch;
    harness.cleanup();
  }
});
