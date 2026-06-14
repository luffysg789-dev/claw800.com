const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const gamesConfig = fs.readFileSync(path.join(rootDir, 'public', 'games-config.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(rootDir, 'public', 'admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(rootDir, 'public', 'admin.js'), 'utf8');

test('games config includes Predict Master card defaults', () => {
  const entries = [
    ['predict-master', '高低期权', '/predict-master/?type=trading', 'trading'],
    ['predict-master-contract', '合约', '/predict-master/?type=contract', 'contract'],
    ['predict-master-up-down', '涨跌', '/predict-master/?type=up-down', 'up-down'],
    ['predict-master-spread', '点差', '/predict-master/?type=spread', 'spread'],
    ['predict-master-tap-trading', 'Tap Trading', '/predict-master/?type=tap-trading', 'tap-trading'],
    ['predict-master-football-worldcup', '预测', '/predict-master/?type=trading&activity=football-worldcup', 'trading']
  ];
  for (const [slug, name, route, type] of entries) {
    const block = gamesConfig.match(new RegExp(`\\{\\s*slug:\\s*'${slug}'[\\s\\S]*?\\n\\s*\\},`));
    assert.ok(block, `${slug} default card exists`);
    assert.match(block[0], new RegExp(`name:\\s*'${name.replace('/', '\\/')}'`));
    assert.match(block[0], new RegExp(`route:\\s*'${route.replaceAll('?', '\\?').replaceAll('/', '\\/')}'`));
    assert.match(block[0], new RegExp(`predictType:\\s*'${type}'`));
    assert.match(block[0], /icon:\s*'UPAL'/);
  }
  assert.match(gamesConfig, /'predict-master':\s*'进入高低期权'/);
  assert.match(gamesConfig, /'predict-master-tap-trading':\s*'进入 Tap Trading'/);
});

test('predict-master page shell loads its assets and calls backend login url API', () => {
  const html = fs.readFileSync(path.join(rootDir, 'public', 'predict-master', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(rootDir, 'public', 'predict-master', 'script.js'), 'utf8');
  const css = fs.readFileSync(path.join(rootDir, 'public', 'predict-master', 'style.css'), 'utf8');

  assert.match(html, /<title>高低期权<\/title>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" \/>/);
  assert.match(html, /href="\/games\.html"/);
  assert.match(html, /\/predict-master\/style\.css/);
  assert.match(html, /\/predict-master\/script\.js/);
  assert.doesNotMatch(html, /predict-master-logo/);
  assert.doesNotMatch(html, /predict-master-recharge-field/);
  assert.match(html, /id="predictMasterWalletBalance"/);
  assert.match(html, /id="predictMasterSdkApp"/);
  assert.match(html, /id="predictMasterRechargeBtn"/);
  assert.match(html, /id="predictMasterRechargeModal"/);
  assert.match(html, /id="predictMasterRechargeConfirmBtn"/);
  assert.match(html, /id="predictMasterRechargeCancelBtn"/);
  assert.match(html, /id="predictMasterRechargeAmount"/);
  assert.doesNotMatch(html, /<iframe/);
  assert.match(css, /\.predict-master-sdk-shell/);
  assert.match(css, /\.predict-master-sdk-app/);
  assert.match(css, /height:\s*100dvh;/);
  assert.match(css, /grid-template-rows:\s*auto minmax\(0,\s*1fr\);/);
  assert.match(css, /\.predict-master-sdk-app\s*\{[\s\S]*height:\s*100%;/);
  assert.doesNotMatch(css, /height:\s*calc\(100vh - 70px\);/);
  assert.match(css, /\.predict-master-wallet/);
  assert.match(css, /\.predict-master-modal/);
  assert.match(css, /\.predict-master-sdk-shell\s+:is\(input,\s*textarea,\s*select\)/);
  assert.match(css, /font-size:\s*16px\s*!important;/);
  assert.match(css, /touch-action:\s*manipulation;/);
  assert.match(script, /NEXA_PROTOCOL_AUTH_BASE/);
  assert.match(script, /nexaauth:\/\/oauth\/authorize/);
  assert.match(script, /\/api\/nexa\/public-config/);
  assert.match(script, /\/api\/nexa\/tip\/session/);
  assert.match(script, /\/api\/predict-master\/login-url/);
  assert.match(script, /\/api\/predict-master\/wallet/);
  assert.match(script, /\/api\/predict-master\/payment\/create/);
  assert.match(script, /\/api\/predict-master\/payment\/query/);
  assert.match(script, /function openRechargeModal/);
  assert.match(script, /function closeRechargeModal/);
  assert.match(script, /function buildNexaPaymentUrl\(/);
  assert.match(script, /launchNexaUrl\(buildNexaPaymentUrl\(response\.payment\)\)/);
  assert.match(script, /PREDICT_MASTER_PENDING_PAYMENT_STORAGE_KEY/);
  assert.match(script, /checkPendingRechargePayment/);
  assert.match(script, /DEFAULT_NEXA_SESSION_TTL_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(script, /SESSION_EXPIRY_GRACE_MS = 60 \* 1000/);
  assert.match(script, /function getSessionExpiryTimestamp\(input\)/);
  assert.match(script, /Number\(input\?\.expiresIn \|\| input\?\.expires_in \|\| 0\)/);
  assert.match(script, /Date\.now\(\) \+ SESSION_EXPIRY_GRACE_MS >= session\.expiresAt/);
  assert.doesNotMatch(script, /MAX_SESSION_RETENTION_MS = 30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(script, /\/trading\.js/);
  assert.match(script, /new Trading/);
  assert.match(script, /accessCode:\s*data\.accessCode/);
  assert.match(script, /const PREDICT_MASTER_ALLOWED_TYPES = /);
  assert.match(script, /const PREDICT_MASTER_PRODUCT_NAMES = /);
  assert.match(script, /function getPredictMasterActivity\(\)/);
  assert.match(script, /function getPredictMasterProductName\(\)/);
  assert.match(script, /function applyPredictMasterProductTitle\(\)/);
  assert.match(script, /function getPredictMasterRenderType\(\)/);
  assert.match(script, /type:\s*getPredictMasterRenderType\(\)/);
  assert.match(script, /activity:\s*getPredictMasterActivity\(\) \|\| undefined/);
  assert.doesNotMatch(script, /frame\.src\s*=/);
});

test('admin exposes Predict Master settings without echoing the private key', () => {
  assert.match(adminHtml, /id="navPredictMasterConfig"/);
  assert.match(adminHtml, /id="navPredictMasterLoginLogs"/);
  assert.match(adminHtml, /id="navPredictMasterCallbackLogs"/);
  assert.match(adminHtml, /id="navNexaPaymentUpstreamLogs"/);
  assert.match(adminHtml, /id="navPredictMasterOrders"/);
  assert.match(adminHtml, /id="navPredictMasterWalletTransactions"/);
  assert.match(adminHtml, /id="navPredictMasterShares"/);
  assert.match(adminHtml, /id="navPredictMasterRiskReports"/);
  assert.match(adminHtml, /id="predictMasterConfigSection"/);
  assert.match(adminHtml, /id="predictMasterLoginLogsSection"/);
  assert.match(adminHtml, /id="predictMasterCallbackLogsSection"/);
  assert.match(adminHtml, /id="nexaPaymentUpstreamLogsSection"/);
  assert.match(adminHtml, /id="predictMasterOrdersSection"/);
  assert.match(adminHtml, /id="predictMasterWalletTransactionsSection"/);
  assert.match(adminHtml, /id="predictMasterSharesSection"/);
  assert.match(adminHtml, /id="predictMasterRiskReportsSection"/);
  assert.match(adminHtml, /name="predictMasterPrivateKey"/);
  assert.match(adminHtml, /name="predictMasterPaymentCompatMode"/);
  assert.match(adminJs, /SAVED_PREDICT_MASTER_PRIVATE_KEY_MASK/);
  assert.match(adminJs, /\/api\/admin\/predict-master-config/);
  assert.match(adminJs, /paymentCompatMode/);
  assert.match(adminJs, /\/api\/admin\/predict-master-login-logs/);
  assert.match(adminJs, /\/api\/admin\/predict-master-callback-logs/);
  assert.match(adminJs, /\/api\/admin\/nexa-payment-upstream-logs/);
  assert.match(adminJs, /renderNexaPaymentUpstreamLogs/);
  assert.match(adminJs, /\/api\/admin\/predict-master-orders/);
  assert.match(adminJs, /\/api\/admin\/predict-master-wallet-transactions/);
  assert.match(adminJs, /\/api\/admin\/predict-master-shares/);
  assert.match(adminJs, /\/api\/admin\/predict-master-risk-reports/);
  assert.match(adminJs, /keepPrivateKey/);
  assert.doesNotMatch(adminJs, /console\.log\(.*predictMasterPrivateKey/);
});
