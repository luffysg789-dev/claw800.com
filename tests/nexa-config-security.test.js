const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const serverJs = fs.readFileSync(path.join(rootDir, 'src', 'server.js'), 'utf8');
const nexaPayJs = fs.readFileSync(path.join(rootDir, 'src', 'nexa-pay.js'), 'utf8');
const publicFiles = [
  path.join(rootDir, 'public', 'game-tip.js'),
  path.join(rootDir, 'public', 'p-mining', 'script.js'),
  path.join(rootDir, 'public', 'tigang-master', 'script.js'),
  path.join(rootDir, 'public', 'xiangqi', 'script.js')
].map((filePath) => ({
  filePath,
  source: fs.readFileSync(filePath, 'utf8')
}));

test('server exposes a public Nexa config endpoint for browser auth flows', () => {
  assert.match(serverJs, /app\.get\('\/api\/nexa\/public-config'/);
  assert.match(serverJs, /apiKey:\s*credentials\.apiKey/);
});

test('nexa-pay server config no longer hardcodes production secrets as source defaults', () => {
  assert.doesNotMatch(nexaPayJs, /NEXA2033522880098676737/);
  assert.doesNotMatch(nexaPayJs, /0eebb98fa14d403d8567f0bf5bb5dd80TOSPAMDN/);
  assert.match(nexaPayJs, /process\.env\.NEXA_API_KEY \|\| ''/);
  assert.match(nexaPayJs, /process\.env\.NEXA_APP_SECRET \|\| ''/);
});

test('browser game scripts do not hardcode the Nexa API key anymore', () => {
  for (const entry of publicFiles) {
    assert.doesNotMatch(entry.source, /NEXA2033522880098676737/, entry.filePath);
    assert.doesNotMatch(entry.source, /const NEXA_API_KEY = /, entry.filePath);
    assert.match(entry.source, /\/api\/nexa\/public-config/, entry.filePath);
  }
});
