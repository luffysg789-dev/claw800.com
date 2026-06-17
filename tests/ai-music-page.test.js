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
  assert.match(html, /assets\/app\.js\?v=/);
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
  assert.match(authJs, /nexaauth:\/\/order/);
  assert.match(authJs, /paySign/);
  assert.match(combined, /\/api\/ai-music\/credits\/order/);
});

test('ai music purchase flow shows three Nexa package choices', () => {
  const apiJs = readPublicAiMusicFile('assets/api.js');
  const authJs = readPublicAiMusicFile('assets/auth.js');
  const appJs = readPublicAiMusicFile('assets/app.js');
  const generateJs = readPublicAiMusicFile('assets/generate.js');
  const combined = `${apiJs}\n${authJs}\n${appJs}`;

  assert.match(apiJs, /createCreditOrder\(tier/);
  assert.match(apiJs, /refreshCreditOrder\(orderNo\)/);
  assert.match(authJs, /AI_MUSIC_PACKAGES/);
  assert.match(authJs, /AI_MUSIC_PENDING_PAYMENT_STORAGE_KEY/);
  assert.match(authJs, /savePendingCreditOrder/);
  assert.match(authJs, /refreshPendingCreditOrder/);
  assert.match(authJs, /tier:\s*'1u'[\s\S]*amount:\s*'1\.00'[\s\S]*credits:\s*2/);
  assert.match(authJs, /tier:\s*'10u'[\s\S]*amount:\s*'10\.00'[\s\S]*credits:\s*25/);
  assert.match(authJs, /tier:\s*'100u'[\s\S]*amount:\s*'100\.00'[\s\S]*credits:\s*300/);
  assert.match(authJs, /openBuyCreditsModal/);
  assert.match(authJs, /window\.dispatchEvent\(new CustomEvent\('gm-credits-changed'/);
  assert.match(combined, /openBuyCreditsModal/);
  assert.match(appJs, /class:\s*'gm-brand'[\s\S]*href:\s*'#generate'/);
  assert.match(appJs, /refreshPendingCreditOrder/);
  assert.match(appJs, /window\.addEventListener\('pageshow'/);
  assert.match(appJs, /window\.addEventListener\('focus'/);
  assert.match(appJs, /document\.addEventListener\('visibilitychange'/);
  assert.match(appJs, /gm-credits-changed/);
  assert.match(appJs, /href:\s*'#library'[\s\S]*text:\s*'我的音乐'/);
  assert.match(appJs, /text:\s*'充值'/);
  assert.doesNotMatch(appJs, /text:\s*'购买'/);
  assert.doesNotMatch(appJs, /text:\s*'退出'/);
  assert.match(generateJs, /gm-credits-changed/);
  assert.match(generateJs, /api\.generate\(payload\)[\s\S]*window\.dispatchEvent\(new CustomEvent\('gm-credits-changed'/);
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
  assert.match(serverJs, /'ai-music':\s*'\/ai-music\/'/);
});

test('admin exposes ai music key, orders, and callback log management', () => {
  const adminHtml = fs.readFileSync(path.join(rootDir, 'public', 'admin.html'), 'utf8');
  const adminJs = fs.readFileSync(path.join(rootDir, 'public', 'admin.js'), 'utf8');
  const serverJs = fs.readFileSync(path.join(rootDir, 'src', 'server.js'), 'utf8');

  assert.match(adminHtml, /name="aiMusicApiBaseUrl"/);
  assert.match(adminHtml, /name="aiMusicApiKey"/);
  assert.match(adminHtml, /id="ordersAiMusicBtn"/);
  assert.match(adminHtml, /id="ordersAiMusicCallbackLogsBtn"/);
  assert.match(adminJs, /SAVED_AI_MUSIC_API_KEY_MASK/);
  assert.match(adminJs, /\/api\/admin\/ai-music-orders/);
  assert.match(adminJs, /\/api\/admin\/ai-music-callback-logs/);
  assert.match(serverJs, /\/api\/admin\/ai-music-orders/);
  assert.match(serverJs, /\/api\/admin\/ai-music-callback-logs/);
});

test('ai music mobile inputs keep 16px text to prevent iOS focus zoom', () => {
  const styles = readPublicAiMusicFile('assets/styles.css');

  assert.match(styles, /@media\s*\(max-width:\s*768px\)/);
  assert.match(styles, /\.gm-input[\s\S]*font-size:\s*16px\s*!important/);
  assert.match(styles, /\.cf-scope textarea[\s\S]*font-size:\s*16px\s*!important/);
  assert.match(styles, /\.cf-scope input[\s\S]*font-size:\s*16px\s*!important/);
  assert.match(styles, /\.gm-st-scope input[\s\S]*font-size:\s*16px\s*!important/);
  assert.match(styles, /\.gm-st-scope select[\s\S]*font-size:\s*16px\s*!important/);
});

test('ai music shell and assets avoid stale Nexa webview caches', () => {
  const html = readPublicAiMusicFile('index.html');
  const appJs = readPublicAiMusicFile('assets/app.js');
  const authJs = readPublicAiMusicFile('assets/auth.js');
  const generateJs = readPublicAiMusicFile('assets/generate.js');
  const libraryJs = readPublicAiMusicFile('assets/library.js');
  const stemlabJs = readPublicAiMusicFile('assets/stemlab.js');
  const studioJs = readPublicAiMusicFile('assets/studio.js');
  const serverJs = fs.readFileSync(path.join(rootDir, 'src', 'server.js'), 'utf8');
  const combinedModules = `${appJs}\n${authJs}\n${generateJs}\n${libraryJs}\n${stemlabJs}\n${studioJs}`;

  assert.match(html, /assets\/styles\.css\?v=/);
  assert.match(html, /assets\/my-music\.css\?v=/);
  assert.match(html, /assets\/app\.js\?v=/);
  assert.match(appJs, /from '\.\/api\.js\?v=/);
  assert.match(appJs, /from '\.\/auth\.js\?v=/);
  assert.match(authJs, /from '\.\/api\.js\?v=/);
  assert.doesNotMatch(combinedModules, /from '\.\/(?:api|auth|ui)\.js'/);
  assert.match(serverJs, /app\.get\(\['\/ai-music', '\/ai-music\/'\][\s\S]*Cache-Control', 'no-store/);
  assert.match(serverJs, /filePath\.includes\(path\.join\('public', 'ai-music'\)\)[\s\S]*Cache-Control', 'no-store/);
});

test('ai music uses persistent bottom player with scrolling lyrics', () => {
  const appJs = readPublicAiMusicFile('assets/app.js');
  const generateJs = readPublicAiMusicFile('assets/generate.js');
  const libraryJs = readPublicAiMusicFile('assets/library.js');
  const apiJs = readPublicAiMusicFile('assets/api.js');
  const playerJs = readPublicAiMusicFile('assets/player.js');
  const styles = readPublicAiMusicFile('assets/styles.css');

  assert.match(appJs, /initGlobalPlayer/);
  assert.match(generateJs, /toggleGlobalSong/);
  assert.match(libraryJs, /toggleGlobalSong/);
  assert.match(apiJs, /songLyrics:\s*\(id\)\s*=>\s*request\('GET',\s*`\/song\/\$\{id\}\/lyrics`/);
  assert.match(libraryJs, /data-act="lyrics"/);
  assert.match(libraryJs, /api\.songLyrics/);
  assert.match(playerJs, /import\s+\{\s*api\s*\}\s+from '\.\/api\.js\?v=/);
  assert.match(playerJs, /api\.songLyrics/);
  assert.match(playerJs, /id:\s*'gm-mini-player'/);
  assert.match(playerJs, /class:\s*'gm-mini-lyric'/);
  assert.match(playerJs, /new Audio/);
  assert.match(playerJs, /activeAudio\s*!==\s*audio/);
  assert.match(styles, /\.gm-mini-player/);
  assert.match(styles, /\.gm-mini-lyric-track/);
  assert.match(styles, /@keyframes\s+gmMiniLyricScroll/);
});
