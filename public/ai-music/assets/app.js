import { getApiKey, bootstrapSession, api } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast } from './ui.js?v=20260617-ai-music-payment-refresh';
import { openKeyModal, renderInlineKeyPrompt, handleNexaAuthCallback, refreshPendingCreditOrder, ensureProfileComplete } from './auth.js?v=20260617-ai-music-payment-refresh';

const app = document.getElementById('app');

const SCREENS = [
  { key: 'generate', label: '生成音乐', module: 'generate', render: 'renderGenerate', needsKey: true },
  { key: 'market', label: '市场', module: 'market', render: 'renderMarket', needsKey: false },
  { key: 'square', label: '广场', module: 'square', render: 'renderSquare', needsKey: false },
  { key: 'my', label: '我的', module: 'my', render: 'renderMy', needsKey: true },
  { key: 'library', label: '我的音乐', module: 'library', render: 'renderLibrary', needsKey: true, hidden: true },
  { key: 'assets', label: '资产', module: 'assets', render: 'renderAssets', needsKey: true, hidden: true },
  { key: 'stemlab', label: '分轨', module: 'stemlab', render: 'renderStemLab', needsKey: true },
  { key: 'studio', label: '编曲房', module: 'studio', render: 'renderStudio', needsKey: true },
  { key: 'public-song', label: '歌曲', module: 'public-song', render: 'renderPublicSong', needsKey: false, hidden: true },
];
const ALWAYS_RERENDER = new Set(['library', 'assets', 'stemlab', 'studio', 'market', 'square', 'public-song']);
let active = 'generate';
let mounted = new Set();
let pendingPaymentRefreshTimer = null;
const moduleCache = new Map();

function publicSongIdFromPath(pathname = location.pathname) {
  const match = String(pathname || '').match(/^\/ai-music\/song\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function navKeyFor(key) {
  return ['library', 'assets'].includes(key) ? 'my' : key;
}

function boot() { renderShell(); }

async function loadScreenModule(screen) {
  if (!moduleCache.has(screen.module)) {
    moduleCache.set(screen.module, import(`./${screen.module}.js?v=20260617-ai-music-payment-refresh`));
  }
  return moduleCache.get(screen.module);
}

function loadPlayer() {
  if (!moduleCache.has('player')) {
    moduleCache.set('player', import(`./player.js?v=20260617-ai-music-payment-refresh`));
  }
  return moduleCache.get('player');
}

function renderShell() {
  clear(app);
  mounted = new Set();
  active = publicSongIdFromPath() ? 'public-song' : (location.hash.replace('#', '') || 'generate');
  if (!SCREENS.some((s) => s.key === active)) active = 'generate';

  const nav = el('nav', { class: 'gm-nav' }, [
    el('a', { class: 'gm-brand', href: '/ai-music/#generate', text: 'AI 音乐' }),
    el('div', { class: 'gm-nav-links' }, SCREENS.filter((s) => !s.hidden).map((s) =>
      el('a', { href: '/ai-music/#' + s.key, 'data-key': s.key, class: 'gm-nav-link' + (s.key === navKeyFor(active) ? ' active' : ''), text: s.label }))),
    el('div', { id: 'gm-authslot' }, [authControl()]),
  ]);

  const main = el('main', { class: 'gm-main' });
  SCREENS.forEach((s) => main.appendChild(el('section', { id: 'screen-' + s.key, class: 'gm-screen' })));

  app.appendChild(nav);
  app.appendChild(main);
  loadPlayer().then((mod) => mod.initGlobalPlayer?.()).catch(() => {});

  mount(active);
  refreshCreditsChip();
  nav.querySelectorAll('.gm-nav-link').forEach((a) => a.addEventListener('click', () => setTimeout(() => switchScreen(a.dataset.key, nav), 0)));
}

function authControl() {
  const marketLink = el('a', {
    class: 'gm-btn-ghost sm gm-market-top',
    href: '/ai-music/#market',
    text: '市场'
  });
  const squareLink = el('a', {
    class: 'gm-btn-ghost sm gm-square-top',
    href: '/ai-music/#square',
    text: '广场'
  });
  if (getApiKey()) {
    return el('div', { class: 'gm-auth' }, [
      marketLink,
      squareLink,
      el('a', {
        class: 'gm-btn-ghost sm',
        href: '/ai-music/#my',
        text: '我的'
      })
    ]);
  }
  return el('div', { class: 'gm-auth' }, [
    marketLink,
    squareLink,
    el('button', { class: 'gm-btn-ghost sm', text: 'Nexa 登录', onclick: () => openKeyModal({}) })
  ]);
}

function refreshAuthUI() {
  const slot = document.getElementById('gm-authslot');
  if (slot) { clear(slot); slot.appendChild(authControl()); }
  refreshCreditsChip();
}

function refreshCreditsChip() {
  if (!getApiKey()) return;
  api.credits().then((r) => {
    window.dispatchEvent(new CustomEvent('gm-credits-changed', { detail: { credits: { availableCredits: r.credits } } }));
  }).catch(() => {});
}

function schedulePendingPaymentRefresh(reason = 'page-return') {
  if (!getApiKey()) return;
  if (pendingPaymentRefreshTimer) window.clearTimeout(pendingPaymentRefreshTimer);
  pendingPaymentRefreshTimer = window.setTimeout(async () => {
    pendingPaymentRefreshTimer = null;
    try {
      const payload = await refreshPendingCreditOrder({ silent: reason !== 'manual' });
      const market = await loadScreenModule({ module: 'market' });
      await market.refreshPendingMarketOrder?.({ silent: reason !== 'manual' }).catch(() => null);
      if (payload?.credits) window.dispatchEvent(new CustomEvent('gm-credits-changed', { detail: payload }));
    } catch {
      refreshCreditsChip();
    }
  }, 250);
}

function switchScreen(key, nav) {
  if (!SCREENS.some((s) => s.key === key)) return;
  active = key;
  const navKey = navKeyFor(key);
  nav.querySelectorAll('.gm-nav-link').forEach((a) => a.classList.toggle('active', a.dataset.key === navKey));
  void mount(key);
}

async function mount(key) {
  SCREENS.forEach((s) => { document.getElementById('screen-' + s.key).style.display = s.key === key ? 'block' : 'none'; });
  const screen = SCREENS.find((s) => s.key === key);
  const sec = document.getElementById('screen-' + key);
  if (screen.needsKey && !getApiKey()) { renderInlineKeyPrompt(sec, screen.label); return; }
  if (ALWAYS_RERENDER.has(key) || !mounted.has(key)) {
    if (!sec.children.length) sec.appendChild(el('div', { class: 'gm-square-empty', text: '加载中...' }));
    try {
      const mod = await loadScreenModule(screen);
      if (active !== key) return;
      const render = mod[screen.render];
      if (typeof render !== 'function') throw new Error('页面模块加载失败');
      render(sec, key === 'public-song' ? publicSongIdFromPath() : undefined);
      mounted.add(key);
    } catch (error) {
      clear(sec);
      sec.appendChild(el('div', { class: 'gm-square-empty', text: error.message || '页面加载失败' }));
      toast(error.message || '页面加载失败', 'error');
    }
  }
}

window.addEventListener('gm-auth-changed', () => {
  refreshAuthUI();
  void mount(active);
  ensureProfileComplete().then(() => { refreshAuthUI(); void mount(active); });
});
window.addEventListener('gm-profile-changed', () => { refreshAuthUI(); void mount(active); });
window.addEventListener('gm-credits-changed', (event) => {
  const credits = event.detail?.credits?.availableCredits;
  if (credits === undefined) refreshCreditsChip();
});
window.addEventListener('pageshow', () => schedulePendingPaymentRefresh('pageshow'));
window.addEventListener('focus', () => schedulePendingPaymentRefresh('focus'));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) schedulePendingPaymentRefresh('visible');
});

window.addEventListener('hashchange', () => {
  if (publicSongIdFromPath()) return;
  const key = location.hash.replace('#', '') || 'generate';
  const nav = document.querySelector('.gm-nav');
  if (nav && SCREENS.some((s) => s.key === key)) switchScreen(key, nav);
});

async function init() {
  boot();
  try {
    const handledCallback = await handleNexaAuthCallback();
    if (!handledCallback) await bootstrapSession();
    schedulePendingPaymentRefresh('init');
    refreshAuthUI();
    void mount(active);
  } catch (error) {
    toast(error.message || '登录状态获取失败', 'error');
  }
  ensureProfileComplete().then(() => { refreshAuthUI(); void mount(active); });
}

init();
