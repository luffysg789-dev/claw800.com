const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const gamesConfig = fs.readFileSync(path.join(rootDir, 'public', 'games-config.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(rootDir, 'public', 'admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(rootDir, 'public', 'admin.js'), 'utf8');

test('games config includes Predict Master card defaults', () => {
  assert.match(gamesConfig, /slug:\s*'predict-master'/);
  assert.match(gamesConfig, /name:\s*'预测大师'/);
  assert.match(gamesConfig, /route:\s*'\/predict-master\/'/);
  assert.match(gamesConfig, /'predict-master':\s*'进入预测'/);
});

test('predict-master page shell loads its assets and calls backend login url API', () => {
  const html = fs.readFileSync(path.join(rootDir, 'public', 'predict-master', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(rootDir, 'public', 'predict-master', 'script.js'), 'utf8');
  const css = fs.readFileSync(path.join(rootDir, 'public', 'predict-master', 'style.css'), 'utf8');

  assert.match(html, /<title>预测大师<\/title>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" \/>/);
  assert.match(html, /href="\/games\.html"/);
  assert.match(html, /\/predict-master\/style\.css/);
  assert.match(html, /\/predict-master\/script\.js/);
  assert.match(html, /id="predictMasterSdkApp"/);
  assert.match(html, /id="predictMasterRechargeBtn"/);
  assert.match(html, /id="predictMasterRechargeAmount"/);
  assert.doesNotMatch(html, /<iframe/);
  assert.match(css, /\.predict-master-sdk-shell/);
  assert.match(css, /\.predict-master-sdk-app/);
  assert.match(css, /\.predict-master-sdk-shell\s+:is\(input,\s*textarea,\s*select\)/);
  assert.match(css, /font-size:\s*16px\s*!important;/);
  assert.match(css, /touch-action:\s*manipulation;/);
  assert.match(script, /NEXA_PROTOCOL_AUTH_BASE/);
  assert.match(script, /nexaauth:\/\/oauth\/authorize/);
  assert.match(script, /\/api\/nexa\/public-config/);
  assert.match(script, /\/api\/nexa\/tip\/session/);
  assert.match(script, /\/api\/predict-master\/login-url/);
  assert.match(script, /\/api\/predict-master\/payment\/create/);
  assert.match(script, /\/api\/predict-master\/payment\/query/);
  assert.match(script, /function buildNexaPaymentUrl\(/);
  assert.match(script, /launchNexaUrl\(buildNexaPaymentUrl\(response\.payment\)\)/);
  assert.match(script, /PREDICT_MASTER_PENDING_PAYMENT_STORAGE_KEY/);
  assert.match(script, /checkPendingRechargePayment/);
  assert.match(script, /\/trading\.js/);
  assert.match(script, /new Trading/);
  assert.match(script, /accessCode:\s*data\.accessCode/);
  assert.match(script, /type:\s*'trading'/);
  assert.doesNotMatch(script, /frame\.src\s*=/);
});

test('admin exposes Predict Master settings without echoing the private key', () => {
  assert.match(adminHtml, /id="navPredictMasterConfig"/);
  assert.match(adminHtml, /id="navPredictMasterLoginLogs"/);
  assert.match(adminHtml, /id="navPredictMasterCallbackLogs"/);
  assert.match(adminHtml, /id="navPredictMasterOrders"/);
  assert.match(adminHtml, /id="navPredictMasterWalletTransactions"/);
  assert.match(adminHtml, /id="navPredictMasterShares"/);
  assert.match(adminHtml, /id="navPredictMasterRiskReports"/);
  assert.match(adminHtml, /id="predictMasterConfigSection"/);
  assert.match(adminHtml, /id="predictMasterLoginLogsSection"/);
  assert.match(adminHtml, /id="predictMasterCallbackLogsSection"/);
  assert.match(adminHtml, /id="predictMasterOrdersSection"/);
  assert.match(adminHtml, /id="predictMasterWalletTransactionsSection"/);
  assert.match(adminHtml, /id="predictMasterSharesSection"/);
  assert.match(adminHtml, /id="predictMasterRiskReportsSection"/);
  assert.match(adminHtml, /name="predictMasterPrivateKey"/);
  assert.match(adminJs, /SAVED_PREDICT_MASTER_PRIVATE_KEY_MASK/);
  assert.match(adminJs, /\/api\/admin\/predict-master-config/);
  assert.match(adminJs, /\/api\/admin\/predict-master-login-logs/);
  assert.match(adminJs, /\/api\/admin\/predict-master-callback-logs/);
  assert.match(adminJs, /\/api\/admin\/predict-master-orders/);
  assert.match(adminJs, /\/api\/admin\/predict-master-wallet-transactions/);
  assert.match(adminJs, /\/api\/admin\/predict-master-shares/);
  assert.match(adminJs, /\/api\/admin\/predict-master-risk-reports/);
  assert.match(adminJs, /keepPrivateKey/);
  assert.doesNotMatch(adminJs, /console\.log\(.*predictMasterPrivateKey/);
});
