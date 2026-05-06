const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pageDir = path.join(__dirname, '..', 'public', 'lucky-star');
const htmlPath = path.join(pageDir, 'index.html');
const cssPath = path.join(pageDir, 'style.css');
const jsPath = path.join(pageDir, 'script.js');

function readHtml() {
  return fs.readFileSync(htmlPath, 'utf8');
}

test('lucky star corporate site files exist', () => {
  assert.equal(fs.existsSync(htmlPath), true);
  assert.equal(fs.existsSync(cssPath), true);
  assert.equal(fs.existsSync(jsPath), true);
});

test('lucky star corporate site includes core registration facts', () => {
  const html = readHtml();

  assert.match(html, /LUCKY STAR INVESTMENT L\.L\.C/);
  assert.match(html, /1324352/);
  assert.match(html, /2248245/);
  assert.match(html, /526077/);
  assert.match(html, /150,000 AED/);
  assert.match(html, /2026-03-13/);
});

test('lucky star corporate site exposes multilingual controls including Arabic', () => {
  const html = readHtml();
  const js = fs.readFileSync(jsPath, 'utf8');

  assert.match(html, /data-lang="zh"/);
  assert.match(html, /data-lang="en"/);
  assert.match(html, /data-lang="ar"/);
  assert.match(html, /data-zh=/);
  assert.match(html, /data-en=/);
  assert.match(html, /data-ar=/);
  assert.match(js, /language === 'ar'/);
  assert.match(js, /document\.documentElement\.dir = normalized === 'ar' \? 'rtl' : 'ltr';/);
});

test('lucky star corporate site references local image assets that exist', () => {
  const html = readHtml();
  const matches = [...html.matchAll(/src="(assets\/[^"]+\.jpg)"/g)].map((match) => match[1]);

  assert.ok(matches.length >= 6);

  for (const imagePath of matches) {
    assert.equal(fs.existsSync(path.join(pageDir, imagePath)), true, imagePath);
  }
});

test('lucky star corporate site links to the commercial license pdf', () => {
  const html = readHtml();
  const pdfPath = 'assets/commercial-license-1324352-2026-03-13.pdf';

  assert.match(html, /营业执照/);
  assert.match(html, /Commercial License/);
  assert.match(html, new RegExp(`href="${pdfPath}"`));
  assert.equal(fs.existsSync(path.join(pageDir, pdfPath)), true);
});

test('lucky star office gallery uses a six-image lightbox with next and previous controls', () => {
  const html = readHtml();
  const css = fs.readFileSync(cssPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');

  assert.equal([...html.matchAll(/class="gallery-item"/g)].length, 6);
  assert.match(html, /class="gallery-lightbox"/);
  assert.match(html, /data-lightbox-image/);
  assert.match(html, /data-lightbox-prev/);
  assert.match(html, /data-lightbox-next/);
  assert.match(html, /data-lightbox-close/);
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(css, /\.gallery img:first-child/);
  assert.match(js, /function openLightbox/);
  assert.match(js, /function showLightboxImage/);
  assert.match(js, /data-lightbox-next/);
  assert.match(js, /data-lightbox-prev/);
});

test('lucky star brand mark forms a less-than shaped two-leaf logo', () => {
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(css, /\.brand-mark::before/);
  assert.match(css, /\.brand-mark::after/);
  assert.match(css, /background:\s*var\(--red\)/);
  assert.match(css, /background:\s*var\(--green\)/);
  assert.match(css, /transform:\s*rotate\(-55deg\)/);
  assert.match(css, /transform:\s*rotate\(55deg\)/);
  assert.match(css, /transform-origin:\s*0 50%/);
  assert.match(css, /border-radius:\s*4px 999px 999px 4px/);
  assert.match(css, /\.brand-mark::before \{[\s\S]*?z-index:\s*2;/);
  assert.match(css, /\.brand-mark::after \{[\s\S]*?z-index:\s*1;/);
});

test('lucky star lightbox closes when clicking blank space around the image', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(js, /const clickedPreviewContent = event\.target\.closest\('\[data-lightbox-image\], button'\);/);
  assert.match(js, /if \(!clickedPreviewContent\) \{/);
  assert.match(js, /closeLightbox\(\);/);
  assert.match(css, /\.gallery-lightbox figure \{\s*display:\s*grid;\s*justify-items:\s*center;/);
  assert.match(css, /\.gallery-lightbox img \{\s*width:\s*auto;\s*max-width:\s*100%;/);
  assert.doesNotMatch(css, /\.gallery-lightbox img \{\s*width:\s*100%;/);
});

test('lucky star contact section does not expose the removed QQ email address', () => {
  const html = readHtml();

  assert.doesNotMatch(html, /298760024@qq\.com/);
  assert.doesNotMatch(html, /mailto:/);
});

test('lucky star profile section fills the left column with compact company facts', () => {
  const html = readHtml();
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(html, /class="section profile-section"/);
  assert.match(html, /class="profile-summary"/);
  assert.match(html, /注册地/);
  assert.match(html, /法律形式/);
  assert.match(html, /业务类型/);
  assert.match(css, /\.profile-summary \{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(css, /\.prose \{[\s\S]*?font-size:\s*15px;/);
});

test('lucky star site keeps the desktop layout on phone-sized screens', () => {
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(css, /body \{[\s\S]*?min-width:\s*1200px;/);
  assert.match(css, /\.site-header \{[\s\S]*?grid-template-columns:\s*1fr auto auto;/);
  assert.match(css, /\.hero \{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.02fr\) minmax\(320px,\s*0\.98fr\);/);
  assert.match(css, /\.gallery \{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
  assert.doesNotMatch(css, /@media \(max-width:/);
});
