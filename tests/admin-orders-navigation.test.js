const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const rootDir = path.join(__dirname, '..');
const adminHtml = fs.readFileSync(path.join(rootDir, 'public', 'admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(rootDir, 'public', 'admin.js'), 'utf8');

test('admin sidebar groups payment order entry points under the orders page', () => {
  const navStart = adminHtml.indexOf('<aside class="admin-nav">');
  const navEnd = adminHtml.indexOf('</aside>', navStart);
  assert.notEqual(navStart, -1);
  assert.notEqual(navEnd, -1);
  const navHtml = adminHtml.slice(navStart, navEnd);

  assert.match(navHtml, /id="navOrders"/);
  assert.doesNotMatch(navHtml, /id="navPMiningOrders"/);
  assert.doesNotMatch(navHtml, /id="navNexaTipOrders"/);
  assert.doesNotMatch(navHtml, /id="navNexaEscrowOrders"/);
  assert.doesNotMatch(navHtml, /id="navXiangqiDeposits"/);

  assert.match(adminHtml, /id="adminOrdersSection"/);
  assert.match(adminHtml, /id="ordersPMiningBtn"/);
  assert.match(adminHtml, /id="ordersNexaTipBtn"/);
  assert.match(adminHtml, /id="ordersNexaEscrowBtn"/);
  assert.match(adminHtml, /id="ordersXiangqiDepositsBtn"/);
});

test('admin orders page routes each grouped button to the existing order lists', () => {
  assert.match(adminJs, /const adminOrdersSection = document\.getElementById\('adminOrdersSection'\);/);
  assert.match(adminJs, /adminOrdersSection\.classList\.toggle\('hidden', view !== 'orders'\);/);
  assert.match(adminJs, /document\.getElementById\('navOrders'\)\.addEventListener\('click', \(\) => setView\('orders'\)\);/);
  assert.match(adminJs, /document\.getElementById\('ordersPMiningBtn'\)\.addEventListener\('click', \(\) => setView\('p-mining-orders'\)\);/);
  assert.match(adminJs, /document\.getElementById\('ordersNexaTipBtn'\)\.addEventListener\('click', \(\) => setView\('nexa-tip-orders'\)\);/);
  assert.match(adminJs, /document\.getElementById\('ordersNexaEscrowBtn'\)\.addEventListener\('click', \(\) => setView\('nexa-escrow-orders'\)\);/);
  assert.match(adminJs, /document\.getElementById\('ordersXiangqiDepositsBtn'\)\.addEventListener\('click', \(\) => setView\('xiangqi-deposits'\)\);/);
});
