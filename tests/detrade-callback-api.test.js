const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const EventEmitter = require('node:events');

const dbModulePath = path.join(__dirname, '..', 'src', 'db.js');
const serverModulePath = path.join(__dirname, '..', 'src', 'server.js');

function createHarness() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claw800-detrade-callback-api-'));
  const dbPath = path.join(tmpDir, 'claw800.db');
  const previousDbPath = process.env.CLAW800_DB_PATH;

  process.env.CLAW800_DB_PATH = dbPath;
  delete require.cache[require.resolve(dbModulePath)];
  delete require.cache[require.resolve(serverModulePath)];

  const db = require(dbModulePath);
  const app = require(serverModulePath);

  return {
    db,
    async request(method, routePath, body) {
      return new Promise((resolve, reject) => {
        const req = new EventEmitter();
        req.method = method;
        req.url = routePath;
        req.originalUrl = routePath;
        req.headers = {};
        req.connection = {};
        req.socket = {};
        req.body = body;
        req.query = {};
        req.cookies = {};

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
        res.status = function status(code) {
          this.statusCode = code;
          return this;
        };
        res.json = function json(payload) {
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

function seedWallet(db, { userId = '1727404213474304', balance = '100.00' } = {}) {
  const result = db
    .prepare("INSERT INTO game_users (openid, nickname, avatar) VALUES (?, 'Detrade User', '')")
    .run(userId);
  db.prepare(
    "INSERT INTO game_wallets (user_id, currency, available_balance, frozen_balance) VALUES (?, 'USDT', ?, '0.00')"
  ).run(result.lastInsertRowid, balance);
  return Number(result.lastInsertRowid);
}

function getWallet(db, userId) {
  return db.prepare('SELECT available_balance, frozen_balance FROM game_wallets WHERE user_id = ?').get(userId);
}

test('Detrade balance endpoint returns the user USDT wallet balance', async () => {
  const harness = createHarness();
  seedWallet(harness.db, { balance: '42.50' });

  try {
    const response = await harness.request('GET', '/wallet/balance?currency=USDT&userId=1727404213474304');

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.code, 200);
    assert.deepEqual(response.body.data, {
      currency: 'USDT',
      balance: '42.50'
    });
  } finally {
    harness.cleanup();
  }
});

test('Detrade deduction debits once and returns idempotent success for repeated callback', async () => {
  const harness = createHarness();
  const localUserId = seedWallet(harness.db, { balance: '100.00' });
  const payload = {
    userId: '1727404213474304',
    amount: '12.34',
    currency: 'USDT',
    bizId: 'predict-order-1',
    bizType: 'PREDICT_ORDER',
    source: 'PLACE_PREDICT_ORDER',
    bizSubId: 'fill-1',
    balanceType: 1
  };

  try {
    const first = await harness.request('POST', '/wallet/amount/deduction', payload);
    const second = await harness.request('POST', '/wallet/amount/deduction', payload);

    assert.equal(first.statusCode, 200);
    assert.equal(first.body.code, 200);
    assert.equal(first.body.data.usdAmount, '12.34');
    assert.equal(second.statusCode, 200);
    assert.equal(second.body.code, 200);
    assert.equal(getWallet(harness.db, localUserId).available_balance, '87.66');
    const ledgers = harness.db
      .prepare("SELECT type, amount, balance_after, related_type, related_id FROM game_wallet_ledger WHERE user_id = ?")
      .all(localUserId);
    assert.equal(ledgers.length, 1);
    assert.deepEqual(ledgers[0], {
      type: 'detrade_deduction',
      amount: '-12.34',
      balance_after: '87.66',
      related_type: 'detrade',
      related_id: 'predict-order-1:fill-1:PLACE_PREDICT_ORDER'
    });
  } finally {
    harness.cleanup();
  }
});

test('Detrade deduction returns balance not enough without changing wallet', async () => {
  const harness = createHarness();
  const localUserId = seedWallet(harness.db, { balance: '3.00' });

  try {
    const response = await harness.request('POST', '/wallet/amount/deduction', {
      userId: '1727404213474304',
      amount: '5.00',
      currency: 'USDT',
      bizId: 'predict-order-2',
      bizType: 'PREDICT_ORDER',
      source: 'PLACE_PREDICT_ORDER',
      bizSubId: 'fill-2'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.code, 30002);
    assert.equal(getWallet(harness.db, localUserId).available_balance, '3.00');
  } finally {
    harness.cleanup();
  }
});

test('Detrade add credits once after matching deduction exists', async () => {
  const harness = createHarness();
  const localUserId = seedWallet(harness.db, { balance: '100.00' });

  try {
    await harness.request('POST', '/wallet/amount/deduction', {
      userId: '1727404213474304',
      amount: '20.00',
      currency: 'USDT',
      bizId: 'predict-order-3',
      bizType: 'PREDICT_ORDER',
      source: 'PLACE_PREDICT_ORDER',
      bizSubId: 'buy-1'
    });

    const payload = {
      userId: '1727404213474304',
      amount: '7.50',
      currency: 'USDT',
      bizId: 'predict-order-3',
      bizType: 'PREDICT_ORDER',
      source: 'PREDICT_ORDER_SELL',
      bizSubId: 'sell-1'
    };
    const first = await harness.request('POST', '/wallet/amount/add', payload);
    const second = await harness.request('POST', '/wallet/amount/add', payload);

    assert.equal(first.statusCode, 200);
    assert.equal(first.body.code, 200);
    assert.equal(second.body.code, 200);
    assert.equal(getWallet(harness.db, localUserId).available_balance, '87.50');
    const addRows = harness.db.prepare("SELECT COUNT(*) AS c FROM game_wallet_ledger WHERE type = 'detrade_add'").get();
    assert.equal(addRows.c, 1);
  } finally {
    harness.cleanup();
  }
});

test('Detrade settlement add rejects when matching deduction does not exist', async () => {
  const harness = createHarness();
  seedWallet(harness.db, { balance: '100.00' });

  try {
    const response = await harness.request('POST', '/wallet/amount/add', {
      userId: '1727404213474304',
      amount: '7.50',
      currency: 'USDT',
      bizId: 'missing-order',
      bizType: 'PREDICT_ORDER',
      source: 'PREDICT_ORDER_SELL',
      bizSubId: 'sell-1'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.code, 30015);
  } finally {
    harness.cleanup();
  }
});

test('Detrade order push and risk report are stored idempotently enough for callbacks', async () => {
  const harness = createHarness();
  seedWallet(harness.db);

  try {
    const order = await harness.request('POST', '/order/push', {
      id: 'order-push-1',
      userId: '1727404213474304',
      currency: 'USDT',
      amount: '10.00',
      profit: '1.23',
      bizType: 6,
      status: 1,
      symbol: 'BTCUSDT'
    });
    const risk = await harness.request('POST', '/wallet/risk/report', {
      userId: '1727404213474304',
      riskStatus: 'REQUIRED_BASIC_KYC',
      desc: 'test risk'
    });

    assert.equal(order.body.code, 200);
    assert.equal(risk.body.code, 200);
    assert.equal(harness.db.prepare('SELECT COUNT(*) AS c FROM detrade_order_pushes').get().c, 1);
    assert.equal(harness.db.prepare('SELECT COUNT(*) AS c FROM detrade_risk_reports').get().c, 1);
  } finally {
    harness.cleanup();
  }
});
