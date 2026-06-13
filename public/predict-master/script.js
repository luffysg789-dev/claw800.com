(function initPredictMaster() {
  const NEXA_PROTOCOL_AUTH_BASE = 'nexaauth://oauth/authorize';
  const NEXA_PROTOCOL_ORDER_BASE = 'nexaauth://order';
  const NEXA_PUBLIC_CONFIG_ENDPOINT = '/api/nexa/public-config';
  const NEXA_SESSION_ENDPOINT = '/api/nexa/tip/session';
  const PREDICT_MASTER_SESSION_STORAGE_KEY = 'claw800:predict-master:nexa-session';
  const PREDICT_MASTER_PENDING_PAYMENT_STORAGE_KEY = 'claw800:predict-master:pending-payment';
  const PREDICT_MASTER_ALLOWED_TYPES = ['trading', 'contract', 'up-down', 'spread', 'tap-trading'];
  const MAX_SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_PENDING_PAYMENT_RETENTION_MS = 2 * 60 * 60 * 1000;

  const sdkApp = document.getElementById('predictMasterSdkApp');
  const loading = document.getElementById('predictMasterLoading');
  const status = document.getElementById('predictMasterStatus');
  const errorPanel = document.getElementById('predictMasterError');
  const errorText = document.getElementById('predictMasterErrorText');
  const reloadBtn = document.getElementById('predictMasterReloadBtn');
  const rechargeBtn = document.getElementById('predictMasterRechargeBtn');
  const rechargeAmount = document.getElementById('predictMasterRechargeAmount');
  let tradingApp = null;
  let tradingScriptUrl = '';
  let currentSession = null;

  function setLoading(text) {
    if (status) status.textContent = text;
    if (loading) {
      loading.textContent = text;
      loading.classList.remove('hidden');
    }
    if (errorPanel) errorPanel.classList.add('hidden');
  }

  function setError(message) {
    if (status) status.textContent = '入口获取失败';
    if (loading) loading.classList.add('hidden');
    if (errorText) errorText.textContent = message || '请稍后重试。';
    if (errorPanel) errorPanel.classList.remove('hidden');
  }

  function storage() {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  function normalizeSession(input) {
    const savedAt = Number(input?.savedAt || 0) || Date.now();
    const expiresAt = Number(input?.expiresAt || 0) || savedAt + MAX_SESSION_RETENTION_MS;
    const session = {
      openId: String(input?.openId || input?.open_id || input?.openid || '').trim(),
      sessionKey: String(input?.sessionKey || input?.session_key || '').trim(),
      nickname: String(input?.nickname || input?.username || '').trim(),
      avatar: String(input?.avatar || '').trim(),
      savedAt,
      expiresAt
    };
    if (!session.openId || !session.sessionKey || Date.now() > session.expiresAt) return null;
    return session;
  }

  function loadCachedSession() {
    try {
      const parsed = JSON.parse(storage()?.getItem(PREDICT_MASTER_SESSION_STORAGE_KEY) || 'null');
      return normalizeSession(parsed);
    } catch {
      return null;
    }
  }

  function saveCachedSession(session) {
    const normalized = normalizeSession({ ...session, savedAt: Date.now() });
    if (!normalized) return null;
    storage()?.setItem(PREDICT_MASTER_SESSION_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function clearCachedSession() {
    storage()?.removeItem(PREDICT_MASTER_SESSION_STORAGE_KEY);
  }

  function buildCleanReturnUrl() {
    const url = new URL(window.location.href);
    ['code', 'authCode', 'auth_code', 'state'].forEach((key) => url.searchParams.delete(key));
    return url.toString();
  }

  function buildNexaPaymentUrl(payment) {
    const params = new URLSearchParams({
      orderNo: String(payment?.orderNo || '').trim(),
      paySign: String(payment?.paySign || '').trim(),
      signType: String(payment?.signType || 'MD5').trim(),
      apiKey: String(payment?.apiKey || '').trim(),
      nonce: String(payment?.nonce || '').trim(),
      timestamp: String(payment?.timestamp || '').trim(),
      redirectUrl: buildCleanReturnUrl()
    });
    return `${NEXA_PROTOCOL_ORDER_BASE}?${params.toString()}`;
  }

  function launchNexaUrl(url) {
    const targetUrl = String(url || '').trim();
    if (!targetUrl) return;
    window.location.href = targetUrl;
  }

  function savePendingRechargePayment(payment) {
    storage()?.setItem(
      PREDICT_MASTER_PENDING_PAYMENT_STORAGE_KEY,
      JSON.stringify({
        orderNo: String(payment?.orderNo || '').trim(),
        amount: String(payment?.amount || '').trim(),
        savedAt: Date.now(),
        expiresAt: Date.now() + MAX_PENDING_PAYMENT_RETENTION_MS
      })
    );
  }

  function loadPendingRechargePayment() {
    try {
      const parsed = JSON.parse(storage()?.getItem(PREDICT_MASTER_PENDING_PAYMENT_STORAGE_KEY) || 'null');
      if (!parsed?.orderNo || Number(parsed.expiresAt || 0) <= Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function clearPendingRechargePayment() {
    storage()?.removeItem(PREDICT_MASTER_PENDING_PAYMENT_STORAGE_KEY);
  }

  function normalizeSdkEntry(url) {
    try {
      const parsed = new URL(String(url || '').trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
      return parsed.origin;
    } catch {
      return '';
    }
  }

  function getPredictMasterRenderType() {
    try {
      const params = new URL(window.location.href).searchParams;
      const type = String(params.get('type') || '').trim();
      return PREDICT_MASTER_ALLOWED_TYPES.includes(type) ? type : 'trading';
    } catch {
      return 'trading';
    }
  }

  function unloadTradingApp() {
    if (tradingApp && typeof tradingApp.unmount === 'function') {
      try {
        tradingApp.unmount();
      } catch {}
    }
    tradingApp = null;
    if (sdkApp) sdkApp.innerHTML = '';
  }

  function loadTradingScript(entry) {
    const scriptUrl = `${entry.replace(/\/+$/, '')}/trading.js`;
    if (window.Trading && tradingScriptUrl === scriptUrl) return Promise.resolve();
    const existingScript = document.querySelector(`script[data-predict-master-sdk="true"][src="${scriptUrl}"]`);
    if (existingScript && window.Trading) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = existingScript || document.createElement('script');
      script.type = 'module';
      script.async = true;
      script.src = scriptUrl;
      script.dataset.predictMasterSdk = 'true';
      script.onload = () => {
        tradingScriptUrl = scriptUrl;
        if (!window.Trading) {
          reject(new Error('预测大师 SDK 已加载，但 Trading 未初始化'));
          return;
        }
        resolve();
      };
      script.onerror = () => reject(new Error('预测大师 SDK 加载失败'));
      if (!existingScript) document.body.appendChild(script);
    });
  }

  async function renderTradingSdk(data) {
    const accessCode = String(data?.accessCode || '').trim();
    const entry = normalizeSdkEntry(data?.url);
    if (!accessCode) throw new Error('预测大师登录接口未返回 accessCode');
    if (!entry) throw new Error('预测大师登录接口未返回有效 SDK 地址');
    if (!sdkApp) throw new Error('预测大师容器不存在');

    setLoading('正在加载预测市场 SDK...');
    await loadTradingScript(entry);
    unloadTradingApp();
    tradingApp = new Trading({ container: sdkApp });
    tradingApp.render({
      accessCode: data.accessCode,
      type: getPredictMasterRenderType(),
      theme: 'darken',
      sound: false,
      fontWeight: 'bold',
      lang: 'zh-CN',
      onLoad: () => {
        if (loading) loading.classList.add('hidden');
        if (status) status.textContent = '预测市场已连接';
      },
      onLogin: () => {
        clearCachedSession();
        requestLoginUrl();
      },
      onRegister: () => {
        clearCachedSession();
        requestLoginUrl();
      },
      onRecharge: () => {
        if (status) status.textContent = '充值请在 Nexa 平台完成';
      },
      onError: (message) => {
        setError(String(message || '预测大师 SDK 渲染失败'));
      }
    });
  }

  async function requestJson(url, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const requestUrl = method === 'GET' ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` : url;
    const response = await fetch(requestUrl, {
      cache: method === 'GET' ? 'no-store' : 'default',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || data?.message || '请求失败');
    }
    return data;
  }

  function extractAuthCodeFromUrl() {
    try {
      const params = new URL(window.location.href).searchParams;
      return String(params.get('code') || params.get('authCode') || params.get('auth_code') || '').trim();
    } catch {
      return '';
    }
  }

  function clearAuthCodeFromUrl() {
    try {
      const url = new URL(window.location.href);
      ['code', 'authCode', 'auth_code', 'state'].forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }

  async function beginNexaLoginFlow() {
    setLoading('正在打开 Nexa 授权登录...');
    const config = await requestJson(NEXA_PUBLIC_CONFIG_ENDPOINT);
    if (!config?.apiKey) throw new Error('Nexa 授权配置未完成');
    const redirectUri = window.location.href.split('#')[0];
    window.location.href = `${NEXA_PROTOCOL_AUTH_BASE}?apikey=${encodeURIComponent(config.apiKey)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  async function exchangeSessionFromAuthCode() {
    const authCode = extractAuthCodeFromUrl();
    if (!authCode) return null;
    setLoading('正在完成 Nexa 授权...');
    try {
      const response = await requestJson(NEXA_SESSION_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ authCode, gameSlug: 'predict-master' })
      });
      const session = saveCachedSession(response.session || {});
      if (!session) throw new Error('Nexa 会话创建失败，请重新授权。');
      return session;
    } finally {
      clearAuthCodeFromUrl();
    }
  }

  async function getNexaSession() {
    const exchangedSession = await exchangeSessionFromAuthCode();
    if (exchangedSession) {
      currentSession = exchangedSession;
      return exchangedSession;
    }
    const cachedSession = loadCachedSession();
    if (cachedSession) {
      currentSession = cachedSession;
      return cachedSession;
    }
    await beginNexaLoginFlow();
    return null;
  }

  async function checkPendingRechargePayment() {
    const pending = loadPendingRechargePayment();
    if (!pending) return null;
    setLoading('正在确认预测充值...');
    const response = await requestJson('/api/predict-master/payment/query', {
      method: 'POST',
      body: JSON.stringify({ orderNo: pending.orderNo })
    });
    if (String(response.status || '').toUpperCase() === 'SUCCESS') {
      clearPendingRechargePayment();
      if (status) status.textContent = `充值成功，余额 ${response.walletBalance || ''} USDT`;
      return response;
    }
    if (status) status.textContent = `充值状态：${response.status || '处理中'}`;
    return response;
  }

  async function beginRechargePayment() {
    try {
      const session = currentSession || (await getNexaSession());
      if (!session) return;
      const amount = String(rechargeAmount?.value || '').trim();
      if (!amount || Number(amount) <= 0) throw new Error('请输入充值金额');
      setLoading('正在创建 Nexa 支付...');
      const response = await requestJson('/api/predict-master/payment/create', {
        method: 'POST',
        body: JSON.stringify({
          openId: session.openId,
          sessionKey: session.sessionKey,
          amount
        })
      });
      savePendingRechargePayment(response);
      launchNexaUrl(buildNexaPaymentUrl(response.payment));
    } catch (error) {
      setError(error?.message || '创建充值订单失败');
    }
  }

  async function requestLoginUrl() {
    setLoading('正在获取预测市场入口...');
    unloadTradingApp();

    try {
      const session = await getNexaSession();
      if (!session) return;
      await checkPendingRechargePayment();
      const data = await requestJson('/api/predict-master/login-url', {
        method: 'POST',
        body: JSON.stringify({
          openId: session.openId,
          sessionKey: session.sessionKey,
          nickname: session.nickname,
          avatar: session.avatar
        })
      });
      await renderTradingSdk(data);
    } catch (error) {
      clearCachedSession();
      setError(error?.message || '获取预测大师入口失败');
    }
  }

  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      clearCachedSession();
      requestLoginUrl();
    });
  }
  if (rechargeBtn) {
    rechargeBtn.addEventListener('click', beginRechargePayment);
  }
  requestLoginUrl();
})();
