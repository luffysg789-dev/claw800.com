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
  assert.match(html, /href="\/ai-music\/assets\/styles\.css\?v=/);
  assert.match(html, /href="\/ai-music\/assets\/my-music\.css\?v=/);
  assert.match(html, /src="\/ai-music\/assets\/app\.js\?v=/);
  assert.doesNotMatch(html, /(?:href|src)="\.\/assets\//);
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
  assert.match(authJs, /function isNexaAppEnvironment\(\)/);
  assert.match(authJs, /openNexaDownloadModal/);
  assert.match(authJs, /https:\/\/nexa\.ceo/);
  assert.match(authJs, /if \(!isNexaAppEnvironment\(\)\) \{[\s\S]*openNexaDownloadModal\(\);[\s\S]*return false;/);
  assert.match(authJs, /const started = await startNexaLogin\(\);[\s\S]*if \(started\) onSuccess/);
  assert.match(authJs, /paySign/);
  assert.match(combined, /\/api\/ai-music\/credits\/order/);
});

test('ai music purchase flow shows three Nexa package choices', () => {
  const apiJs = readPublicAiMusicFile('assets/api.js');
  const authJs = readPublicAiMusicFile('assets/auth.js');
  const appJs = readPublicAiMusicFile('assets/app.js');
  const generateJs = readPublicAiMusicFile('assets/generate.js');
  const libraryJs = readPublicAiMusicFile('assets/library.js');
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
  assert.match(appJs, /class:\s*'gm-brand'[\s\S]*href:\s*'\/ai-music\/#generate'/);
  assert.match(appJs, /text:\s*'AI 音乐'/);
  assert.doesNotMatch(appJs, /text:\s*'🎵 AI 音乐'/);
  assert.match(appJs, /refreshPendingCreditOrder/);
  assert.match(appJs, /window\.addEventListener\('pageshow'/);
  assert.match(appJs, /window\.addEventListener\('focus'/);
  assert.match(appJs, /document\.addEventListener\('visibilitychange'/);
  assert.match(appJs, /gm-credits-changed/);
  assert.match(appJs, /href:\s*'\/ai-music\/#library'[\s\S]*text:\s*'我的音乐'/);
  assert.match(appJs, /key:\s*'square'[\s\S]*label:\s*'广场'/);
  assert.match(appJs, /class:\s*'gm-btn-ghost sm gm-square-top'/);
  assert.match(appJs, /href:\s*'\/ai-music\/#square'[\s\S]*text:\s*'广场'/);
  assert.doesNotMatch(appJs, /gm-credits-chip/);
  assert.doesNotMatch(appJs, /text:\s*'充值'/);
  assert.match(generateJs, /openBuyCreditsModal/);
  assert.match(generateJs, /id="cf-recharge"[\s\S]*充值/);
  assert.match(apiJs, /updateProfile:\s*\(\{\s*nickname/);
  assert.match(authJs, /openProfileModal/);
  assert.match(authJs, /ensureProfileComplete/);
  assert.match(authJs, /请填写昵称/);
  assert.match(appJs, /ensureProfileComplete/);
  assert.doesNotMatch(appJs, /text:\s*'购买'/);
  assert.doesNotMatch(appJs, /text:\s*'退出'/);
  assert.match(generateJs, /gm-credits-changed/);
  assert.match(generateJs, /api\.generate\(payload\)[\s\S]*window\.dispatchEvent\(new CustomEvent\('gm-credits-changed'/);
  assert.match(libraryJs, /\/ai-music\/song\/\$\{encodeURIComponent\(String\(s\.id/);
  assert.match(libraryJs, /我在 claw800\.com 用 AI 1 分钟做了首歌/);
  assert.doesNotMatch(libraryJs, /我在 ai6666/);
});

test('ai music is listed in games hub and served by express route', () => {
  const gamesConfig = fs.readFileSync(path.join(rootDir, 'public', 'games-config.js'), 'utf8');
  const dbJs = fs.readFileSync(path.join(rootDir, 'src', 'db.js'), 'utf8');
  const serverJs = fs.readFileSync(path.join(rootDir, 'src', 'server.js'), 'utf8');

  assert.match(gamesConfig, /slug:\s*'ai-music'/);
  assert.match(gamesConfig, /route:\s*'\/ai-music\/'/);
  assert.match(gamesConfig, /actionText:\s*'生成音乐'/);
  assert.match(dbJs, /slug:\s*'ai-music'/);
  assert.match(serverJs, /app\.get\(\['\/ai-music',\s*'\/ai-music\/',\s*'\/ai-music\/song\/:songId'\]/);
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
  assert.match(styles, /@media\s*\(max-width:\s*680px\)[\s\S]*\.gm-auth[\s\S]*gap:\s*4px/);
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

  assert.match(html, /\/ai-music\/assets\/styles\.css\?v=/);
  assert.match(html, /\/ai-music\/assets\/my-music\.css\?v=/);
  assert.match(html, /\/ai-music\/assets\/app\.js\?v=/);
  assert.match(appJs, /from '\.\/api\.js\?v=/);
  assert.match(appJs, /from '\.\/auth\.js\?v=/);
  assert.match(authJs, /from '\.\/api\.js\?v=/);
  assert.doesNotMatch(combinedModules, /from '\.\/(?:api|auth|ui)\.js'/);
  assert.match(serverJs, /app\.get\(\['\/ai-music', '\/ai-music\/', '\/ai-music\/song\/:songId'\][\s\S]*Cache-Control', 'no-store/);
  assert.match(serverJs, /filePath\.includes\(path\.join\('public', 'ai-music'\)\)[\s\S]*Cache-Control', 'no-store/);
});

test('ai music uses persistent bottom player with scrolling lyrics', () => {
  const appJs = readPublicAiMusicFile('assets/app.js');
  const generateJs = readPublicAiMusicFile('assets/generate.js');
  const libraryJs = readPublicAiMusicFile('assets/library.js');
  const apiJs = readPublicAiMusicFile('assets/api.js');
  const playerJs = readPublicAiMusicFile('assets/player.js');
  const squareJs = readPublicAiMusicFile('assets/square.js');
  const publicSongJs = readPublicAiMusicFile('assets/public-song.js');
  const styles = readPublicAiMusicFile('assets/styles.css');

  assert.match(appJs, /initGlobalPlayer/);
  assert.match(generateJs, /toggleGlobalSong/);
  assert.match(libraryJs, /toggleGlobalSong/);
  assert.match(apiJs, /songLyrics:\s*\(id\)\s*=>\s*request\('GET',\s*`\/song\/\$\{id\}\/lyrics`/);
  assert.match(apiJs, /songLrc:\s*\(id\)\s*=>\s*request\('GET',\s*`\/song\/\$\{id\}\/download-lrc`/);
  assert.match(libraryJs, /data-act="lyrics"/);
  assert.match(libraryJs, /api\.songLyrics/);
  assert.match(playerJs, /import\s+\{\s*api\s*\}\s+from '\.\/api\.js\?v=/);
  assert.match(playerJs, /api\.songLyrics/);
  assert.match(playerJs, /api\.songLrc/);
  assert.match(playerJs, /api\.songDetail/);
  assert.match(playerJs, /parseLyricTimestamp/);
  assert.match(playerJs, /hasTimedLyrics/);
  assert.match(playerJs, /needsSyncedLyricsFetch/);
  assert.match(playerJs, /line\.time\s*<=\s*currentTime/);
  assert.match(apiJs, /publicSongs:\s*\(/);
  assert.match(apiJs, /publicSong:\s*\(id\)/);
  assert.match(apiJs, /publicSongLyrics:\s*\(id\)/);
  assert.match(apiJs, /recordPublicPlay:\s*\(id\)/);
  assert.match(squareJs, /api\.publicSongs/);
  assert.match(squareJs, /api\.recordPublicPlay/);
  assert.match(publicSongJs, /api\.publicSong/);
  assert.match(publicSongJs, /api\.recordPublicPlay/);
  assert.match(publicSongJs, /gm-public-plays/);
  assert.match(publicSongJs, /toggleGlobalSong/);
  assert.match(playerJs, /id:\s*'gm-mini-player'/);
  assert.match(playerJs, /class:\s*'gm-mini-lyric'/);
  assert.match(playerJs, /new Audio/);
  assert.match(playerJs, /buildAudioCandidates/);
  assert.match(playerJs, /playCandidate/);
  assert.match(playerJs, /\/api\/ai-music\/public\/media\?u=/);
  assert.match(playerJs, /\/api\/ai-music\/media\?u=/);
  assert.match(playerJs, /expectedAudio\s*!==\s*audio/);
  assert.doesNotMatch(playerJs, /audio\.addEventListener\('error',\s*\(\)\s*=>\s*\{[\s\S]*toast\('音频加载失败'/);
  assert.match(styles, /\.gm-mini-player/);
  assert.match(styles, /\.gm-mini-lyric-track/);
  assert.match(styles, /@keyframes\s+gmMiniLyricScroll/);
});

test('ai music square supports mobile pull-up loading', () => {
  const squareJs = readPublicAiMusicFile('assets/square.js');
  const styles = readPublicAiMusicFile('assets/styles.css');

  assert.match(squareJs, /IntersectionObserver/);
  assert.match(squareJs, /gm-square-sentinel/);
  assert.match(squareJs, /author_nickname/);
  assert.match(squareJs, /作者：/);
  assert.doesNotMatch(squareJs, /text:\s*'播放'/);
  assert.match(squareJs, /gm-square-author-row/);
  assert.match(squareJs, /gm-square-title-row[\s\S]*gm-square-title[\s\S]*plays/);
  assert.match(squareJs, /gm-square-share/);
  assert.match(squareJs, /gm-square-lyrics/);
  assert.match(squareJs, /api\.publicSongLyrics/);
  assert.match(squareJs, /gm-square-author-row[\s\S]*gm-square-author[\s\S]*gm-square-actions[\s\S]*gm-square-lyrics[\s\S]*gm-square-share/);
  assert.match(squareJs, /class:\s*'hh-my-create-btn'[\s\S]*text:\s*'写歌'/);
  assert.match(squareJs, /gm-square-plays/);
  assert.match(squareJs, /formatPlayCount/);
  assert.match(squareJs, /playPublicSong/);
  assert.match(squareJs, /setTimeout\(\(\)\s*=>\s*go\(\),\s*320\)/);
  assert.match(squareJs, /onerror:\s*\(event\)\s*=>/);
  assert.match(squareJs, /el\('img'/);
  assert.match(styles, /\.gm-square-author-row[\s\S]*align-items:\s*center[\s\S]*justify-content:\s*space-between/);
  assert.match(styles, /\.gm-square-title-row/);
  assert.match(styles, /\.gm-square-cover\{[^}]*width:68px[^}]*height:68px/);
  assert.match(styles, /@media\(max-width:680px\)[\s\S]*\.gm-square-cover\{width:62px;height:62px;flex-basis:62px/);
  assert.match(styles, /\.gm-square-side/);
  assert.match(styles, /\.gm-square-actions/);
  assert.match(styles, /\.gm-square-lyrics-card/);
  assert.match(styles, /\.gm-square-plays/);
  assert.match(styles, /\.gm-square-share/);
  assert.match(styles, /@media\(max-width:680px\)[\s\S]*\.gm-square-search\{grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(squareJs, /loadMore/);
  assert.match(squareJs, /append:\s*true/);
  assert.match(squareJs, /scrollIntoView/);
  assert.match(styles, /\.gm-square-sentinel/);
  assert.match(styles, /\.gm-square-author/);
  assert.match(styles, /-webkit-overflow-scrolling:\s*touch/);
});

test('ai music library search and create button match square layout', () => {
  const libraryJs = readPublicAiMusicFile('assets/library.js');
  const myMusicCss = readPublicAiMusicFile('assets/my-music.css');

  assert.match(libraryJs, /class:\s*'gm-head hh-my-top-head'/);
  assert.match(libraryJs, /class:\s*'hh-my-create-btn'[\s\S]*text:\s*'写歌'/);
  assert.match(libraryJs, /class:\s*'gm-square-search hh-my-search-unified'/);
  assert.match(libraryJs, /class:\s*'gm-input'/);
  assert.match(libraryJs, /class:\s*'gm-btn-ghost'[\s\S]*text:\s*'搜索'/);
  assert.match(myMusicCss, /\.hh-my-toolbar-flat/);
  assert.match(myMusicCss, /\.hh-my-top-head/);
  assert.match(myMusicCss, /\.hh-my-search-unified/);
});

test('ai music library downloads use direct attachment links for mobile webviews', () => {
  const libraryJs = readPublicAiMusicFile('assets/library.js');
  const proxyDownloadBody = libraryJs.match(/async function proxyDownload[\s\S]*?\n}\n/)?.[0] || '';

  assert.match(proxyDownloadBody, /searchParams\.set\('download',\s*'1'\)/);
  assert.match(proxyDownloadBody, /searchParams\.set\('filename',\s*filename\)/);
  assert.match(proxyDownloadBody, /a\.target\s*=\s*'_blank'/);
  assert.doesNotMatch(proxyDownloadBody, /fetch\(mediaUrl\(rawUrl\)\)/);
  assert.doesNotMatch(proxyDownloadBody, /URL\.createObjectURL/);
});
