import { api, getCachedUser, ApiError } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast } from './ui.js?v=20260617-ai-music-payment-refresh';
import { renderLibrary } from './library.js?v=20260617-ai-music-payment-refresh';
import { renderAssets } from './assets.js?v=20260617-ai-music-payment-refresh';

const MY_TABS = [
  { key: 'library', label: '我的音乐' },
  { key: 'assets', label: '我的资产' },
  { key: 'nickname', label: '我的昵称' },
];

let activeMyTab = 'library';

export function renderMy(root) {
  clear(root);
  const user = getCachedUser() || {};
  const panel = el('div', { class: 'gm-my-panel' });
  const tabButtons = MY_TABS.map((tab) => el('button', {
    type: 'button',
    class: 'gm-my-tab' + (tab.key === activeMyTab ? ' active' : ''),
    'data-my-tab': tab.key,
    text: tab.label,
    onclick: () => {
      activeMyTab = tab.key;
      tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.myTab === activeMyTab));
      renderMyPanel(panel);
    }
  }));
  const wrap = el('div', { class: 'gm-my-home' }, [
    el('div', { class: 'gm-my-tabs' }, tabButtons),
    panel
  ]);
  root.appendChild(wrap);
  renderMyPanel(panel, user);
}

function renderMyPanel(panel, user = getCachedUser() || {}) {
  clear(panel);
  if (activeMyTab === 'assets') {
    renderAssets(panel, { embedded: true });
    return;
  }
  if (activeMyTab === 'nickname') {
    panel.appendChild(nicknameCard(user));
    return;
  }
  renderLibrary(panel);
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function nicknameCard(user) {
  const current = String(user?.nickname || '').trim();
  const remaining = Math.max(0, Number(user?.nicknameChangesRemaining ?? 3) || 0);
  const nextChangeAt = String(user?.nicknameNextChangeAt || '').trim();
  const nextChangeMs = nextChangeAt ? new Date(nextChangeAt).getTime() : 0;
  const waitChange = nextChangeMs && Date.now() < nextChangeMs;
  const canEdit = remaining > 0 && !waitChange;
  const input = el('input', {
    class: 'gm-input gm-my-nickname-input',
    type: 'text',
    maxlength: '20',
    value: current,
    placeholder: '请输入昵称',
    disabled: canEdit ? null : 'disabled'
  });
  const tipText = remaining <= 0
    ? '昵称已修改 3 次，不能继续修改'
    : waitChange
      ? `昵称每 30 天可修改一次，下次可修改：${formatDate(nextChangeAt)}`
      : `每 30 天可修改一次，剩余 ${remaining} 次`;
  const tip = el('p', { class: 'gm-note gm-my-nickname-tip', text: tipText });
  const save = el('button', {
    type: 'button',
    class: 'gm-btn-primary gm-my-nickname-save',
    text: '保存昵称',
    disabled: canEdit ? null : 'disabled',
    onclick: async () => {
      const nickname = String(input.value || '').trim();
      if (!nickname) {
        tip.textContent = '请填写昵称';
        tip.className = 'gm-error gm-my-nickname-tip';
        input.focus();
        return;
      }
      save.disabled = true;
      save.textContent = '保存中...';
      try {
        const payload = await api.updateProfile({ nickname });
        window.dispatchEvent(new CustomEvent('gm-profile-changed', { detail: payload }));
        toast('昵称已保存', 'success');
      } catch (error) {
        tip.textContent = error instanceof ApiError ? error.message : '昵称保存失败';
        tip.className = 'gm-error gm-my-nickname-tip';
        save.disabled = false;
        save.textContent = '保存昵称';
      }
    }
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !save.disabled) save.click();
  });
  return el('section', { class: 'gm-my-nickname-card' }, [
    el('div', { class: 'gm-my-nickname-head' }, [
      el('div', { class: 'gm-assets-label', text: '我的昵称' }),
      el('strong', { text: current || '未设置' })
    ]),
    el('div', { class: 'gm-my-nickname-edit' }, [input, save]),
    tip
  ]);
}
