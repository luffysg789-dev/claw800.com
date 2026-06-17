(function initPredictMaster() {
  const NEXA_PROTOCOL_AUTH_BASE = 'nexaauth://oauth/authorize';
  const NEXA_PROTOCOL_ORDER_BASE = 'nexaauth://order';
  const NEXA_PUBLIC_CONFIG_ENDPOINT = '/api/nexa/public-config';
  const NEXA_SESSION_ENDPOINT = '/api/nexa/tip/session';
  const PREDICT_MASTER_SESSION_STORAGE_KEY = 'claw800:predict-master:nexa-session';
  const PREDICT_MASTER_PENDING_PAYMENT_STORAGE_KEY = 'claw800:predict-master:pending-payment';
  const PREDICT_MASTER_ALLOWED_TYPES = ['trading', 'contract', 'up-down', 'spread', 'tap-trading', 'predict'];
  const PREDICT_MASTER_PRODUCT_NAMES = {
    trading: '高低期权',
    contract: '合约',
    'up-down': '涨跌',
    spread: '点差',
    'tap-trading': '快速交易',
    predict: '预测'
  };
  const PREDICT_MASTER_PRODUCT_PATHS = {
    'up-down': 'trade-center/up-down',
    'tap-trading': 'trade-center/tap-trading',
    'football-worldcup': 'dashboard/predict/sports',
    predict: 'dashboard/predict/sports'
  };
  const PREDICT_MASTER_ACTIVITY_NAMES = {
    'football-worldcup': '预测'
  };
  const DEFAULT_NEXA_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const SESSION_EXPIRY_GRACE_MS = 60 * 1000;
  const MAX_PENDING_PAYMENT_RETENTION_MS = 2 * 60 * 60 * 1000;
  const PREDICT_MASTER_RECHARGE_PENDING_DISPLAY_TIMEOUT_MS = 5 * 60 * 1000;

  const sdkApp = document.getElementById('predictMasterSdkApp');
  const loading = document.getElementById('predictMasterLoading');
  const status = document.getElementById('predictMasterStatus');
  const errorPanel = document.getElementById('predictMasterError');
  const errorText = document.getElementById('predictMasterErrorText');
  const pageTitle = document.getElementById('predictMasterTitle');
  const rechargeTitle = document.getElementById('predictMasterRechargeTitle');
  const reloadBtn = document.getElementById('predictMasterReloadBtn');
  const rechargeBtn = document.getElementById('predictMasterRechargeBtn');
  const withdrawBtn = document.getElementById('predictMasterWithdrawBtn');
  const recordsBtn = document.getElementById('predictMasterRecordsBtn');
  const rechargeModal = document.getElementById('predictMasterRechargeModal');
  const rechargeCancelBtn = document.getElementById('predictMasterRechargeCancelBtn');
  const rechargeConfirmBtn = document.getElementById('predictMasterRechargeConfirmBtn');
  const rechargeAmount = document.getElementById('predictMasterRechargeAmount');
  const rechargeError = document.getElementById('predictMasterRechargeError');
  const withdrawModal = document.getElementById('predictMasterWithdrawModal');
  const withdrawCancelBtn = document.getElementById('predictMasterWithdrawCancelBtn');
  const withdrawConfirmBtn = document.getElementById('predictMasterWithdrawConfirmBtn');
  const withdrawAmount = document.getElementById('predictMasterWithdrawAmount');
  const withdrawFeeHint = document.getElementById('predictMasterWithdrawFeeHint');
  const withdrawError = document.getElementById('predictMasterWithdrawError');
  const recordsModal = document.getElementById('predictMasterRecordsModal');
  const recordsCancelBtn = document.getElementById('predictMasterRecordsCancelBtn');
  const recordsList = document.getElementById('predictMasterRecordsList');
  const recordsLoading = document.getElementById('predictMasterRecordsLoading');
  const walletBalance = document.getElementById('predictMasterWalletBalance');
  let tradingApp = null;
  let tradingScriptUrl = '';
  let currentSession = null;
  let currentRenderContext = {};
  let lastPaymentLaunchAt = 0;
  let paymentReturnCheckPromise = null;
  let walletRefreshTimers = [];
  let lastWalletRefreshScheduleAt = 0;
  let currentFeePermille = '10';
  const reportedClientErrors = new Set();
  const MAX_SDK_TOAST_NODE_TEXT_LENGTH = 1200;
  const upstreamToastErrorMessages = [
    'Binary order odds error',
    'Binary order adds error',
    'Platform key not found',
    'remote access error'
  ];
  let sdkToastObserver = null;

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

  function hideLoading() {
    if (loading) loading.classList.add('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  }

  function getPersistentStorage() {
    try {
      return window.localStorage;
    } catch {
      try {
        return window.sessionStorage;
      } catch {
        return null;
      }
    }
  }

  function getSessionStorage() {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  function getStoredItem(key) {
    const persistent = getPersistentStorage();
    const persistentValue = persistent?.getItem?.(key);
    if (persistentValue) return persistentValue;
    const legacyValue = getSessionStorage()?.getItem?.(key);
    if (legacyValue && persistent?.setItem) {
      try {
        persistent.setItem(key, legacyValue);
      } catch {}
    }
    return legacyValue || '';
  }

  function setStoredItem(key, value) {
    getPersistentStorage()?.setItem?.(key, value);
  }

  function removeStoredItem(key) {
    getPersistentStorage()?.removeItem?.(key);
    getSessionStorage()?.removeItem?.(key);
  }

  function getSessionExpiryTimestamp(input) {
    const savedAt = Number(input?.savedAt || 0) || Date.now();
    const explicitExpiresAt = Number(input?.expiresAt || 0) || 0;
    if (explicitExpiresAt > 0) return explicitExpiresAt;
    const expiresInSeconds = Number(input?.expiresIn || input?.expires_in || 0) || 0;
    if (expiresInSeconds > 0) return savedAt + expiresInSeconds * 1000;
    return savedAt + DEFAULT_NEXA_SESSION_TTL_MS;
  }

  function normalizeSession(input) {
    const savedAt = Number(input?.savedAt || 0) || Date.now();
    const expiresAt = getSessionExpiryTimestamp({ ...input, savedAt });
    const session = {
      openId: String(input?.openId || input?.open_id || input?.openid || '').trim(),
      sessionKey: String(input?.sessionKey || input?.session_key || '').trim(),
      nickname: String(input?.nickname || input?.username || '').trim(),
      avatar: String(input?.avatar || '').trim(),
      savedAt,
      expiresAt
    };
    if (!session.openId || !session.sessionKey || Date.now() + SESSION_EXPIRY_GRACE_MS >= session.expiresAt) return null;
    return session;
  }

  function loadCachedSession() {
    try {
      const parsed = JSON.parse(getStoredItem(PREDICT_MASTER_SESSION_STORAGE_KEY) || 'null');
      return normalizeSession(parsed);
    } catch {
      return null;
    }
  }

  function saveCachedSession(session) {
    const normalized = normalizeSession({ ...session, savedAt: Date.now() });
    if (!normalized) return null;
    setStoredItem(PREDICT_MASTER_SESSION_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function clearCachedSession() {
    removeStoredItem(PREDICT_MASTER_SESSION_STORAGE_KEY);
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

  function setWalletBalance(value) {
    if (!walletBalance) return;
    const normalized = String(value || '0.00').trim() || '0.00';
    walletBalance.textContent = normalized;
  }

  function normalizeFeePermille(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) return 10;
    return numericValue;
  }

  function formatMoney(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '0.00';
    return numericValue.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }

  function formatFeeRate(feePermille) {
    const rate = normalizeFeePermille(feePermille) / 10;
    return `${formatMoney(rate)}%`;
  }

  function calculateWithdrawFee(amount) {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { feeAmount: '0.00', arrivalAmount: '0.00' };
    }
    const fee = Math.round((numericAmount * normalizeFeePermille(currentFeePermille)) / 1000 * 100) / 100;
    const arrival = Math.max(0, numericAmount - fee);
    return {
      feeAmount: fee.toFixed(2),
      arrivalAmount: arrival.toFixed(2)
    };
  }

  function updateWithdrawFeeHint() {
    if (!withdrawFeeHint) return;
    const amount = String(withdrawAmount?.value || '').trim();
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      withdrawFeeHint.textContent = `预测提现手续费 ${formatFeeRate(currentFeePermille)}，审核通过后 T+1到账。`;
      return;
    }
    const { feeAmount, arrivalAmount } = calculateWithdrawFee(amount);
    withdrawFeeHint.textContent = `预测提现手续费 ${formatFeeRate(currentFeePermille)}，手续费 ${feeAmount} USDT，预计到账 ${arrivalAmount} USDT，审核通过后 T+1到账。`;
  }

  function openRechargeModal() {
    setRechargeError('');
    if (!rechargeModal) {
      beginRechargePayment();
      return;
    }
    rechargeModal.hidden = false;
    window.setTimeout(() => {
      rechargeAmount?.focus();
      rechargeAmount?.select();
    }, 0);
  }

  function closeRechargeModal() {
    setRechargeError('');
    if (rechargeModal) rechargeModal.hidden = true;
  }

  function setRechargeError(message) {
    if (!rechargeError) return;
    const text = String(message || '').trim();
    rechargeError.textContent = text;
    rechargeError.hidden = !text;
  }

  function openWithdrawModal() {
    setWithdrawError('');
    if (!withdrawModal) {
      beginWithdrawRequest();
      return;
    }
    if (withdrawAmount) withdrawAmount.value = '';
    updateWithdrawFeeHint();
    withdrawModal.hidden = false;
    window.setTimeout(() => {
      withdrawAmount?.focus();
      withdrawAmount?.select();
    }, 0);
  }

  function closeWithdrawModal() {
    setWithdrawError('');
    if (withdrawModal) withdrawModal.hidden = true;
  }

  function setWithdrawError(message) {
    if (!withdrawError) return;
    const text = String(message || '').trim();
    withdrawError.textContent = text;
    withdrawError.hidden = !text;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => {
      const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return replacements[character] || character;
    });
  }

  function parsePredictMasterServerTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) return new Date(normalized);
    return new Date(`${normalized}Z`);
  }

  function formatPredictMasterRecordTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const date = parsePredictMasterServerTime(raw);
    if (!date) return raw;
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function closeRecordsModal() {
    if (recordsModal) recordsModal.hidden = true;
  }

  function setRecordsLoading(isLoading, message = '正在加载记录...') {
    if (!recordsLoading) return;
    recordsLoading.textContent = message;
    recordsLoading.hidden = !isLoading;
  }

  function getPredictMasterRecordStatusClass(record) {
    const status = String(record?.status || '').toLowerCase();
    const displayStatus = getPredictMasterRecordDisplayStatus(record);
    if (status === 'rejected' || displayStatus === '失败') return 'predict-master-record-item__status--rejected';
    if (displayStatus === '提现中' || displayStatus === '充值中' || status.includes('pending')) return 'predict-master-record-item__status--pending';
    return '';
  }

  function isExpiredRechargeRecord(record) {
    if (record?.type !== 'recharge') return false;
    const status = String(record?.status || '').trim().toUpperCase();
    if (status === 'SUCCESS' || status === 'CANCELLED' || status === 'FAILED') return false;
    const date = parsePredictMasterServerTime(record?.createdAt || record?.updatedAt || '');
    if (!date || Number.isNaN(date.getTime())) return false;
    return Date.now() - date.getTime() >= PREDICT_MASTER_RECHARGE_PENDING_DISPLAY_TIMEOUT_MS;
  }

  function getPredictMasterRecordDisplayStatus(record) {
    if (isExpiredRechargeRecord(record)) return '失败';
    const status = String(record?.status || '').trim().toUpperCase();
    if (record?.type === 'recharge' && (status === 'CANCELLED' || status === 'FAILED')) return '失败';
    return record?.displayStatus || (record?.type === 'withdraw' ? '提现中' : '充值中');
  }

  function renderPredictMasterRecords(items = []) {
    if (!recordsList) return;
    if (!items.length) {
      recordsList.innerHTML = '<div class="predict-master-record-item"><p class="predict-master-record-item__meta">暂无资金记录</p></div>';
      return;
    }
    recordsList.innerHTML = items
      .map((item) => {
        const typeLabel = item.type === 'withdraw' ? '提现' : '充值';
        const time = formatPredictMasterRecordTime(item.createdAt || item.finishedAt || item.updatedAt);
        const statusClass = getPredictMasterRecordStatusClass(item);
        const displayStatus = getPredictMasterRecordDisplayStatus(item);
        const orderText = item.withdrawNo || item.orderNo || item.partnerOrderNo || item.id || '';
        return `
          <article class="predict-master-record-item">
            <div class="predict-master-record-item__top">
              <span>${escapeHtml(typeLabel)} ${escapeHtml(item.amount)} ${escapeHtml(item.currency || 'USDT')}</span>
              <span class="predict-master-record-item__status ${escapeHtml(statusClass)}">${escapeHtml(displayStatus)}</span>
            </div>
            <p class="predict-master-record-item__meta">${escapeHtml(time)}${orderText ? ` · ${escapeHtml(orderText)}` : ''}</p>
          </article>
        `;
      })
      .join('');
  }

  async function loadPredictMasterRecords() {
    if (!recordsList) return;
    recordsList.innerHTML = '';
    setRecordsLoading(true);
    try {
      const session = normalizeSession(currentSession) || (await getNexaSession());
      if (!session) return;
      currentSession = session;
      const response = await requestJson('/api/predict-master/records', {
        method: 'POST',
        body: JSON.stringify({
          openId: session.openId,
          sessionKey: session.sessionKey,
          limit: 50
        })
      });
      renderPredictMasterRecords(response.items || []);
    } catch (error) {
      recordsList.innerHTML = `<div class="predict-master-record-item"><p class="predict-master-record-item__meta">${escapeHtml(error?.message || '记录加载失败')}</p></div>`;
    } finally {
      setRecordsLoading(false);
    }
  }

  function openRecordsModal() {
    if (!recordsModal) {
      loadPredictMasterRecords();
      return;
    }
    recordsModal.hidden = false;
    loadPredictMasterRecords();
  }

  function savePendingRechargePayment(payment) {
    setStoredItem(
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
      const parsed = JSON.parse(getStoredItem(PREDICT_MASTER_PENDING_PAYMENT_STORAGE_KEY) || 'null');
      if (!parsed?.orderNo || Number(parsed.expiresAt || 0) <= Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function clearPendingRechargePayment() {
    removeStoredItem(PREDICT_MASTER_PENDING_PAYMENT_STORAGE_KEY);
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

  function getPredictMasterActivity() {
    try {
      return String(new URL(window.location.href).searchParams.get('activity') || '').trim();
    } catch {
      return '';
    }
  }

  function isNexaAppEnvironment() {
    const userAgent = String(window.navigator?.userAgent || '').trim();
    const referrer = String(document.referrer || '').trim();
    return /nexa/i.test(userAgent) || /nexa/i.test(referrer);
  }

  function isPredictMasterDevAuthEnabled() {
    try {
      const params = new URL(window.location.href).searchParams;
      if (params.get('devAuth') === '0' || params.get('desktopTest') === '0') return false;
      return !isNexaAppEnvironment() || params.get('devAuth') === '1' || params.get('desktopTest') === '1';
    } catch {
      return !isNexaAppEnvironment();
    }
  }

  function normalizePredictMasterProductPath(value) {
    const path = String(value || '').trim().replace(/^\/+/, '');
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) {
      try {
        return new URL(path).pathname.replace(/^\/+/, '');
      } catch {
        return '';
      }
    }
    return path;
  }

  function getPredictMasterProductPath() {
    try {
      const params = new URL(window.location.href).searchParams;
      return (
        normalizePredictMasterProductPath(params.get('productPath')) ||
        PREDICT_MASTER_PRODUCT_PATHS[getPredictMasterActivity()] ||
        PREDICT_MASTER_PRODUCT_PATHS[getPredictMasterRenderType()] ||
        ''
      );
    } catch {
      return PREDICT_MASTER_PRODUCT_PATHS[getPredictMasterActivity()] || PREDICT_MASTER_PRODUCT_PATHS[getPredictMasterRenderType()] || '';
    }
  }

  function buildPredictMasterProductUrl(entry, productPath) {
    if (!entry || !productPath) return '';
    try {
      return new URL(productPath.replace(/^\/+/, ''), `${entry.replace(/\/+$/, '')}/`).href;
    } catch {
      return '';
    }
  }

  function getPredictMasterProductName() {
    const activity = getPredictMasterActivity();
    if (activity && PREDICT_MASTER_ACTIVITY_NAMES[activity]) return PREDICT_MASTER_ACTIVITY_NAMES[activity];
    return PREDICT_MASTER_PRODUCT_NAMES[getPredictMasterRenderType()] || '高低期权';
  }

  function applyPredictMasterBodyState() {
    const type = getPredictMasterRenderType();
    document.body.classList.remove(
      ...PREDICT_MASTER_ALLOWED_TYPES.map((allowedType) => `predict-master-product-${allowedType}`)
    );
    document.body.classList.add(`predict-master-product-${type}`);
  }

  function applyPredictMasterProductTitle() {
    applyPredictMasterBodyState();
    const productName = getPredictMasterProductName();
    document.title = productName;
    if (pageTitle) pageTitle.textContent = productName;
    if (status) status.textContent = `正在获取${productName}入口...`;
    if (rechargeTitle) rechargeTitle.textContent = `充值${productName}余额`;
    return productName;
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
    const productPath = getPredictMasterProductPath();
    const productUrl = buildPredictMasterProductUrl(entry, productPath);
    currentRenderContext = {
      accessCode,
      sdkEntry: entry,
      productType: getPredictMasterRenderType(),
      productPath: productPath || '',
      productUrl: productUrl || '',
      activity: getPredictMasterActivity() || ''
    };
    tradingApp = new Trading({ container: sdkApp });
    tradingApp.render({
      accessCode: data.accessCode,
      type: currentRenderContext.productType,
      productPath: productPath || undefined,
      productUrl: productUrl || undefined,
      activity: currentRenderContext.activity || undefined,
      theme: 'darken',
      sound: false,
      fontWeight: 'bold',
      lang: 'zh-CN',
      hidewatermark: true,
      hideWatermark: true,
      hideWaterMark: true,
      onLoad: () => {
        if (loading) loading.classList.add('hidden');
        if (status) status.textContent = `${getPredictMasterProductName()}已连接`;
      },
      onLogin: () => {
        requestLoginUrl();
      },
      onRegister: () => {
        requestLoginUrl();
      },
      onRecharge: () => {
        openRechargeModal();
      },
      onError: (message) => {
        logPredictMasterClientError('sdk-on-error', message);
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

  function getErrorMessage(error) {
    if (typeof error === 'string') return error;
    return String(error?.message || error?.reason?.message || error?.reason || '预测页面错误');
  }

  function getErrorStack(error) {
    if (typeof error === 'string') return '';
    return String(error?.stack || error?.reason?.stack || '');
  }

  function normalizePredictMasterClientErrorMessage(error, extraContext = {}) {
    const message = getErrorMessage(error);
    const filename = String(extraContext?.filename || '').trim();
    const lineNumber = Number(extraContext?.lineno || 0) || 0;
    const columnNumber = Number(extraContext?.colno || 0) || 0;
    if (message === 'Script error.' && !filename && lineNumber === 0 && columnNumber === 0) {
      return '跨域上游 SDK 脚本错误（浏览器未暴露具体堆栈）';
    }
    return message;
  }

  function logPredictMasterClientError(source, error, extraContext = {}) {
    const message = normalizePredictMasterClientErrorMessage(error, extraContext);
    const stack = getErrorStack(error);
    const dedupeKey = `${source}:${message}:${currentRenderContext.productType || ''}:${currentRenderContext.activity || ''}`;
    if (reportedClientErrors.has(dedupeKey)) return;
    reportedClientErrors.add(dedupeKey);
    const payload = {
      source,
      pageUrl: window.location.href,
      productType: currentRenderContext.productType || getPredictMasterRenderType(),
      activity: currentRenderContext.activity || getPredictMasterActivity(),
      productPath: currentRenderContext.productPath || getPredictMasterProductPath(),
      accessCode: currentRenderContext.accessCode || '',
      message,
      stack,
      userAgent: window.navigator?.userAgent || '',
      context: {
        sdkEntry: currentRenderContext.sdkEntry || '',
        productUrl: currentRenderContext.productUrl || '',
        ...extraContext
      }
    };
    fetch('/api/predict-master/client-error', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  }

  function normalizeVisibleText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function getUpstreamToastError(text) {
    const normalized = normalizeVisibleText(text);
    if (!normalized) return '';
    const lowerText = normalized.toLowerCase();
    return upstreamToastErrorMessages.find((message) => lowerText.includes(message.toLowerCase())) || '';
  }

  function inspectSdkToastErrorNode(node) {
    if (!node) return;
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) return;
    const rawText = node.nodeType === Node.TEXT_NODE ? node.nodeValue : node.textContent;
    if (!rawText || rawText.length > MAX_SDK_TOAST_NODE_TEXT_LENGTH) return;
    const matchedMessage = getUpstreamToastError(rawText);
    if (!matchedMessage) return;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    logPredictMasterClientError('sdk-toast-error', matchedMessage, {
      rawText: normalizeVisibleText(rawText).slice(0, 500),
      tagName: element?.tagName || '',
      className: String(element?.className || '').slice(0, 200),
      elementId: element?.id || ''
    });
  }

  function startSdkToastErrorObserver() {
    if (sdkToastObserver || !window.MutationObserver || !sdkApp) return;
    sdkToastObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(inspectSdkToastErrorNode);
      });
    });
    sdkToastObserver.observe(sdkApp, {
      childList: true,
      subtree: true,
      characterData: false
    });
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
      setWalletBalance(response.walletBalance || '0.00');
      if (status) status.textContent = `充值成功，余额 ${response.walletBalance || ''} USDT`;
      return response;
    }
    hideLoading();
    if (status) status.textContent = '支付未完成，已恢复产品页面';
    return response;
  }

  async function checkReturnedRechargePayment() {
    const pending = loadPendingRechargePayment();
    if (!pending || paymentReturnCheckPromise) return paymentReturnCheckPromise;
    paymentReturnCheckPromise = (async () => {
      try {
        const response = await checkPendingRechargePayment();
        const session = normalizeSession(currentSession) || loadCachedSession();
        if (session) {
          currentSession = session;
          await refreshWalletBalance(session);
        }
        return response;
      } catch (error) {
        hideLoading();
        if (status) status.textContent = '支付未完成，已恢复产品页面';
        return null;
      } finally {
        paymentReturnCheckPromise = null;
      }
    })();
    return paymentReturnCheckPromise;
  }

  function schedulePaymentReturnCheck() {
    if (!loadPendingRechargePayment()) return;
    const elapsed = Date.now() - Number(lastPaymentLaunchAt || 0);
    const delay = lastPaymentLaunchAt && elapsed < 1200 ? 1200 - elapsed : 150;
    window.setTimeout(() => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      checkReturnedRechargePayment();
    }, delay);
  }

  async function refreshWalletBalance(session = currentSession) {
    if (!session?.openId || !session?.sessionKey) return null;
    const response = await requestJson('/api/predict-master/wallet', {
      method: 'POST',
      body: JSON.stringify({
        openId: session.openId,
        sessionKey: session.sessionKey
      })
    });
    setWalletBalance(response.walletBalance || '0.00');
    if (response.feePermille !== undefined) {
      currentFeePermille = String(response.feePermille || '10');
      updateWithdrawFeeHint();
    }
    return response;
  }

  function clearScheduledWalletBalanceRefreshes() {
    walletRefreshTimers.forEach((timer) => window.clearTimeout(timer));
    walletRefreshTimers = [];
  }

  function scheduleWalletBalanceRefresh(reason = 'sdk-activity') {
    const session = normalizeSession(currentSession) || loadCachedSession();
    if (!session) return;
    currentSession = session;
    const now = Date.now();
    if (now - lastWalletRefreshScheduleAt < 1200) return;
    lastWalletRefreshScheduleAt = now;
    clearScheduledWalletBalanceRefreshes();
    [800, 3000, 8000, 18000, 35000, 70000, 130000].forEach((delay) => {
      const timer = window.setTimeout(() => {
        refreshWalletBalance(session).catch((error) => {
          logPredictMasterClientError('wallet-refresh-after-order', error, { reason, delay });
        });
      }, delay);
      walletRefreshTimers.push(timer);
    });
  }

  async function beginRechargePayment() {
    try {
      const session = normalizeSession(currentSession) || (await getNexaSession());
      if (!session) return;
      const amount = String(rechargeAmount?.value || '').trim();
      if (!amount || Number(amount) <= 0) {
        setRechargeError('请输入充值金额');
        return;
      }
      if (!Number.isFinite(Number(amount)) || Number(amount) < 1) {
        setRechargeError('充值金额必须大于 1 USDT');
        return;
      }
      setRechargeError('');
      closeRechargeModal();
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
      lastPaymentLaunchAt = Date.now();
      launchNexaUrl(buildNexaPaymentUrl(response.payment));
    } catch (error) {
      setError(error?.message || '创建充值订单失败');
    }
  }

  async function beginWithdrawRequest() {
    try {
      const session = normalizeSession(currentSession) || (await getNexaSession());
      if (!session) return;
      const amount = String(withdrawAmount?.value || '').trim();
      if (!amount || Number(amount) <= 0 || !Number.isFinite(Number(amount))) {
        setWithdrawError('请输入提现金额');
        return;
      }
      if (Number(amount) <= 1) {
        setWithdrawError('提现金额必须大于 1 USDT');
        return;
      }
      setWithdrawError('');
      const response = await requestJson('/api/predict-master/withdraw/create', {
        method: 'POST',
        body: JSON.stringify({
          openId: session.openId,
          sessionKey: session.sessionKey,
          amount
        })
      });
      if (response.walletBalance) setWalletBalance(response.walletBalance);
      closeWithdrawModal();
      window.alert(
        `提现申请已提交，等待后台审核。手续费 ${response.feeAmount || calculateWithdrawFee(amount).feeAmount} USDT，预计到账 ${response.arrivalAmount || calculateWithdrawFee(amount).arrivalAmount} USDT，审核通过后 T+1到账。`
      );
      refreshWalletBalance(session).catch(() => {});
    } catch (error) {
      setWithdrawError(error?.message || '提交提现申请失败');
    }
  }

  async function requestLoginUrl() {
    const productName = getPredictMasterProductName();
    setLoading(`正在获取${productName}入口...`);
    unloadTradingApp();

    try {
      const devAuth = isPredictMasterDevAuthEnabled();
      const pendingRecharge = devAuth ? null : await checkPendingRechargePayment();
      const session = devAuth ? null : await getNexaSession();
      if (!devAuth && !session) return;
      if (!devAuth) {
        if (!pendingRecharge || String(pendingRecharge.status || '').toUpperCase() !== 'SUCCESS') {
          await refreshWalletBalance(session);
        }
      } else {
        setWalletBalance('测试');
      }
      const data = await requestJson('/api/predict-master/login-url', {
        method: 'POST',
        body: JSON.stringify({
          openId: session?.openId,
          sessionKey: session?.sessionKey,
          nickname: session?.nickname,
          avatar: session?.avatar,
          devAuth: devAuth || undefined
        })
      });
      await renderTradingSdk(data);
    } catch (error) {
      setError(error?.message || `获取${productName}入口失败`);
    }
  }

  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      requestLoginUrl();
    });
  }
  if (rechargeBtn) {
    rechargeBtn.addEventListener('click', openRechargeModal);
  }
  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', openWithdrawModal);
  }
  if (recordsBtn) {
    recordsBtn.addEventListener('click', openRecordsModal);
  }
  if (rechargeCancelBtn) {
    rechargeCancelBtn.addEventListener('click', closeRechargeModal);
  }
  if (withdrawCancelBtn) {
    withdrawCancelBtn.addEventListener('click', closeWithdrawModal);
  }
  if (recordsCancelBtn) {
    recordsCancelBtn.addEventListener('click', closeRecordsModal);
  }
  if (rechargeConfirmBtn) {
    rechargeConfirmBtn.addEventListener('click', beginRechargePayment);
  }
  if (withdrawConfirmBtn) {
    withdrawConfirmBtn.addEventListener('click', beginWithdrawRequest);
  }
  if (rechargeModal) {
    rechargeModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.rechargeClose === 'true') closeRechargeModal();
    });
  }
  if (withdrawModal) {
    withdrawModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.withdrawClose === 'true') closeWithdrawModal();
    });
  }
  if (recordsModal) {
    recordsModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.recordsClose === 'true') closeRecordsModal();
    });
  }
  if (rechargeAmount) {
    rechargeAmount.addEventListener('input', () => setRechargeError(''));
    rechargeAmount.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') beginRechargePayment();
      if (event.key === 'Escape') closeRechargeModal();
    });
  }
  if (withdrawAmount) {
    withdrawAmount.addEventListener('input', () => {
      setWithdrawError('');
      updateWithdrawFeeHint();
    });
    withdrawAmount.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') beginWithdrawRequest();
      if (event.key === 'Escape') closeWithdrawModal();
    });
  }
  if (sdkApp) {
    sdkApp.addEventListener('click', () => scheduleWalletBalanceRefresh('sdk-click'), true);
    sdkApp.addEventListener('touchend', () => scheduleWalletBalanceRefresh('sdk-touchend'), true);
  }
  window.addEventListener('error', (event) => {
    logPredictMasterClientError('window-error', event.error || event.message, {
      originalMessage: event.message,
      filename: event.filename || '',
      lineno: event.lineno || 0,
      colno: event.colno || 0
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    logPredictMasterClientError('unhandled-rejection', event.reason || 'Unhandled promise rejection');
  });
  window.addEventListener('pageshow', schedulePaymentReturnCheck);
  window.addEventListener('focus', () => {
    schedulePaymentReturnCheck();
    refreshWalletBalance().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      schedulePaymentReturnCheck();
      refreshWalletBalance().catch(() => {});
    }
  });
  applyPredictMasterProductTitle();
  startSdkToastErrorObserver();
  requestLoginUrl();
})();
