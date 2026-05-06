const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const jsPath = path.join(__dirname, '..', 'public', 'main.js');
const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
const cssPath = path.join(__dirname, '..', 'public', 'styles.css');

test('home page boot performs a final list render after async bootstrap settles', () => {
  const js = fs.readFileSync(jsPath, 'utf8');

  assert.match(js, /function renderHomeSitesFromCurrentState\(/);
  assert.match(js, /const bootResults = await Promise\.allSettled\(\[loadSiteConfig\(\), loadCategories\(\), loadSites\(\{ limit: HOME_INITIAL_SITE_LIMIT \}\)\]\);/);
  assert.match(js, /const initialSitesFailed = bootResults\[2\]\?\.status === 'rejected';/);
  assert.match(js, /applyLanguage\(\);\s*renderHomeSitesFromCurrentState\(\);/);
});

test('home page retries a full site load when the first mobile bootstrap list is empty', () => {
  const js = fs.readFileSync(jsPath, 'utf8');

  assert.match(js, /function isDefaultHomeView\(\)/);
  assert.match(js, /let homeEmptyRecoveryAttempts = 0;/);
  assert.match(js, /if \(!siteItems\.length && isDefaultHomeView\(\) && homeEmptyRecoveryAttempts < 1\) \{/);
  assert.match(js, /homeEmptyRecoveryAttempts \+= 1;/);
  assert.match(js, /loadSites\(\{ background: true \}\)\.catch\(\(\) => \{/);
  assert.match(js, /const hasInitialHomeSites = getVisibleSiteItems\(homeAllSitesCache\.length \? homeAllSitesCache : allSitesCache\)\.length > 0;/);
  assert.match(js, /if \(initialSitesFailed \|\| \(!favoriteSitesOnly && !currentCategory && !searchInput\.value\.trim\(\) && !hasInitialHomeSites\)\) \{/);
  assert.match(js, /await loadSites\(\);/);
});

test('home page renders first category and site chunks synchronously and refreshes on pageshow', () => {
  const js = fs.readFileSync(jsPath, 'utf8');

  assert.match(js, /function renderCategories\([\s\S]*?appendChunk\(\);/);
  assert.match(js, /function renderSitesChunked\([\s\S]*?appendChunk\(\);/);
  assert.match(js, /window\.addEventListener\('pageshow', \(\) => \{\s*renderHomeSitesFromCurrentState\(\);\s*\}\);/);
});

test('home page submit navigation button uses concise Chinese text', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');

  assert.match(html, /<button id="openSubmitFormBtn" class="hero-nav-btn" type="button">提交<\/button>/);
  assert.match(js, /openSubmit:\s*'提交'/);
  assert.doesNotMatch(html, /<button id="openSubmitFormBtn" class="hero-nav-btn" type="button">免费提交<\/button>/);
});

test('home page mobile header places GitHub icon left of language icon', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(html, /<link rel="stylesheet" href="\/styles\.css\?v=20260507-01" \/>/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.hero-nav-btn--icon\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?right:\s*52px;[\s\S]*?top:\s*-54px;/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.lang-menu\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?right:\s*0;[\s\S]*?top:\s*-54px;/);
});
