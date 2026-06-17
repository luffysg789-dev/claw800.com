import { getApiKey, api, syncSession, createCreditOrder, ApiError } from './api.js';
import { el, clear, toast } from './ui.js';

const NEXA_PROTOCOL_AUTH_BASE = 'nexaauth://oauth/authorize';

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

export async function buyCredits() {
  const payload = await createCreditOrder();
  const order = payload.order || {};
  const payment = payload.payment || {};
  const orderUrl = String(payment.orderUrl || payment.order_url || payment.payUrl || payment.pay_url || payment.url || '').trim();
  if (orderUrl) {
    window.location.href = orderUrl;
    return payload;
  }
  toast(`订单已创建：${order.orderNo || ''}`, 'success');
  return payload;
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
    el('p', { class: 'gm-note', text: '授权后可购买生成次数。当前价格：1 USDT = 3 次生成。' }),
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
      text: '购买 3 次 / 1 USDT',
      onclick: async () => {
        if (!getApiKey() && !(await ensureKey())) return;
        try { await buyCredits(); }
        catch (error) { toast(error.message || '创建订单失败', 'error'); }
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
