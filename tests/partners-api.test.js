const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const EventEmitter = require('node:events');

const dbModulePath = path.join(__dirname, '..', 'src', 'db.js');
const serverModulePath = path.join(__dirname, '..', 'src', 'server.js');

function createHarness() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claw800-partners-api-'));
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
        for (const [key, value] of params.entries()) req.query[key] = value;

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
      if (previousDbPath === undefined) delete process.env.CLAW800_DB_PATH;
      else process.env.CLAW800_DB_PATH = previousDbPath;
    }
  };
}

async function loginAdmin(harness) {
  const response = await harness.request('POST', '/api/admin/login', { password: '123456' });
  assert.equal(response.statusCode, 200);
  const [pair] = response.headers['set-cookie'][0].split(';');
  const [name, value] = pair.split('=');
  return { [name]: value };
}

test('public partners API seeds and returns Lucky Star', async () => {
  const harness = createHarness();
  try {
    const response = await harness.request('GET', '/api/partners');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.items[0].name, 'LUCKY STAR INVESTMENT L.L.C');
    assert.equal(response.body.items[0].url, '/lucky-star/');
    assert.equal(response.body.items[0].is_enabled, 1);
  } finally {
    harness.cleanup();
  }
});

test('admin can create and edit partners', async () => {
  const harness = createHarness();
  try {
    const cookies = await loginAdmin(harness);
    const created = await harness.request(
      'POST',
      '/api/admin/partners',
      { name: 'Partner A', description: 'Demo partner', url: 'https://partner.example', sortOrder: 88, isEnabled: 1 },
      cookies
    );
    assert.equal(created.statusCode, 200);
    assert.equal(created.body.item.name, 'Partner A');

    const updated = await harness.request(
      'PUT',
      `/api/admin/partners/${created.body.item.id}`,
      { name: 'Partner B', description: 'Updated', url: 'https://partner-b.example', sortOrder: 90, isEnabled: 0 },
      cookies
    );
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.item.name, 'Partner B');
    assert.equal(updated.body.item.is_enabled, 0);

    const adminList = await harness.request('GET', '/api/admin/partners', null, cookies);
    assert.equal(adminList.statusCode, 200);
    assert.ok(adminList.body.items.some((item) => item.name === 'Partner B'));

    const publicList = await harness.request('GET', '/api/partners');
    assert.equal(publicList.statusCode, 200);
    assert.equal(publicList.body.items.some((item) => item.name === 'Partner B'), false);
  } finally {
    harness.cleanup();
  }
});
