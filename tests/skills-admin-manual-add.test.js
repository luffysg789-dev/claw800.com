const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.js'), 'utf8');
const skillsJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'skills.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');

test('admin page includes manual skill add form fields', () => {
  assert.match(adminHtml, /id="adminSkillsCreateSection"/);
  assert.match(adminHtml, /id="adminSkillsCreateForm"/);
  assert.match(adminHtml, /name="name"/);
  assert.match(adminHtml, /name="description"/);
  assert.match(adminHtml, /name="category"/);
  assert.match(adminHtml, /name="url"/);
});

test('admin script wires manual skill add form submission', () => {
  assert.match(adminJs, /const adminSkillsCreateForm = document\.getElementById\('adminSkillsCreateForm'\);/);
  assert.match(adminJs, /adminSkillsCreateForm\.addEventListener\('submit'/);
  assert.match(adminJs, /requestTutorialJson\(\['\/api\/admin\/skills'\]/);
});

test('server exposes manual admin skill creation endpoint', () => {
  assert.match(serverJs, /app\.post\('\/api\/admin\/skills', requireAdmin,/);
  assert.match(serverJs, /INSERT INTO skills_catalog/);
});

test('skills copy template supports category placeholder and copy payload includes category', () => {
  assert.match(skillsJs, /\{\{category\}\}/);
  assert.match(skillsJs, /replaceAll\('\{\{category\}\}',/);
  assert.match(skillsJs, /copyInstall\('[^']*', '[^']*', '[^']*', '[^']*', this\)/);
});
