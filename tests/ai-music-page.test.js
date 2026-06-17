const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');

function readPublicAiMusicFile(filePath) {
  return fs.readFileSync(path.join(rootDir, 'public', 'ai-music', filePath), 'utf8');
}

test('ai music page shell is installed under public route', () => {
  const html = readPublicAiMusicFile('index.html');

  assert.match(html, /<div id="app"><\/div>/);
  assert.match(html, /assets\/app\.js/);
});

test('ai music frontend uses Claw800 API routes instead of user API keys', () => {
  const apiJs = readPublicAiMusicFile('assets/api.js');
  const authJs = readPublicAiMusicFile('assets/auth.js');
  const appJs = readPublicAiMusicFile('assets/app.js');
  const combined = `${apiJs}\n${authJs}\n${appJs}`;

  assert.doesNotMatch(combined, /hh_x|gm_api_key|API Key|教父音乐 API|accounts\/api/);
  assert.match(apiJs, /\/api\/ai-music\/music/);
  assert.match(apiJs, /\/api\/ai-music\/media/);
  assert.match(authJs, /nexaauth:\/\/oauth\/authorize/);
  assert.match(combined, /\/api\/ai-music\/credits\/order/);
});

test('ai music is listed in games hub and served by express route', () => {
  const gamesConfig = fs.readFileSync(path.join(rootDir, 'public', 'games-config.js'), 'utf8');
  const dbJs = fs.readFileSync(path.join(rootDir, 'src', 'db.js'), 'utf8');
  const serverJs = fs.readFileSync(path.join(rootDir, 'src', 'server.js'), 'utf8');

  assert.match(gamesConfig, /slug:\s*'ai-music'/);
  assert.match(gamesConfig, /route:\s*'\/ai-music\/'/);
  assert.match(gamesConfig, /actionText:\s*'生成音乐'/);
  assert.match(dbJs, /slug:\s*'ai-music'/);
  assert.match(serverJs, /app\.get\(\['\/ai-music',\s*'\/ai-music\/'\]/);
});
