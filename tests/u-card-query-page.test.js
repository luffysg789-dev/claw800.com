const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const htmlPath = path.join(rootDir, 'public', 'u-card-query', 'index.html');
const cssPath = path.join(rootDir, 'public', 'u-card-query', 'style.css');
const jsPath = path.join(rootDir, 'public', 'u-card-query', 'script.js');

test('U card query page includes language toggle after platform count', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /<span id="platformCount">0<\/span>[\s\S]*?<div class="lang-toggle"/);
  assert.match(html, /id="langZh"[\s\S]*data-lang="zh"[\s\S]*>中<\/button>/);
  assert.match(html, /id="langEn"[\s\S]*data-lang="en"[\s\S]*EN/);
  assert.match(html, /\/u-card-query\/style\.css\?v=20260505-11/);
  assert.match(html, /\/u-card-query\/script\.js\?v=20260505-04/);
});

test('U card query script translates fixed UI and selected results', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /currentLang = localStorage\.getItem\('uCardQueryLang'\) === 'en' \? 'en' : 'zh'/);
  assert.match(js, /selectPlatform:\s*'Select'/);
  assert.match(js, /supportedCardsTitle:\s*\(name\) => `Cards that support \$\{name\}`/);
  assert.match(js, /clickPlatformHint:\s*'After clicking a platform, cards available for payment will appear here\.'/);
  assert.match(js, /\['微信', 'WeChat'\]/);
  assert.match(js, /fetch\('\/api\/translate'/);
  assert.match(js, /resultTitle\.textContent = platform \? t\('supportedCardsTitle', displayName\(platform\.name\)\) : t\('resultTitle'\)/);
  assert.match(js, /<span class="bin">\$\{escapeHtml\(t\('binPrefix'\)\)\} \$\{escapeHtml\(card\.bin\)\}<\/span>/);
});

test('U card query CSS styles the language toggle compactly', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /\.section-actions\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?gap:\s*8px;[\s\S]*?\}/);
  assert.match(css, /\.lang-toggle\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?\}/);
  assert.match(css, /\.lang-toggle-btn\.active\s*\{[\s\S]*?background:\s*var\(--brand\);[\s\S]*?color:\s*#fff;[\s\S]*?\}/);
});
