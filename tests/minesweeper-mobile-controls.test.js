const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'minesweeper.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'minesweeper.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');

test('minesweeper mobile toolbar uses compact labels in html', () => {
  assert.match(html, /id="resetGameBtn">重新<\/button>/);
  assert.match(html, /data-level="beginner">初<\/button>/);
  assert.match(html, /data-level="intermediate">中<\/button>/);
  assert.match(html, /data-level="expert">高<\/button>/);
  assert.match(html, /id="flagModeBtn">插旗<\/button>/);
});

test('minesweeper flag button uses compact label in script', () => {
  assert.match(js, /flagModeBtn\.textContent = ['"`]插旗/);
  assert.doesNotMatch(js, /插旗模式：/);
});

test('minesweeper mobile toolbar uses single-row horizontal scrolling instead of squeezed five-column grid', () => {
  assert.match(css, /\.minesweeper-toolbar\s*\{[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.minesweeper-difficulties\s*\{[\s\S]*grid-auto-flow:\s*column/);
});
