const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const configPath = path.join(rootDir, 'public', 'games-config.js');
const dbPath = path.join(rootDir, 'src', 'db.js');
const serverPath = path.join(rootDir, 'src', 'server.js');
const htmlPath = path.join(rootDir, 'public', 'p-mining', 'index.html');
const cssPath = path.join(rootDir, 'public', 'p-mining', 'style.css');
const jsPath = path.join(rootDir, 'public', 'p-mining', 'script.js');

test('p-mining stays as a standalone page config and route, but is hidden from the games hub', () => {
  const config = fs.readFileSync(configPath, 'utf8');
  const db = fs.readFileSync(dbPath, 'utf8');
  const server = fs.readFileSync(serverPath, 'utf8');

  assert.match(config, /slug:\s*'p-mining'/);
  assert.match(config, /name:\s*'P-Mining'/);
  assert.match(config, /route:\s*'\/p-mining\/'/);
  assert.match(config, /showInGamesHub:\s*0/);
  assert.match(db, /slug:\s*'p-mining'/);
  assert.match(server, /'p-mining':\s*'\/p-mining\/'/);
});

test('p-mining html includes host header, tab panels, and script mounts', () => {
  assert.equal(fs.existsSync(htmlPath), true);

  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /<title>Claw800 P-Mining<\/title>/);
  assert.match(html, /data-p-mining-app/);
  assert.match(html, /id="pMiningHostStatus"/);
  assert.match(html, /data-locale-toggle="en"/);
  assert.match(html, /data-locale-toggle="zh"/);
  assert.match(html, /data-tab="mining"/);
  assert.match(html, /data-tab="invite"/);
  assert.match(html, /data-tab="records"/);
  assert.match(html, /data-tab="profile"/);
  assert.match(html, /id="pMiningClaimButton"/);
  assert.match(html, /class="p-mining-claim-ring"/);
  assert.match(html, /class="p-mining-claim-ring__mine-icon"/);
  assert.match(html, /id="pMiningClaimCountdown">60</);
  assert.doesNotMatch(html, /id="pMiningClaimCountdown">00:00:00</);
  assert.match(html, /id="pMiningStatsGrid"/);
  assert.match(html, /data-record-filter="claims"/);
  assert.match(html, /data-record-filter="invites"/);
  assert.match(html, /data-record-filter="power"/);
  assert.match(html, /\/games-config\.js/);
  assert.match(html, /\/p-mining\/script\.js/);
});

test('p-mining css includes dark glass tokens, bottom nav, and circular claim layout', () => {
  assert.equal(fs.existsSync(cssPath), true);

  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(css, /--p-mining-accent:\s*#F27D26/i);
  assert.match(css, /--p-mining-power:\s*#/);
  assert.match(css, /\.p-mining-balance-card\s*\{/);
  assert.match(css, /\.p-mining-claim-ring\s*\{/);
  assert.match(css, /\.p-mining-claim-ring__countdown\s*\{[\s\S]*color:\s*var\(--p-mining-text\);/);
  assert.match(css, /\.p-mining-nav\s*\{/);
  assert.match(css, /\.p-mining-nav__item\.is-active/);
  assert.match(css, /\.p-mining-stats-grid\s*\{/);
  assert.match(css, /\.p-mining-page:not\(\.is-ready\)\s+\.p-mining-claim-ring__countdown\s*\{/);
  assert.match(css, /\.p-mining-header\s*\{[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*space-between;/);
  assert.match(css, /\.p-mining-header__actions\s*\{[\s\S]*margin-left:\s*auto;/);
  assert.match(css, /\.p-mining-host-status\s*\{[\s\S]*border-radius:\s*999px;/);
  assert.match(css, /\.p-mining-locale-toggle__button\.is-active/);
  assert.match(css, /backdrop-filter:\s*blur\(/);
  assert.match(css, /padding-bottom:\s*calc\(.*env\(safe-area-inset-bottom\)/);
});

test('p-mining html includes the expected mining, invite, records, and profile sections', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /data-i18n="currentHoldings"/);
  assert.match(html, /data-i18n="estimatedPerMinute"/);
  assert.match(html, /data-i18n="enterInviteCode"/);
  assert.match(html, /data-i18n="inviteFriends"/);
  assert.match(html, /data-i18n="claimRecords"/);
  assert.match(html, /data-i18n="currentTotalPoints"/);
  assert.match(html, /Every 4 Years \(Next\)/);
  assert.match(html, /P is Pay，P is People，P没有用，是我们的见证，当参与的人数超过 1000 万人时，说不定是一场伟大的胜利。/);
});

test('p-mining script includes the expected UI hooks', () => {
  assert.equal(fs.existsSync(jsPath), true);

  const js = fs.readFileSync(jsPath, 'utf8');

  assert.match(js, /const LOCALE_STORAGE_KEY = 'claw800:p-mining:locale';/);
  assert.match(js, /function toggleLanguage\(/);
  assert.match(js, /function applyTranslations\(/);
  assert.match(js, /function switchTab\(/);
  assert.match(js, /function renderClaimState\(/);
  assert.match(js, /function handleClaimButtonClick\(/);
  assert.match(js, /function handleInviteSubmit\(/);
  assert.match(js, /function handleCopyInviteCode\(/);
  assert.match(js, /function renderRecordsPanel\(/);
  assert.match(js, /function renderProfilePanel\(/);
  assert.match(js, /root\.classList\.add\('is-ready'\);/);
  assert.match(js, /window\.setInterval\(/);
});

test('p-mining script only refreshes cooldown on interval without auto-advancing network stats', () => {
  const js = fs.readFileSync(jsPath, 'utf8');

  assert.match(js, /window\.setInterval\(\(\)\s*=>\s*\{\s*renderClaimState\(appState\);\s*\},\s*1000\);/);
});
