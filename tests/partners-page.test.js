const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(rootDir, 'public', 'index.html'), 'utf8');
const partnersHtmlPath = path.join(rootDir, 'public', 'partners.html');
const mainJs = fs.readFileSync(path.join(rootDir, 'public', 'main.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(rootDir, 'public', 'admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(rootDir, 'public', 'admin.js'), 'utf8');
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
