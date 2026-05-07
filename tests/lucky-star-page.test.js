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
  const visibleHtml = html.replace(/href="[^"]+"/g, '');

  assert.match(html, /LUCKY STAR INVESTMENT L\.L\.C/);
  assert.match(html, /1324352/);
  assert.match(html, /2248245/);
  assert.match(html, /526077/);
  assert.match(html, /资本规模/);
  assert.match(html, /1\.5 亿美金/);
  assert.doesNotMatch(html, /注册资本/);
  assert.doesNotMatch(html, /150,000 AED/);
  assert.doesNotMatch(visibleHtml, /2026-03-13/);
  assert.doesNotMatch(visibleHtml, /2024-03-14/);
  assert.doesNotMatch(html, />有效期至</);
  assert.doesNotMatch(html, />登记日期</);
  assert.doesNotMatch(html, />到期日期</);
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
  const matches = [
    ...html.matchAll(/src="(assets\/[^"]+\.jpg)"/g),
    ...html.matchAll(/data-src="(assets\/[^"]+\.jpg)"/g)
  ].map((match) => match[1]);

  assert.ok(matches.length >= 6);

  for (const imagePath of matches) {
    assert.equal(fs.existsSync(path.join(pageDir, imagePath)), true, imagePath);
  }
});

test('lucky star gallery prioritizes the first image before deferred gallery images', () => {
  const html = readHtml();
  const js = fs.readFileSync(jsPath, 'utf8');

  assert.match(html, /<img src="assets\/reception\.jpg"[^>]*loading="eager"[^>]*fetchpriority="high"/);
  assert.match(html, /<img src="assets\/office-logo\.jpg"[^>]*loading="eager"[^>]*fetchpriority="high"/);
  assert.match(html, /<img data-src="assets\/lounge-screen\.jpg"[^>]*loading="lazy"/);
  assert.match(html, /<img data-src="assets\/city-lounge\.jpg"[^>]*loading="lazy"/);
  assert.match(html, /<img data-src="assets\/workspace\.jpg"[^>]*loading="lazy"/);
  assert.match(js, /function loadDeferredImage\(image\)/);
  assert.match(js, /function loadDeferredGalleryImages\(\)/);
  assert.match(js, /window\.requestIdleCallback/);
  assert.match(js, /loadDeferredImage\(activeImage\)/);
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

test('lucky star header uses the supplied image logo asset', () => {
  const html = readHtml();
  const css = fs.readFileSync(cssPath, 'utf8');
  const logoPath = path.join(pageDir, 'assets', 'lucky-star-logo.svg');
  const logoSvg = fs.readFileSync(logoPath, 'utf8');

  assert.equal(fs.existsSync(logoPath), true);
  assert.match(html, /<img class="brand-logo-image" src="assets\/lucky-star-logo\.svg" alt="LUCKY STAR INVESTMENT L\.L\.C logo"/);
  assert.doesNotMatch(html, /lucky-star-logo\.png/);
  assert.match(logoSvg, /<svg[^>]+viewBox="0 0 2508 627"/);
  assert.match(logoSvg, /<path/);
  assert.doesNotMatch(logoSvg, /<image/);
  assert.doesNotMatch(html, /class="brand-mark"/);
  assert.doesNotMatch(css, /\.brand-mark/);
  assert.match(css, /\.brand-logo-image/);
});

test('lucky star page uses the supplied standalone icon asset as favicon', () => {
  const html = readHtml();
  const iconPath = path.join(pageDir, 'assets', 'lucky-star-icon.png');

  assert.equal(fs.existsSync(iconPath), true);
  assert.match(html, /<link rel="icon" type="image\/png" href="assets\/lucky-star-icon\.png">/);
  assert.doesNotMatch(html, /lucky-star-icon\.svg/);
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
  const html = readHtml();
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(html, /<meta name="viewport" content="width=1200">/);
  assert.doesNotMatch(html, /user-scalable=no/);
  assert.doesNotMatch(html, /maximum-scale/);
  assert.match(css, /body \{[\s\S]*?min-width:\s*1200px;/);
  assert.match(css, /\.site-header \{[\s\S]*?grid-template-columns:\s*1fr auto auto;/);
  assert.match(css, /\.hero \{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.02fr\) minmax\(320px,\s*0\.98fr\);/);
  assert.match(css, /\.gallery \{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
  assert.doesNotMatch(css, /@media \(max-width:/);
});
