import { api, getCachedUser, ApiError } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast } from './ui.js?v=20260617-ai-music-payment-refresh';

export function renderMy(root) {
  clear(root);
  const user = getCachedUser() || {};
  const wrap = el('div', { class: 'gm-my-home' }, [
    el('div', { class: 'gm-head gm-my-home-head' }, [
      el('h2', { text: '我的' })
    ]),
    nicknameCard(user),
    el('div', { class: 'gm-my-home-grid' }, [
      el('a', { class: 'gm-my-home-card', href: '/ai-music/#library' }, [
        el('strong', { text: '我的音乐' }),
        el('span', { text: '查看歌曲、收藏、出售和公开设置' })
      ]),
      el('a', { class: 'gm-my-home-card', href: '/ai-music/#assets' }, [
        el('strong', { text: '我的资产' }),
        el('span', { text: '查看余额、明细和提现申请' })
      ])
    ])
  ]);
  root.appendChild(wrap);
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
