import { api, ApiError } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast } from './ui.js?v=20260617-ai-music-payment-refresh';

let cachedAssets = null;

export function renderAssets(root, options = {}) {
  const embedded = Boolean(options.embedded);
  clear(root);
  root.appendChild(el('div', { class: 'gm-assets' }, [
    el('div', { class: 'gm-head' }, [
      el('h2', { text: '我的资产' }),
      embedded ? null : el('a', { class: 'gm-btn-ghost sm', href: '#library', text: '我的音乐' })
    ]),
    el('section', { class: 'gm-assets-card' }, [
      el('div', { class: 'gm-assets-label', text: '可提现余额' }),
      el('div', { id: 'gm-assets-balance', class: 'gm-assets-balance', text: '-- USDT' }),
      el('div', { class: 'gm-assets-actions' }, [
        el('button', { type: 'button', class: 'gm-btn-ghost', text: '明细', onclick: () => root.querySelector('#gm-assets-ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }),
        el('button', { type: 'button', class: 'gm-btn-primary gm-assets-withdraw-btn', text: '提现', onclick: () => openWithdrawModal(root) })
      ]),
      el('p', { class: 'gm-note', text: '歌曲销售收入会进入资产余额，提现申请 T+1 到账。' })
    ]),
    el('section', { id: 'gm-assets-ledger', class: 'gm-assets-ledger' }, [
      el('h3', { text: '资产明细' }),
      el('div', { id: 'gm-assets-list', class: 'gm-assets-list' }, [
        el('div', { class: 'gm-square-empty', text: '加载中...' })
      ])
    ])
  ]));
  loadAssets(root);
}

async function loadAssets(root) {
  const balanceEl = root.querySelector('#gm-assets-balance');
  const list = root.querySelector('#gm-assets-list');
  if (list) {
    clear(list);
    list.appendChild(el('div', { class: 'gm-square-empty', text: '加载中...' }));
  }
  try {
    const payload = await api.assets();
    cachedAssets = payload.assets || {};
    if (balanceEl) balanceEl.textContent = `${cachedAssets.balance || '0.00'} ${cachedAssets.currency || 'USDT'}`;
    renderLedger(root, cachedAssets.entries || []);
  } catch (error) {
    if (balanceEl) balanceEl.textContent = '0.00 USDT';
    clear(list);
    list.appendChild(el('div', { class: 'gm-square-empty', text: error instanceof ApiError ? error.message : '资产加载失败' }));
  }
}

function renderLedger(root, entries) {
  const list = root.querySelector('#gm-assets-list');
  clear(list);
  if (!entries.length) {
    list.appendChild(el('div', { class: 'gm-square-empty', text: '暂无资产明细' }));
    return;
  }
  entries.forEach((entry) => list.appendChild(ledgerRow(entry)));
}

function ledgerRow(entry) {
  const type = String(entry.type || '').trim();
  const isDebit = type.startsWith('withdraw');
  const title = type === 'sale_income' ? '歌曲销售收入' : '提现申请';
  const sign = isDebit ? '-' : '+';
  return el('article', { class: 'gm-assets-row' }, [
    el('div', { class: 'gm-assets-row-main' }, [
      el('strong', { text: title }),
      el('span', { text: entry.note || entry.createdAt || '' })
    ]),
    el('div', { class: 'gm-assets-row-side' }, [
      el('strong', { class: isDebit ? 'debit' : 'credit', text: `${sign}${entry.amount || '0.00'} ${entry.currency || 'USDT'}` }),
      el('span', { text: `余额 ${entry.balanceAfter || '0.00'}` })
    ])
  ]);
}

function openWithdrawModal(root) {
  const input = el('input', { class: 'gm-input', type: 'number', min: '0', step: '0.01', placeholder: '输入提现金额' });
  const status = el('p', { class: 'gm-note', text: '提现功能提示 T+1 到账。' });
  const overlay = el('div', { class: 'gm-modal', onclick: (event) => { if (event.target === overlay) overlay.remove(); } });
  const submit = el('button', {
    type: 'button',
    class: 'gm-btn-primary',
    text: '确定提现',
    onclick: async () => {
      const amount = Number(String(input.value || '').trim());
      const balance = Number(cachedAssets?.balance || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        status.className = 'gm-error';
        status.textContent = '请输入有效提现金额';
        return;
      }
      if (amount > balance) {
        status.className = 'gm-error';
        status.textContent = '提现金额不能大于余额';
        return;
      }
      submit.disabled = true;
      submit.textContent = '提交中...';
      try {
        const payload = await api.withdrawAssets(amount.toFixed(2));
        cachedAssets = payload.assets || {};
        toast(payload.message || '提现申请已提交，T+1 到账', 'success');
        overlay.remove();
        await loadAssets(root);
      } catch (error) {
        status.className = 'gm-error';
        status.textContent = error instanceof ApiError ? error.message : '提现申请失败';
        submit.disabled = false;
        submit.textContent = '确定提现';
      }
    }
  });
  overlay.appendChild(el('div', { class: 'gm-modal-card gm-assets-withdraw-modal' }, [
    el('button', { class: 'gm-modal-close', type: 'button', text: '×', onclick: () => overlay.remove() }),
    el('h2', { text: '提现' }),
    el('p', { class: 'gm-note', text: `当前余额 ${cachedAssets?.balance || '0.00'} ${cachedAssets?.currency || 'USDT'}` }),
    el('label', { class: 'gm-field' }, [
      el('span', { class: 'gm-label', text: '提现金额（USDT）' }),
      input
    ]),
    status,
    submit
  ]));
  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 50);
}
