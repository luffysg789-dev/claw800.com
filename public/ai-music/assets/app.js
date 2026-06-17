import { getApiKey, logoutSession, bootstrapSession, api } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast } from './ui.js?v=20260617-ai-music-payment-refresh';
import { openKeyModal, renderInlineKeyPrompt, handleNexaAuthCallback, openBuyCreditsModal, refreshPendingCreditOrder } from './auth.js?v=20260617-ai-music-payment-refresh';
import { renderGenerate } from './generate.js?v=20260617-ai-music-payment-refresh';
import { renderLibrary } from './library.js?v=20260617-ai-music-payment-refresh';
import { renderStemLab } from './stemlab.js?v=20260617-ai-music-payment-refresh';
import { renderStudio } from './studio.js?v=20260617-ai-music-payment-refresh';

const app = document.getElementById('app');

const SCREENS = [
  { key: 'generate', label: '生成音乐', render: renderGenerate, needsKey: true },
  { key: 'library', label: '我的音乐', render: renderLibrary, needsKey: true },
  { key: 'stemlab', label: '分轨', render: renderStemLab, needsKey: true },
  { key: 'studio', label: '编曲房', render: renderStudio, needsKey: true },
];
const ALWAYS_RERENDER = new Set(['library', 'stemlab', 'studio']);
let active = 'generate';
let mounted = new Set();
let pendingPaymentRefreshTimer = null;

function boot() { renderShell(); }

function renderShell() {
  clear(app);
  mounted = new Set();
  active = location.hash.replace('#', '') || 'generate';
  if (!SCREENS.some((s) => s.key === active)) active = 'generate';

  const nav = el('nav', { class: 'gm-nav' }, [
    el('div', { class: 'gm-brand', text: '🎵 AI 音乐' }),
    el('div', { class: 'gm-nav-links' }, SCREENS.map((s) =>
      el('a', { href: '#' + s.key, 'data-key': s.key, class: 'gm-nav-link' + (s.key === active ? ' active' : ''), text: s.label }))),
    el('div', { id: 'gm-authslot' }, [authControl()]),
  ]);

  const main = el('main', { class: 'gm-main' });
  SCREENS.forEach((s) => main.appendChild(el('section', { id: 'screen-' + s.key, class: 'gm-screen' })));

  app.appendChild(nav);
  app.appendChild(main);

  mount(active);
  refreshCreditsChip();
  nav.querySelectorAll('.gm-nav-link').forEach((a) => a.addEventListener('click', () => setTimeout(() => switchScreen(a.dataset.key, nav), 0)));
}

function authControl() {
  if (getApiKey()) {
    return el('div', { class: 'gm-auth' }, [
      el('span', { class: 'gm-auth-on', id: 'gm-credits-chip', text: '已登录' }),
      el('button', {
        class: 'gm-btn-ghost sm',
        text: '购买',
        onclick: () => openBuyCreditsModal()
      }),
      el('button', { class: 'gm-btn-ghost sm', text: '退出', onclick: async () => { await logoutSession(); boot(); } }),
    ]);
  }
  return el('button', { class: 'gm-btn-ghost sm', text: 'Nexa 登录', onclick: () => openKeyModal({}) });
}

function refreshAuthUI() {
  const slot = document.getElementById('gm-authslot');
  if (slot) { clear(slot); slot.appendChild(authControl()); }
  refreshCreditsChip();
}

function setCreditsChip(credits) {
  const c = document.getElementById('gm-credits-chip');
  if (c) c.textContent = '剩余 ' + credits + ' 次';
}

function refreshCreditsChip() {
  if (!getApiKey()) return;
  api.credits().then((r) => {
    setCreditsChip(r.credits);
  }).catch(() => {});
}

function schedulePendingPaymentRefresh(reason = 'page-return') {
  if (!getApiKey()) return;
  if (pendingPaymentRefreshTimer) window.clearTimeout(pendingPaymentRefreshTimer);
  pendingPaymentRefreshTimer = window.setTimeout(async () => {
    pendingPaymentRefreshTimer = null;
    try {
      const payload = await refreshPendingCreditOrder({ silent: reason !== 'manual' });
      if (payload?.credits) setCreditsChip(payload.credits.availableCredits ?? 0);
    } catch {
      refreshCreditsChip();
    }
  }, 250);
}

function switchScreen(key, nav) {
  if (!SCREENS.some((s) => s.key === key)) return;
  active = key;
  nav.querySelectorAll('.gm-nav-link').forEach((a) => a.classList.toggle('active', a.dataset.key === key));
  mount(key);
}

function mount(key) {
  SCREENS.forEach((s) => { document.getElementById('screen-' + s.key).style.display = s.key === key ? 'block' : 'none'; });
  const screen = SCREENS.find((s) => s.key === key);
  const sec = document.getElementById('screen-' + key);
  if (screen.needsKey && !getApiKey()) { renderInlineKeyPrompt(sec, screen.label); return; }
  if (ALWAYS_RERENDER.has(key) || !mounted.has(key)) { screen.render(sec); mounted.add(key); }
}

window.addEventListener('gm-auth-changed', () => { refreshAuthUI(); mount(active); });
window.addEventListener('gm-credits-changed', (event) => {
  const credits = event.detail?.credits?.availableCredits;
  if (credits !== undefined) setCreditsChip(credits);
  else refreshCreditsChip();
});
window.addEventListener('pageshow', () => schedulePendingPaymentRefresh('pageshow'));
window.addEventListener('focus', () => schedulePendingPaymentRefresh('focus'));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) schedulePendingPaymentRefresh('visible');
});

window.addEventListener('hashchange', () => {
  const key = location.hash.replace('#', '') || 'generate';
  const nav = document.querySelector('.gm-nav');
  if (nav && SCREENS.some((s) => s.key === key)) switchScreen(key, nav);
});

async function init() {
  try {
    const handledCallback = await handleNexaAuthCallback();
    if (!handledCallback) await bootstrapSession();
    schedulePendingPaymentRefresh('init');
  } catch (error) {
    toast(error.message || '登录状态获取失败', 'error');
  }
  boot();
}

init();
