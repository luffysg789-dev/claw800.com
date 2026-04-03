const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const EventEmitter = require('node:events');

const dbModulePath = path.join(__dirname, '..', 'src', 'db.js');
const serverModulePath = path.join(__dirname, '..', 'src', 'server.js');

function createHarness() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claw800-tigang-auth-api-'));
  const dbPath = path.join(tmpDir, 'claw800.db');
  const previousDbPath = process.env.CLAW800_DB_PATH;

  process.env.CLAW800_DB_PATH = dbPath;
  delete require.cache[require.resolve(dbModulePath)];
  delete require.cache[require.resolve(serverModulePath)];

  const db = require(dbModulePath);
  const app = require(serverModulePath);

  return {
    db,
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

test('tigang-master session sync sets a 30-day cookie and returns session payload', async () => {
  const harness = createHarness();

  try {
    const response = await harness.request('POST', '/api/tigang-master/session', {
      openId: 'tigang-open-id-1',
      sessionKey: 'tigang-session-key-1',
      nickname: 'Tigang User'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.session.openId, 'tigang-open-id-1');
    assert.match(response.headers['set-cookie'][0], /"maxAge":2592000000/);
  } finally {
    harness.cleanup();
  }
});

test('tigang-master current session reads from auth cookie', async () => {
  const harness = createHarness();

  try {
    const syncResponse = await harness.request('POST', '/api/tigang-master/session', {
      openId: 'tigang-open-id-2',
      sessionKey: 'tigang-session-key-2',
      nickname: 'Cookie Tigang'
    });
    const serialized = JSON.parse(syncResponse.headers['set-cookie'][0]);

    const response = await harness.request('GET', '/api/tigang-master/session', null, {
      cookies: {
        [serialized.name]: serialized.value
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.session.openId, 'tigang-open-id-2');
  } finally {
    harness.cleanup();
  }
});
