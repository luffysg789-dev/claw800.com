const SESSION_STORAGE = 'claw800:ai-music:nexa-session';
const MUSIC_API_BASE = '/api/ai-music/music';
const MEDIA_API_BASE = '/api/ai-music/media';
const PUBLIC_API_BASE = '/api/ai-music/public';
const MARKET_API_BASE = '/api/ai-music/market';
const ASSET_API_BASE = '/api/ai-music/assets';

let cachedSession = null;
let cachedUser = null;
let cachedCredits = null;
let cachedPackage = null;
let cachedPackages = null;
let cachedProfileRequired = false;

export function getApiKey() {
  return cachedSession?.openId ? 'nexa-session' : '';
}

export function setApiKey() {}

export function clearApiKey() {
  cachedSession = null;
  cachedUser = null;
  cachedCredits = null;
  cachedPackage = null;
  cachedPackages = null;
  cachedProfileRequired = false;
  try { localStorage.removeItem(SESSION_STORAGE); } catch {}
}

export function getCachedSession() {
  return cachedSession;
}

export function getCachedCredits() {
  return cachedCredits;
}

export function getCachedUser() {
  return cachedUser;
}

export function isProfileRequired() {
  return !!cachedProfileRequired;
}

export function getCachedPackage() {
  return cachedPackage;
}

export function getCachedPackages() {
  return cachedPackages;
}

export function applyBootstrap(payload = {}) {
  cachedSession = payload.session || cachedSession;
  cachedUser = payload.user || cachedUser;
  cachedCredits = payload.credits || cachedCredits;
  cachedPackage = payload.package || cachedPackage;
  cachedPackages = payload.packages || cachedPackages;
  if (Object.prototype.hasOwnProperty.call(payload, 'profileRequired')) cachedProfileRequired = !!payload.profileRequired;
  if (cachedSession?.openId) {
    try { localStorage.setItem(SESSION_STORAGE, JSON.stringify(cachedSession)); } catch {}
  }
  return payload;
}

export class ApiError extends Error {
  constructor(message, status, code, data) {
    super(message || '请求失败');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || '';
    this.data = data || {};
  }
}

function buildQuery(params) {
  if (!params) return '';
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.append(k, v);
  });
  const s = usp.toString();
  return s ? '?' + s : '';
}

async function readJsonResponse(resp) {
  const text = await resp.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  if (!resp.ok) {
    throw new ApiError(data.error || ('请求失败 (' + resp.status + ')'), resp.status, data.code, data);
  }
  return data;
}

async function appRequest(method, path, { body, query } = {}) {
  const headers = {};
  const init = { method, headers, credentials: 'same-origin' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let resp;
  try {
    resp = await fetch(path + buildQuery(query), init);
  } catch {
    throw new ApiError('网络异常，请稍后再试', 0, 'network');
  }
  return readJsonResponse(resp);
}

async function request(method, path, { body, query } = {}) {
  const data = await appRequest(method, MUSIC_API_BASE + path, { body, query });
  if (data.credits) cachedCredits = data.credits;
  return data;
}

export async function bootstrapSession() {
  try {
    const payload = await appRequest('GET', '/api/ai-music/session');
    return applyBootstrap(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearApiKey();
      return null;
    }
    throw error;
  }
}

export async function syncSession(session) {
  const payload = await appRequest('POST', '/api/ai-music/session', { body: session });
  return applyBootstrap(payload);
}

export async function logoutSession() {
  await appRequest('POST', '/api/ai-music/session/logout', { body: {} }).catch(() => {});
  clearApiKey();
}

export async function createCreditOrder(tier) {
  const payload = await appRequest('POST', '/api/ai-music/credits/order', { body: { tier } });
  return applyBootstrap(payload);
}

export async function refreshCreditOrder(orderNo) {
  const payload = await appRequest('POST', `/api/ai-music/credits/order/${encodeURIComponent(orderNo)}/refresh`, { body: {} });
  return applyBootstrap(payload);
}

export async function refreshMarketOrder(orderNo) {
  return appRequest('POST', `${MARKET_API_BASE}/order/${encodeURIComponent(orderNo)}/refresh`, { body: {} });
}

export const api = {
  updateProfile: ({ nickname } = {}) =>
    appRequest('POST', '/api/ai-music/profile', { body: { nickname } }).then(applyBootstrap),
  credits: async () => {
    const payload = await appRequest('GET', '/api/ai-music/credits');
    applyBootstrap(payload);
    return { ...payload, credits: payload.credits?.availableCredits ?? 0 };
  },
  packages: () => request('GET', '/packages'),
  createOptions: () => request('GET', '/create-options'),
  generate: (payload) => request('POST', '/generate', { body: payload }),
  generationStatus: (id) => request('GET', `/generation/${id}/status`),
  generateLyrics: (payload) => request('POST', '/generate-lyrics', { body: payload }),
  lyricsStatus: (taskId) => request('GET', `/generate-lyrics/${taskId}/status`),
  styleSuggestion: ({ prompt = '', label = '', key = '' } = {}) =>
    request('GET', '/style-suggestion', { query: { prompt, label, key } }),
  studioArrange: ({ messages, lang = '中文' } = {}) =>
    request('POST', '/studio-arrange', { body: { messages, lang } }),
  studioArrangePoll: (taskId) => request('GET', `/studio-arrange/${taskId}/poll`),
  translateLyrics: ({ lyrics, lang } = {}) =>
    request('POST', '/translate-lyrics', { body: { lyrics, lang } }),
  translateLyricsStatus: (taskId) => request('GET', `/translate-lyrics/${taskId}/status`),
  mySongs: ({ tab = 'mine', page = 1, page_size = 20, q = '' } = {}) =>
    request('GET', '/my-songs', { query: { tab, page, page_size, q } }),
  publicSongs: ({ page = 1, page_size = 20, q = '' } = {}) =>
    appRequest('GET', `${PUBLIC_API_BASE}/songs`, { query: { page, page_size, q } }),
  publicSong: (id) => appRequest('GET', `${PUBLIC_API_BASE}/songs/${encodeURIComponent(id)}`),
  publicSongLyrics: (id) => appRequest('GET', `${PUBLIC_API_BASE}/songs/${encodeURIComponent(id)}/lyrics`),
  recordPublicPlay: (id) => appRequest('POST', `${PUBLIC_API_BASE}/songs/${encodeURIComponent(id)}/play`, { body: {} }),
  marketListings: ({ page = 1, page_size = 20, q = '' } = {}) =>
    appRequest('GET', `${MARKET_API_BASE}/listings`, { query: { page, page_size, q } }),
  createMarketOrder: (listingId) =>
    appRequest('POST', `${MARKET_API_BASE}/listings/${encodeURIComponent(listingId)}/order`, { body: {} }),
  refreshMarketOrder,
  assets: () => appRequest('GET', ASSET_API_BASE),
  withdrawAssets: (amount) => appRequest('POST', `${ASSET_API_BASE}/withdraw`, { body: { amount } }),
  listSong: (id, price) => request('POST', `/song/${id}/list`, { body: { price } }),
  songDetail: (id) => request('GET', `/song/${id}`),
  songLyrics: (id) => request('GET', `/song/${id}/lyrics`),
  songLrc: (id) => request('GET', `/song/${id}/download-lrc`),
  downloadMp3: (id) => request('GET', `/song/${id}/download-mp3`),
  exportWav: (id) => request('POST', `/song/${id}/export-wav`, { body: {} }),
  wavStatus: (id) => request('GET', `/song/${id}/wav-status`),
  stemSeparate: (id, type, confirmRedo = false) =>
    request('POST', `/song/${id}/stem`, { body: { type, confirm_redo: confirmRedo } }),
  stemStatus: (sepId) => request('GET', `/stem/${sepId}/status`),
  stemZipUrl: (sepId) => request('GET', `/stem/${sepId}/zip-url`),
  publish: (id, isPublic = true) => request('POST', `/song/${id}/publish`, { body: { public: isPublic } }),
  shareCircle: (id, description = '') => request('POST', `/song/${id}/share-circle`, { body: { description } }),
  rename: (id, title) => request('POST', `/song/${id}/rename`, { body: { title } }),
  setSongPublic: (id, isPublic) => request('POST', `/song/${id}/public`, { body: { is_public: !!isPublic } }),
  remove: (id) => request('POST', `/song/${id}/delete`, { body: {} }),
  favorite: (id) => request('POST', `/song/${id}/favorite`, { body: {} }),
  downloadCover: (id) => request('GET', `/song/${id}/download-cover`),
  copyright: (id, payload) => request('POST', `/song/${id}/copyright`, { body: payload }),
  remakePreset: (id) => request('GET', `/song/${id}/remake-preset`),
  stemLabOptions: () => request('GET', '/stem-lab/options'),
  stemLabSongs: () => request('GET', '/stem-lab/songs'),
  stemLabSubmit: (payload) => request('POST', '/stem-lab/submit', { body: payload }),
  stemLabJobStatus: (jobId) => request('GET', `/stem-lab/jobs/${jobId}/status`),
};

export function ai6Media(u) {
  if (!u) return '';
  if (u.startsWith('/ai6api/music/')) return u.replace('/ai6api/music', MUSIC_API_BASE);
  if (u.startsWith(MUSIC_API_BASE)) return u;
  if (u.startsWith('/api/mini/music/stem-lab/')) {
    return `${MEDIA_API_BASE}?u=${encodeURIComponent(`https://ai6666.com${u}`)}`;
  }
  if (/^https?:\/\//i.test(u)) return `${MEDIA_API_BASE}?u=${encodeURIComponent(u)}`;
  return u;
}

export async function authedDownload(rawUrl, filename) {
  const resp = await fetch(ai6Media(rawUrl), { credentials: 'same-origin' });
  if (!resp.ok) {
    let msg = '下载失败 (' + resp.status + ')';
    try { msg = (await resp.json()).error || msg; } catch {}
    throw new ApiError(msg, resp.status);
  }
  const blob = await resp.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl; a.download = filename || 'download';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 15000);
}

export async function poll(fn, { done, onTick, interval = 3500, timeout = 300000 } = {}) {
  const start = Date.now();
  while (true) {
    const result = await fn();
    if (onTick) onTick(result);
    if (done(result)) return result;
    if (Date.now() - start > timeout) {
      throw new ApiError('等待超时，请稍后在「我的音乐」查看', 0, 'timeout');
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}
