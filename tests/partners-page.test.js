const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(rootDir, 'public', 'index.html'), 'utf8');
const partnersHtmlPath = path.join(rootDir, 'public', 'partners.html');
const pandaDogDir = path.join(rootDir, 'public', 'panda-dog-thailand');
const mainJs = fs.readFileSync(path.join(rootDir, 'public', 'main.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(rootDir, 'public', 'admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(rootDir, 'public', 'admin.js'), 'utf8');
const partnersJs = fs.readFileSync(path.join(rootDir, 'public', 'partners.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(rootDir, 'src', 'server.js'), 'utf8');

test('home navigation links to the partners page', () => {
  assert.match(indexHtml, /id="partnersNavBtn"[^>]*href="\/partners\.html"[^>]*>合作伙伴<\/a>/);
  assert.match(mainJs, /partnersBtn:\s*'合作伙伴'/);
});

test('partners page lists Lucky Star as a partner from the partners API', () => {
  assert.equal(fs.existsSync(partnersHtmlPath), true);
  const partnersHtml = fs.readFileSync(partnersHtmlPath, 'utf8');

  assert.match(partnersHtml, /合作伙伴/);
  assert.match(partnersHtml, /\/api\/partners/);
  assert.match(partnersHtml, /LUCKY STAR INVESTMENT L\.L\.C/);
  assert.match(partnersHtml, /\/lucky-star\//);
});

test('partners page includes the Panda Dog Thailand partner and local website', () => {
  const partnersHtml = fs.readFileSync(partnersHtmlPath, 'utf8');

  assert.equal(fs.existsSync(path.join(pandaDogDir, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(pandaDogDir, 'styles.css')), true);
  assert.equal(fs.existsSync(path.join(pandaDogDir, 'script.js')), true);
  assert.equal(fs.existsSync(path.join(pandaDogDir, 'assets', 'brand-logo.png')), true);
  assert.match(partnersHtml, /Panda Dog Thailand/);
  assert.match(partnersHtml, /\/panda-dog-thailand\//);
});

test('Panda Dog hero keeps the three metrics and proof card in one row', () => {
  const pandaHtml = fs.readFileSync(path.join(pandaDogDir, 'index.html'), 'utf8');
  const pandaCss = fs.readFileSync(path.join(pandaDogDir, 'styles.css'), 'utf8');

  assert.match(pandaHtml, /<dl class="metric-row" aria-label="Service highlights">[\s\S]*data-i18n="metric\.services"[\s\S]*data-i18n="metric\.o2o"[\s\S]*data-i18n="metric\.production"[\s\S]*data-i18n="hero\.proofLineOne"[\s\S]*<\/dl>/);
  assert.match(pandaCss, /\.metric-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*1fr\);/);
  assert.doesNotMatch(pandaHtml, /<div class="hero-proof-card">/);
});

test('partners page uses the same card layout as the games hub', () => {
  const partnersHtml = fs.readFileSync(partnersHtmlPath, 'utf8');

  assert.match(partnersHtml, /<main class="games-page">/);
  assert.match(partnersHtml, /id="partnersList" class="games-grid"/);
  assert.match(partnersHtml, /<article class="game-card">/);
  assert.match(partnersHtml, /class="game-card__play"/);
  assert.match(partnersHtml, /<a class="game-card__play" href="\/lucky-star\/" target="_blank" rel="noopener">查看官网<\/a>/);
  assert.doesNotMatch(partnersHtml, /跳转新页面/);
  assert.match(partnersJs, /target="_blank" rel="noopener"/);
  assert.match(partnersJs, /查看官网/);
  assert.doesNotMatch(partnersJs, /跳转新页面/);
  assert.doesNotMatch(partnersHtml, /class="partners-intro"/);
});

test('admin panel includes partner list management entry points', () => {
  assert.match(adminHtml, /id="navPartners"/);
  assert.match(adminHtml, /id="adminPartnersSection"/);
  assert.match(adminHtml, /id="partnerForm"/);
  assert.match(adminHtml, /id="partnersList"/);
  assert.match(adminJs, /const adminPartnersSection = document\.getElementById\('adminPartnersSection'\);/);
  assert.match(adminJs, /requestTutorialJson\(\['\/api\/admin\/partners'\]/);
  assert.match(adminJs, /partnerForm\.addEventListener\('submit'/);
  assert.match(serverJs, /app\.get\('\/api\/partners'/);
  assert.match(serverJs, /app\.post\('\/api\/admin\/partners', requireAdmin,/);
  assert.match(serverJs, /app\.put\('\/api\/admin\/partners\/:id', requireAdmin,/);
});
