const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'minesweeper.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'minesweeper.js'), 'utf8');

test('minesweeper mobile toolbar uses compact labels in html', () => {
  assert.match(html, /id="resetGameBtn">重新<\/button>/);
  assert.match(html, />初<\/button>/);
  assert.match(html, />中<\/button>/);
  assert.match(html, />高<\/button>/);
});

test('minesweeper flag button uses compact label in script', () => {
  assert.match(js, /flagModeBtn\.textContent = `插旗/);
  assert.doesNotMatch(js, /插旗模式：/);
});
