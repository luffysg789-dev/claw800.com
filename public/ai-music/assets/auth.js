import { getApiKey, getCachedUser, isProfileRequired, api, syncSession, createCreditOrder, refreshCreditOrder, ApiError } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast } from './ui.js?v=20260617-ai-music-payment-refresh';

const NEXA_PROTOCOL_AUTH_BASE = 'nexaauth://oauth/authorize';
const NEXA_PROTOCOL_ORDER_BASE = 'nexaauth://order';
const AI_MUSIC_PENDING_PAYMENT_STORAGE_KEY = 'claw800:ai-music:pending-payment';
const AI_MUSIC_PACKAGES = [
  { tier: '1u', amount: '1.00', credits: 2 },
  { tier: '10u', amount: '10.00', credits: 25 },
  { tier: '100u', amount: '100.00', credits: 300 }
];
let profileModalPromise = null;

function getAuthCodeFromUrl() {
  const params = new URLSearchParams(window.location.search || '');
  return String(params.get('code') || params.get('authCode') || params.get('auth_code') || '').trim();
}

export function clearAuthCodeFromUrl() {
  const url = new URL(window.location.href);
  ['code', 'authCode', 'auth_code', 'state'].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

async function getNexaPublicConfig() {
  const resp = await fetch('/api/nexa/public-config', { credentials: 'same-origin' });
  if (!resp.ok) throw new ApiError('Nexa 配置不可用', resp.status);
  return resp.json();
}

function getPendingCreditOrder() {
  try {
    const item = JSON.parse(sessionStorage.getItem(AI_MUSIC_PENDING_PAYMENT_STORAGE_KEY) || 'null');
    const orderNo = String(item?.orderNo || '').trim();
    if (!orderNo) return null;
    return { orderNo, savedAt: Number(item?.savedAt || 0) || 0 };
  } catch {
    return null;
  }
}

function clearPendingCreditOrder() {
  try { sessionStorage.removeItem(AI_MUSIC_PENDING_PAYMENT_STORAGE_KEY); } catch {}
}

export function savePendingCreditOrder(orderNo) {
  const normalizedOrderNo = String(orderNo || '').trim();
  if (!normalizedOrderNo) return;
  try {
    sessionStorage.setItem(AI_MUSIC_PENDING_PAYMENT_STORAGE_KEY, JSON.stringify({ orderNo: normalizedOrderNo, savedAt: Date.now() }));
  } catch {}
}

function notifyCreditsChanged(payload = {}) {
  window.dispatchEvent(new CustomEvent('gm-credits-changed', { detail: payload }));
}

export async function refreshPendingCreditOrder({ silent = false } = {}) {
  const pending = getPendingCreditOrder();
  if (!pending) return null;
  const payload = await refreshCreditOrder(pending.orderNo);
  const status = String(payload.order?.status || '').toLowerCase();
  notifyCreditsChanged(payload);
  if (status === 'paid' || status === 'success') {
    clearPendingCreditOrder();
    if (!silent) toast(`购买成功，剩余 ${payload.credits?.availableCredits ?? 0} 次`, 'success');
  }
  return payload;
}

export async function handleNexaAuthCallback() {
  const authCode = getAuthCodeFromUrl();
  if (!authCode) return false;
  const response = await fetch('/api/nexa/tip/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authCode, gameSlug: 'ai-music' })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error || 'Nexa 授权失败', response.status);
  await syncSession({
    openId: String(payload.session?.openId || '').trim(),
    sessionKey: String(payload.session?.sessionKey || '').trim(),
    nickname: String(payload.session?.nickname || 'Nexa User').trim() || 'Nexa User',
    avatar: String(payload.session?.avatar || '').trim()
  });
  clearAuthCodeFromUrl();
  window.dispatchEvent(new CustomEvent('gm-auth-changed'));
  return true;
}

export async function startNexaLogin() {
  const config = await getNexaPublicConfig();
  const redirectUri = `${window.location.origin}${window.location.pathname}${window.location.hash || ''}`;
  window.location.href = `${NEXA_PROTOCOL_AUTH_BASE}?apikey=${encodeURIComponent(config.apiKey)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export async function buyCredits(tier = '1u') {
  const payload = await createCreditOrder(tier);
  const order = payload.order || {};
  const payment = payload.payment || {};
  savePendingCreditOrder(payment.orderNo || order.orderNo);
  const orderUrl = String(payment.orderUrl || payment.order_url || payment.payUrl || payment.pay_url || payment.url || '').trim();
  if (orderUrl) {
    window.location.href = orderUrl;
    return payload;
  }
  const paymentOrderNo = String(payment.orderNo || order.orderNo || '').trim();
  const paySign = String(payment.paySign || payment.pay_sign || '').trim();
  const apiKey = String(payment.apiKey || payment.api_key || '').trim();
  if (paymentOrderNo && paySign && apiKey) {
    const params = new URLSearchParams({
      orderNo: paymentOrderNo,
      paySign,
      signType: String(payment.signType || payment.sign_type || 'MD5').trim(),
      apiKey,
      nonce: String(payment.nonce || '').trim(),
      timestamp: String(payment.timestamp || '').trim(),
      redirectUrl: `${window.location.origin}${window.location.pathname}`
    });
    window.location.href = `${NEXA_PROTOCOL_ORDER_BASE}?${params.toString()}`;
    return payload;
  }
  toast(`订单已创建：${order.orderNo || ''}`, 'success');
  return payload;
}

export function openBuyCreditsModal() {
  const overlay = el('div', { class: 'gm-modal', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const rows = AI_MUSIC_PACKAGES.map((pkg) => el('button', {
    class: 'gm-package-option',
    type: 'button',
    onclick: async () => {
      try {
        await buyCredits(pkg.tier);
      } catch (error) {
        toast(error.message || '创建订单失败', 'error');
      }
    }
  }, [
    el('span', { class: 'gm-package-main', text: `${pkg.amount.replace(/\.00$/, '')} USDT` }),
    el('span', { class: 'gm-package-sub', text: `${pkg.credits} 次制作` }),
    el('span', { class: 'gm-package-pay', text: '支付' })
  ]));
  overlay.appendChild(el('div', { class: 'gm-modal-card gm-package-card' }, [
    el('button', { class: 'gm-modal-close', type: 'button', text: '×', onclick: () => overlay.remove() }),
    el('div', { style: 'font-size:36px;text-align:center', text: '🎵' }),
    el('h2', { style: 'text-align:center;font-size:20px;font-weight:900;margin:4px 0 6px', text: '购买生成次数' }),
    el('p', { class: 'gm-note', style: 'text-align:center;margin-bottom:16px', text: '选择套餐后会跳转 Nexa 支付。' }),
    el('div', { class: 'gm-package-list' }, rows)
  ]));
  document.body.appendChild(overlay);
}

export function openProfileModal() {
  if (profileModalPromise) return profileModalPromise;
  profileModalPromise = new Promise((resolve) => {
    const input = el('input', {
      class: 'gm-input',
      type: 'text',
      maxlength: '20',
      placeholder: '请输入你的作者昵称'
    });
    const status = el('p', { class: 'gm-note', text: '请填写昵称，确认后才可以进入 AI 音乐。' });
    const overlay = el('div', { class: 'gm-modal gm-profile-modal' });
    const submit = el('button', {
      class: 'gm-btn-primary',
      type: 'button',
      text: '确认进入',
      onclick: async () => {
        const nickname = String(input.value || '').trim();
        if (!nickname) {
          status.textContent = '请填写昵称';
          status.className = 'gm-error';
          input.focus();
          return;
        }
        submit.disabled = true;
        submit.textContent = '保存中...';
        try {
          const payload = await api.updateProfile({ nickname });
          window.dispatchEvent(new CustomEvent('gm-profile-changed', { detail: payload }));
          overlay.remove();
          profileModalPromise = null;
          resolve(true);
        } catch (error) {
          status.textContent = error.message || '昵称保存失败';
          status.className = 'gm-error';
          submit.disabled = false;
          submit.textContent = '确认进入';
        }
      }
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit.click();
    });
    overlay.appendChild(el('div', { class: 'gm-modal-card gm-profile-card' }, [
      el('h2', { style: 'text-align:center;font-size:20px;font-weight:900;margin:4px 0 6px', text: '设置作者昵称' }),
      el('p', { class: 'gm-note', style: 'text-align:center;margin-bottom:14px', text: '以后音乐广场会显示这个昵称。' }),
      input,
      status,
      submit
    ]));
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 50);
  });
  return profileModalPromise;
}

export function ensureProfileComplete() {
  if (!getApiKey()) return Promise.resolve(true);
  const user = getCachedUser();
  if (!isProfileRequired() && String(user?.nickname || '').trim()) return Promise.resolve(true);
  return openProfileModal();
}

export function openKeyModal({ onSuccess, onCancel } = {}) {
  const overlay = el('div', { class: 'gm-modal', onclick: (e) => { if (e.target === overlay) { overlay.remove(); onCancel && onCancel(); } } });
  overlay.appendChild(el('div', { class: 'gm-modal-card' }, [
    el('div', { style: 'font-size:36px;text-align:center', text: '🎵' }),
    el('h2', { style: 'text-align:center;font-size:20px;font-weight:900;margin:4px 0 6px', text: 'Nexa 授权登录' }),
    el('p', { class: 'gm-note', style: 'text-align:center', text: '登录后可购买生成次数，并在 Nexa 内使用 AI 音乐。' }),
    el('button', {
      class: 'gm-btn-primary',
      text: 'Nexa 授权登录',
      onclick: async () => {
        try { await startNexaLogin(); }
        catch (error) { toast(error.message || '授权失败', 'error'); }
      }
    }),
  ]));
  document.body.appendChild(overlay);
}

export function ensureKey() {
  return new Promise((resolve) => {
    if (getApiKey()) { resolve(true); return; }
    openKeyModal({ onSuccess: () => resolve(true), onCancel: () => resolve(false) });
  });
}

export function renderInlineKeyPrompt(sec, label, onSuccess) {
  clear(sec);
  sec.appendChild(el('div', { class: 'gm-keyprompt' }, [
    el('div', { style: 'font-size:40px', text: '🎼' }),
    el('h2', { text: `${label} 需要 Nexa 登录` }),
    el('p', { class: 'gm-note', text: '授权后可购买生成次数。' }),
    el('button', {
      class: 'gm-btn-primary',
      text: 'Nexa 授权登录',
      onclick: async () => {
        try {
          await startNexaLogin();
          onSuccess && onSuccess();
        } catch (error) {
          toast(error.message || '授权失败', 'error');
        }
      }
    }),
    el('button', {
      class: 'gm-btn-ghost',
      text: '购买次数',
      onclick: async () => {
        if (!getApiKey() && !(await ensureKey())) return;
        openBuyCreditsModal();
      }
    }),
  ]));
}

export async function refreshCreditsText(target) {
  try {
    const r = await api.credits();
    target.textContent = `剩余 ${r.credits} 次`;
  } catch {
    target.textContent = '登录后可生成';
  }
}
