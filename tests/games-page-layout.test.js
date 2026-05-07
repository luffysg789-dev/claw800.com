const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const config = fs.readFileSync(path.join(rootDir, 'public', 'games-config.js'), 'utf8');
const css = fs.readFileSync(path.join(rootDir, 'public', 'styles.css'), 'utf8');
const gamesHtml = fs.readFileSync(path.join(rootDir, 'public', 'games.html'), 'utf8');

test('games page uses unified start button text for all game cards', () => {
  assert.match(config, /sbti:\s*'开始测试'/);
  assert.match(config, /gomoku:\s*'开始游戏'/);
  assert.match(config, /minesweeper:\s*'开始游戏'/);
  assert.match(config, /fortune:\s*'开始游戏'/);
  assert.match(config, /muyu:\s*'开始游戏'/);
});

test('games page loads the latest game config bundle and keeps piano cards on /piano/', () => {
  assert.match(gamesHtml, /<script src="\/games-config\.js\?v=20260507-01"><\/script>/);
  assert.match(config, /slug:\s*'piano'[\s\S]*route:\s*'\/piano\/'/);
  assert.match(config, /if \(fallback\.route\) \{[\s\S]*const legacyRoute = `\/games\/\$\{encodeURIComponent\(slug\)\}`;[\s\S]*if \(!route \|\| route === legacyRoute\) route = fallback\.route;/);
});

test('games page keeps the Lucky Star corporate site out of the public games hub', () => {
  const match = config.match(/\{\s*slug:\s*'lucky-star'[\s\S]*?\n\s*\},/);
  assert.ok(match);
  const luckyStarBlock = match[0];
  assert.match(luckyStarBlock, /name:\s*'LUCKY STAR INVESTMENT'/);
  assert.match(luckyStarBlock, /route:\s*'\/lucky-star\/'/);
  assert.match(luckyStarBlock, /showInGamesHub:\s*0/);
  assert.doesNotMatch(luckyStarBlock, /showInGamesHub:\s*1/);
});

test('games page navigation links to the partners page', () => {
  assert.match(gamesHtml, /id="partnersNavBtn"[^>]*href="\/partners\.html"[^>]*>伙伴<\/a>/);
});

test('games page keeps language and GitHub controls in the menu', () => {
  assert.match(gamesHtml, /id="homeNavBtn"[^>]*href="\/"/);
  assert.match(gamesHtml, /id="skillsNavBtn"[^>]*href="\/skills\.html"/);
  assert.match(gamesHtml, /id="gamesNavBtn"[^>]*class="hero-nav-btn active"[^>]*href="\/games\.html"/);
  assert.match(gamesHtml, /id="partnersNavBtn"[^>]*href="\/partners\.html"/);
  assert.match(gamesHtml, /<button id="openSubmitFormBtn" class="hero-nav-btn" type="button">提交<\/button>/);
  assert.doesNotMatch(gamesHtml, /id="openSubmitFormBtn"[^>]*hidden/);
  assert.doesNotMatch(gamesHtml, /id="openSubmitFormBtn"[^>]*class="[^"]*hidden/);
  assert.match(gamesHtml, /id="githubStarBtn"[\s\S]*href="https:\/\/github\.com\/luffysg789-dev\/claw800\.com"/);
  assert.match(gamesHtml, /id="langMenuBtn"/);
  assert.match(gamesHtml, /class="lang-option" data-lang="en"/);
  assert.match(gamesHtml, /class="lang-option" data-lang="zh"/);
  assert.match(gamesHtml, /id="submitModal"/);
  assert.match(gamesHtml, /<script src="\/submit-modal\.js/);
  assert.match(gamesHtml, /<script src="\/menu-i18n\.js/);
});

test('English navigation labels the games hub as Tools', () => {
  const mainJs = fs.readFileSync(path.join(rootDir, 'public', 'main.js'), 'utf8');
  const skillsJs = fs.readFileSync(path.join(rootDir, 'public', 'skills.js'), 'utf8');
  const menuI18nJs = fs.readFileSync(path.join(rootDir, 'public', 'menu-i18n.js'), 'utf8');

  assert.match(mainJs, /gamesBtn:\s*'Tools'/);
  assert.match(skillsJs, /gamesBtn:\s*'Tools'/);
  assert.match(menuI18nJs, /gamesBtn:\s*'Tools'/);
  assert.match(menuI18nJs, /openSubmit:\s*'Submit'/);
  assert.match(menuI18nJs, /initSubmitModal/);
  assert.doesNotMatch(mainJs, /gamesBtn:\s*'Games & Tools'/);
  assert.doesNotMatch(skillsJs, /gamesBtn:\s*'Games & Tools'/);
  assert.doesNotMatch(menuI18nJs, /gamesBtn:\s*'Games & Tools'/);
});

test('games page translates card content when English is selected', () => {
  assert.match(config, /const GAME_I18N = \{/);
  assert.match(config, /'u-card-query':\s*\{[\s\S]*name:\s*'U Card Scenario Lookup'/);
  assert.match(config, /sbti:\s*\{[\s\S]*description:\s*'A lightweight 31-question personality test/);
  assert.match(config, /muyu:\s*\{[\s\S]*actionText:\s*'Start'/);
  assert.match(config, /function getCurrentMenuLang\(\)/);
  assert.match(config, /window\.addEventListener\('claw800-language-change', \(\) => \{/);
  assert.match(config, /grid\.innerHTML = renderGamesGrid\(items\);/);
});

test('games page keeps standalone pages like p-mining out of the public games hub', () => {
  assert.match(config, /slug:\s*'p-mining'[\s\S]*showInGamesHub:\s*0/);
  assert.match(config, /slug:\s*'sbti'[\s\S]*showInGamesHub:\s*1/);
  assert.match(config, /\.filter\(\(item\) => item\.is_enabled && item\.slug !== 'xiangqi' && item\.showInGamesHub !== 0\)/);
});

test('games page cards stretch body and keep actions aligned at the bottom', () => {
  assert.match(css, /\.game-card\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/);
  assert.match(css, /\.game-card__body\s*\{[\s\S]*flex:\s*1 1 auto;/);
  assert.match(css, /\.game-card__actions\s*\{[\s\S]*margin-top:\s*auto;/);
});

test('games page cards do not render collection icons or cover thumbnails', () => {
  assert.doesNotMatch(config, /const coverMarkup = buildGameCardMediaMarkup/);
  assert.doesNotMatch(config, /\$\{coverMarkup\}/);
  assert.doesNotMatch(config, /<div class="game-card__icon"/);
  assert.doesNotMatch(config, /<div class="game-card__cover"/);
});
