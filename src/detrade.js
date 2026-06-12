const crypto = require('crypto');

const DEFAULT_DETRADE_BASE_URL = String(process.env.DETRADE_BASE_URL || '').trim();
const DEFAULT_DETRADE_API_KEY = String(process.env.DETRADE_API_KEY || '').trim();
const DEFAULT_DETRADE_PRIVATE_KEY = String(process.env.DETRADE_PRIVATE_KEY || '').trim();

function normalizeDetradeBaseUrl(value = DEFAULT_DETRADE_BASE_URL) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function normalizeDetradePrivateKey(value = DEFAULT_DETRADE_PRIVATE_KEY) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/\\n/g, '\n');
  if (normalized.includes('-----BEGIN ')) return normalized;

  const compact = normalized.replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.startsWith('MII')) {
    const body = compact.match(/.{1,64}/g)?.join('\n') || compact;
    return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
  }

  return normalized;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function buildDetradeJws(payload, privateKey = DEFAULT_DETRADE_PRIVATE_KEY) {
  const normalizedPrivateKey = normalizeDetradePrivateKey(privateKey);
  if (!normalizedPrivateKey) throw new Error('Detrade Private Key 未配置');

  const encodedHeader = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const encodedPayload = base64UrlJson(payload || {});
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), normalizedPrivateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

function normalizeDetradeLoginPayload(input = {}) {
  const userId = String(input.userId || '').trim();
  const username = String(input.username || '').trim();
  const avatar = String(input.avatar || '').trim();
  const currency = String(input.currency || 'USDT').trim().toUpperCase() || 'USDT';
  const exchangeRate = Number(input.exchangeRate || 1);
  const balanceTypeRaw = String(input.balanceType ?? '').trim();
  const payload = {
    userId,
    username,
    avatar,
    currency,
    exchangeRate: Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : 1
  };

  if (balanceTypeRaw !== '') {
    const balanceType = Number(balanceTypeRaw);
    if (Number.isInteger(balanceType)) payload.balanceType = balanceType;
  }

  return payload;
}

async function applyDetradeLogin({
  baseUrl = DEFAULT_DETRADE_BASE_URL,
  apiKey = DEFAULT_DETRADE_API_KEY,
  privateKey = DEFAULT_DETRADE_PRIVATE_KEY,
  payload
}) {
  const normalizedBaseUrl = normalizeDetradeBaseUrl(baseUrl);
  const normalizedApiKey = String(apiKey || '').trim();
  if (!normalizedBaseUrl) throw new Error('Detrade Base URL 未配置');
  if (!normalizedApiKey) throw new Error('Detrade API Key 未配置');

  const loginPayload = normalizeDetradeLoginPayload(payload);
  if (!loginPayload.userId) throw new Error('预测大师用户 ID 未配置');
  const sign = buildDetradeJws(loginPayload, privateKey);

  const response = await fetch(`${normalizedBaseUrl}/api/tob/third-party/login/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ApiKey: normalizedApiKey,
      sign
    },
    body: JSON.stringify(loginPayload)
  });

  let body;
  try {
    body = await response.json();
  } catch {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Detrade 登录接口响应格式无效');
  }

  const code = Number(body?.code);
  if (!response.ok || (code !== 0 && code !== 200)) {
    const message = String(body?.msg || body?.message || `Detrade 登录接口失败 (${response.status})`).trim();
    const error = new Error(message);
    error.statusCode = response.ok ? 502 : response.status;
    throw error;
  }

  const url = String(body?.data?.url || '').trim();
  if (!url) throw new Error('Detrade 登录接口未返回嵌入链接');
  return {
    url,
    accessCode: String(body?.data?.accessCode || '').trim(),
    rawBody: body
  };
}

module.exports = {
  DEFAULT_DETRADE_BASE_URL,
  DEFAULT_DETRADE_API_KEY,
  DEFAULT_DETRADE_PRIVATE_KEY,
  normalizeDetradeBaseUrl,
  normalizeDetradePrivateKey,
  normalizeDetradeLoginPayload,
  buildDetradeJws,
  applyDetradeLogin
};
