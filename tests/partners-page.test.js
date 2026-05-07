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
const skillsHtml = fs.readFileSync(path.join(rootDir, 'public', 'skills.html'), 'utf8');
const skillsJs = fs.readFileSync(path.join(rootDir, 'public', 'skills.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(rootDir, 'src', 'server.js'), 'utf8');

test('home navigation links to the partners page', () => {
  assert.match(indexHtml, /id="partnersNavBtn"[^>]*href="\/partners\.html"[^>]*>伙伴<\/a>/);
  assert.match(mainJs, /partnersBtn:\s*'伙伴'/);
  assert.match(skillsHtml, /id="partnersNavBtn"[^>]*href="\/partners\.html"[^>]*>伙伴<\/a>/);
  assert.match(skillsJs, /partnersBtn:\s*'伙伴'/);
  assert.match(skillsJs, /openSubmit:\s*'Submit'/);
  assert.doesNotMatch(skillsJs, /openSubmit:\s*'Submit for Free'/);
});

test('partners page lists Lucky Star as a partner from the partners API', () => {
  assert.equal(fs.existsSync(partnersHtmlPath), true);
  const partnersHtml = fs.readFileSync(partnersHtmlPath, 'utf8');

  assert.match(partnersHtml, /伙伴/);
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

test('Panda Dog hero does not show the metric and proof cards', () => {
  const pandaHtml = fs.readFileSync(path.join(pandaDogDir, 'index.html'), 'utf8');
  const pandaCss = fs.readFileSync(path.join(pandaDogDir, 'styles.css'), 'utf8');

  assert.doesNotMatch(pandaHtml, /class="metric-row"/);
  assert.doesNotMatch(pandaHtml, /class="hero-proof-card"/);
  assert.doesNotMatch(pandaHtml, />5<\/dt>/);
  assert.doesNotMatch(pandaHtml, />O2O<\/dt>/);
  assert.doesNotMatch(pandaHtml, />360<\/dt>/);
  assert.doesNotMatch(pandaHtml, /data-i18n="hero\.proofLineOne"/);
  assert.doesNotMatch(pandaCss, /\.metric-row/);
  assert.doesNotMatch(pandaCss, /\.hero-proof-card/);
});

test('Panda Dog hero action buttons sit five pixels higher for all languages', () => {
  const pandaCss = fs.readFileSync(path.join(pandaDogDir, 'styles.css'), 'utf8');

  assert.match(pandaCss, /\.hero-actions\s*\{[\s\S]*?margin-top:\s*21px;/);
});

test('Panda Dog navigation highlights the active item in gold by default', () => {
  const pandaHtml = fs.readFileSync(path.join(pandaDogDir, 'index.html'), 'utf8');
  const pandaCss = fs.readFileSync(path.join(pandaDogDir, 'styles.css'), 'utf8');

  assert.match(pandaHtml, /<a class="active" href="#about" data-i18n="nav\.about">About<\/a>/);
  assert.match(pandaCss, /\.site-nav a:hover,\s*\.site-nav a\.active\s*\{[\s\S]*?background:\s*var\(--gold\);[\s\S]*?color:\s*var\(--ink\);/);
});

test('partners page uses the same card layout as the games hub', () => {
  const partnersHtml = fs.readFileSync(partnersHtmlPath, 'utf8');

  assert.match(partnersHtml, /<main class="games-page">/);
  assert.match(partnersHtml, /id="partnersList" class="games-grid"/);
  assert.match(partnersHtml, /<article class="game-card">/);
  assert.match(partnersHtml, /class="game-card__play"/);
  assert.match(partnersHtml, /<a class="game-card__play" href="\/lucky-star\/" target="_blank" rel="noopener">查看官网<\/a>/);
  assert.doesNotMatch(partnersHtml, /class="game-card__(icon|cover)"/);
  assert.doesNotMatch(partnersHtml, /<img[^>]+brand-logo\.png/);
  assert.doesNotMatch(partnersHtml, />LS<\/div>/);
  assert.doesNotMatch(partnersJs, /partnerInitials/);
  assert.doesNotMatch(partnersJs, /game-card__(icon|cover)/);
  assert.doesNotMatch(partnersJs, /<img/);
  assert.doesNotMatch(partnersHtml, /跳转新页面/);
  assert.match(partnersJs, /target="_blank" rel="noopener"/);
  assert.match(partnersJs, /查看官网/);
  assert.match(partnersJs, /Visit Website/);
  assert.doesNotMatch(partnersJs, /跳转新页面/);
  assert.doesNotMatch(partnersHtml, /class="partners-intro"/);
});

test('partners page translates partner content when English is selected', () => {
  assert.match(partnersJs, /const PARTNER_I18N = \{/);
  assert.match(partnersJs, /'LUCKY STAR INVESTMENT L\.L\.C':\s*\{[\s\S]*description:\s*'Dubai-registered investment company/);
  assert.match(partnersJs, /'Panda Dog Thailand':\s*\{[\s\S]*description:\s*'Thailand Live Commerce/);
  assert.match(partnersJs, /function getCurrentMenuLang\(\)/);
  assert.match(partnersJs, /window\.addEventListener\('claw800-language-change', \(\) => \{/);
  assert.match(partnersJs, /renderPartners\(currentPartners\);/);
});

test('partners page keeps language and GitHub controls in the menu', () => {
  const partnersHtml = fs.readFileSync(partnersHtmlPath, 'utf8');
  const menuI18nJs = fs.readFileSync(path.join(rootDir, 'public', 'menu-i18n.js'), 'utf8');

  assert.match(partnersHtml, /id="homeNavBtn"[^>]*href="\/"/);
  assert.match(partnersHtml, /id="skillsNavBtn"[^>]*href="\/skills\.html"/);
  assert.match(partnersHtml, /id="gamesNavBtn"[^>]*href="\/games\.html"/);
  assert.match(partnersHtml, /id="partnersNavBtn"[^>]*class="hero-nav-btn active"[^>]*href="\/partners\.html"/);
  assert.match(partnersHtml, /<button id="openSubmitFormBtn" class="hero-nav-btn" type="button">提交<\/button>/);
  assert.doesNotMatch(partnersHtml, /id="openSubmitFormBtn"[^>]*hidden/);
  assert.doesNotMatch(partnersHtml, /id="openSubmitFormBtn"[^>]*class="[^"]*hidden/);
  assert.match(partnersHtml, /id="githubStarBtn"[\s\S]*href="https:\/\/github\.com\/luffysg789-dev\/claw800\.com"/);
  assert.match(partnersHtml, /id="langMenuBtn"/);
  assert.match(partnersHtml, /class="lang-option" data-lang="en"/);
  assert.match(partnersHtml, /class="lang-option" data-lang="zh"/);
  assert.match(partnersHtml, /id="submitModal"/);
  assert.match(partnersHtml, /<script src="\/submit-modal\.js/);
  assert.match(partnersHtml, /<script src="\/menu-i18n\.js/);
  assert.match(menuI18nJs, /openSubmit:\s*'提交'/);
  assert.match(menuI18nJs, /openSubmit:\s*'Submit'/);
  assert.match(menuI18nJs, /initSubmitModal/);
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
