const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const miningModule = require(path.join(__dirname, '..', 'public', 'p-mining', 'script.js'));

const {
  DAILY_CAP,
  TOTAL_SUPPLY,
  CLAIM_COOLDOWN_MS,
  getMockNexaUser,
  normalizeHostUser,
  createDefaultMiningState,
  createDefaultNetworkStats,
  formatMiningNumber,
  calculateClaimReward,
  advanceNetworkStats,
  canClaim,
  getClaimCooldownRemainingSeconds,
  applyClaimResult,
  bindInviteCode,
  loadMiningState,
  getClaimUiState,
  loadNetworkStats,
  saveNetworkStats,
  formatWholeNumber,
  formatPowerValue,
  getStoredLocale
} = miningModule;

test('getMockNexaUser returns connected host user data', () => {
  const user = getMockNexaUser();

  assert.equal(typeof user.uid, 'string');
  assert.equal(typeof user.email, 'string');
  assert.equal(user.networkConnected, true);
});

test('normalizeHostUser falls back to safe values when host payload is partial', () => {
  const user = normalizeHostUser({});

  assert.equal(typeof user.uid, 'string');
  assert.equal(typeof user.email, 'string');
  assert.equal(user.networkConnected, false);
});

test('createDefaultMiningState seeds balance, power, and invite code', () => {
  const state = createDefaultMiningState({ uid: 'user_1' });

  assert.equal(state.balance, 0);
  assert.equal(state.power, 10);
  assert.equal(typeof state.inviteCode, 'string');
  assert.equal(state.inviteCode.length, 6);
});

test('formatMiningNumber always keeps one decimal place', () => {
  assert.equal(formatMiningNumber(12), '12.0');
  assert.equal(formatMiningNumber(12.34), '12.3');
});

test('formatWholeNumber rounds user counts to integers without decimals', () => {
  assert.equal(formatWholeNumber(1), '1');
  assert.equal(formatWholeNumber(29810.4), '29810');
});

test('formatPowerValue rounds power displays to integers without decimals', () => {
  assert.equal(formatPowerValue(10), '10');
  assert.equal(formatPowerValue(10.9), '10');
});

test('calculateClaimReward uses the specified mining formula', () => {
  const reward = calculateClaimReward({
    userPower: 1,
    networkPower: 1,
    dailyCap: DAILY_CAP
  });

  assert.equal(reward, 49942.9);
});

test('createDefaultNetworkStats uses supply and daily cap defaults', () => {
  const stats = createDefaultNetworkStats();

  assert.equal(stats.remainingSupply, TOTAL_SUPPLY);
  assert.equal(stats.dailyCap, DAILY_CAP);
  assert.equal(stats.todayPower, 10);
});

test('advanceNetworkStats updates mined totals and remaining supply', () => {
  const next = advanceNetworkStats(createDefaultNetworkStats(), 60_000);

  assert.ok(next.totalMined > 0);
  assert.ok(next.todayMined > 0);
  assert.ok(next.remainingSupply < TOTAL_SUPPLY);
});

test('canClaim returns false during the 60-second cooldown', () => {
  const now = Date.now();

  assert.equal(canClaim({ lastClaimAt: now - 20_000, now }), false);
  assert.equal(canClaim({ lastClaimAt: now - CLAIM_COOLDOWN_MS - 1000, now }), true);
});

test('getClaimCooldownRemainingSeconds rounds up remaining time', () => {
  const now = Date.now();
  const remaining = getClaimCooldownRemainingSeconds({
    lastClaimAt: now - 25_000,
    now
  });

  assert.equal(remaining, 35);
});

test('getClaimUiState shows a full 60-second cooldown immediately after claim', () => {
  const claimedAt = 1710000000000;
  const ui = getClaimUiState({
    lastClaimAt: claimedAt,
    now: claimedAt
  });

  assert.equal(ui.remainingSeconds, 60);
  assert.equal(ui.countdownLabel, '60');
  assert.equal(ui.hintLabel, '冷却中');
  assert.equal(ui.isClaimable, false);
});

test('getClaimUiState uses plain second labels instead of hh:mm:ss', () => {
  const ready = getClaimUiState({
    lastClaimAt: 0,
    now: 1710000000000
  });
  const cooling = getClaimUiState({
    lastClaimAt: 1710000000000,
    now: 1710000005000
  });

  assert.equal(ready.countdownLabel, '60');
  assert.equal(cooling.countdownLabel, '55');
});

test('applyClaimResult updates balance, lastClaimAt, and claim records', () => {
  const baseState = createDefaultMiningState({ uid: 'user_1' });
  const next = applyClaimResult(baseState, {
    reward: 49942.9,
    claimedAt: 1710000000000
  });

  assert.equal(next.balance, 49942.9);
  assert.equal(next.lastClaimAt, 1710000000000);
  assert.equal(next.claimRecords[0].reward, 49942.9);
  assert.equal(next.claimRecords[0].power, 10);
});

test('bindInviteCode rejects self-binding and duplicate binding', () => {
  const baseState = createDefaultMiningState({ uid: 'user_1' });

  assert.throws(() => bindInviteCode(baseState, baseState.inviteCode), /self/i);

  const bound = bindInviteCode(baseState, '2G4WQC');
  assert.throws(() => bindInviteCode(bound, 'ABC123'), /already bound/i);
});

test('bindInviteCode adds +10 power and records invite activity', () => {
  const baseState = createDefaultMiningState({ uid: 'user_1' });
  const next = bindInviteCode(baseState, '2G4WQC');

  assert.equal(next.power, 20);
  assert.equal(next.invitePowerBonus, 10);
  assert.equal(next.inviteCount, 1);
  assert.equal(next.inviteRecords.length, 1);
  assert.equal(next.powerChanges[0].delta, 10);
});

test('loadMiningState falls back safely when storage is corrupt', () => {
  const storage = {
    getItem() {
      return '{bad-json';
    }
  };

  const state = loadMiningState(storage, getMockNexaUser());
  assert.equal(state.balance, 0);
  assert.equal(state.power, 10);
});

test('network stats persist through storage and survive reloads', () => {
  const memory = new Map();
  const storage = {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, value);
    }
  };

  const initial = createDefaultNetworkStats();
  const next = {
    ...initial,
    totalMined: 88888.8,
    todayMined: 1234.5,
    remainingSupply: TOTAL_SUPPLY - 88888.8
  };

  saveNetworkStats(storage, next);
  const restored = loadNetworkStats(storage);

  assert.equal(restored.totalMined, 88888.8);
  assert.equal(restored.todayMined, 1234.5);
  assert.equal(restored.remainingSupply, TOTAL_SUPPLY - 88888.8);
});

test('getStoredLocale falls back to english and accepts zh toggle', () => {
  const storage = {
    getItem() {
      return 'zh';
    }
  };

  assert.equal(getStoredLocale(storage), 'zh');
  assert.equal(getStoredLocale({ getItem() { return 'fr'; } }), 'en');
});
