const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'muyu.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'muyu.js'), 'utf8');

test('woodfish page uses dedicated lightweight stylesheet', () => {
  assert.match(html, /href="\/muyu\.css\?v=/);
  assert.doesNotMatch(html, /href="\/styles\.css\?v=/);
});

test('woodfish page no longer loads shared games bootstrap script', () => {
  assert.doesNotMatch(html, /src="\/games-config\.js\?v=/);
});

test('woodfish boot uses lightweight bootstrap config first', () => {
  assert.match(js, /fetchBootstrapConfig/);
  assert.match(js, /\/api\/games\/\$\{encodeURIComponent\(GAME_SLUG\)\}\/bootstrap/);
});
