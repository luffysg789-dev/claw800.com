import { getApiKey, logoutSession, bootstrapSession, api } from './api.js?v=20260617-ai-music-packages';
import { el, clear, toast } from './ui.js';
import { openKeyModal, renderInlineKeyPrompt, handleNexaAuthCallback, openBuyCreditsModal } from './auth.js?v=20260617-ai-music-packages';
import { renderGenerate } from './generate.js';
import { renderLibrary } from './library.js';
import { renderStemLab } from './stemlab.js';
import { renderStudio } from './studio.js';

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

function refreshCreditsChip() {
  if (!getApiKey()) return;
  api.credits().then((r) => {
    const c = document.getElementById('gm-credits-chip');
    if (c) c.textContent = '剩余 ' + r.credits + ' 次';
  }).catch(() => {});
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

window.addEventListener('hashchange', () => {
  const key = location.hash.replace('#', '') || 'generate';
  const nav = document.querySelector('.gm-nav');
  if (nav && SCREENS.some((s) => s.key === key)) switchScreen(key, nav);
});

async function init() {
  try {
    const handledCallback = await handleNexaAuthCallback();
    if (!handledCallback) await bootstrapSession();
  } catch (error) {
    toast(error.message || '登录状态获取失败', 'error');
  }
  boot();
}

init();
