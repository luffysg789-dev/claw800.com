(function createPMiningModule(globalScope) {
  const TOTAL_SUPPLY = 210000000000;
  const DAILY_CAP = 71917808;
  const CLAIM_COOLDOWN_MS = 60 * 1000;
  const DEMO_INVITE_CODES = ['2G4WQC', 'ABC123', 'NEXA88'];
  const STORAGE_KEY_PREFIX = 'claw800:p-mining:state:';
  const NETWORK_STORAGE_KEY = 'claw800:p-mining:network-stats';
  const LOCALE_STORAGE_KEY = 'claw800:p-mining:locale';
  const MAX_RECORDS = 20;
  const TRANSLATIONS = {
    en: {
      networkOnline: 'Online',
      currentHoldings: 'Current P',
      currentPower: 'Your Power',
      estimatedPerMinute: 'Est. P / Min',
      networkUsers: 'Users',
      totalMined: 'Total Mined',
      todayOutput: 'Today Output',
      todayPower: 'Today Power',
      remainingSupply: 'Remaining',
      halvingCycle: 'Halving Cycle',
      nextHalving: 'Every 4 Years (Next)',
      totalSupply: 'Supply',
      estimatedFinish: 'Est. Finish',
      inviteFriends: 'Invite Friends',
      myInviteCode: 'My Code',
      copyButton: 'Copy',
      inviteHint: 'Both sides get +10 power.',
      enterInviteCode: 'Enter Invite Code',
      invitePlaceholder: "Enter a friend's code",
      invitedUsers: 'Invites',
      invitePowerBonus: 'Power Bonus',
      claimRecords: 'Claims',
      inviteRecords: 'Invites',
      powerChanges: 'Power',
      currentTotalPoints: 'Current P',
      bindStatus: 'Bind Status',
      logoutButton: 'Log Out',
      tabMining: 'Mining',
      tabInvite: 'Invite',
      tabRecords: 'Records',
      tabProfile: 'Profile',
      claimReady: 'Claim',
      cooldown: 'Cooling',
      noRecords: 'No records yet',
      noRecordMeta: 'Nothing to show in this category.',
      claimTitle: 'Claim Reward',
      inviteTitle: 'Invite Linked',
      powerTitle: 'Power Update',
      bindBound: 'Bound',
      bindUnbound: 'Unbound',
      reasonInitialPower: 'Starting Power',
      reasonInviteReward: 'Invite Bonus',
      errorSelfInvite: 'You cannot bind your own invite code.',
      errorAlreadyBound: 'This account can only bind once.',
      errorInvalidInvite: 'Invite code is invalid.',
      errorEmptyInvite: 'Please enter an invite code.'
    },
    zh: {
      networkOnline: '在线',
      currentHoldings: '当前持有 P',
      currentPower: '当前算力',
      estimatedPerMinute: '预计收益/分',
      networkUsers: '全网用户',
      totalMined: '已挖出总量',
      todayOutput: '今日全网产出',
      todayPower: '全网今日算力',
      remainingSupply: '剩余总量',
      halvingCycle: '当前减半周期',
      nextHalving: '每四年减半（下次）',
      totalSupply: '总发行量',
      estimatedFinish: '预计挖完时间',
      inviteFriends: '邀请好友',
      myInviteCode: '我的邀请码',
      copyButton: '复制',
      inviteHint: '邀请好友双方各增加 10 算力。',
      enterInviteCode: '填写邀请码',
      invitePlaceholder: '输入好友邀请码',
      invitedUsers: '已邀请人数',
      invitePowerBonus: '邀请算力加成',
      claimRecords: '领取记录',
      inviteRecords: '邀请记录',
      powerChanges: '算力变动',
      currentTotalPoints: '当前总积分',
      bindStatus: '绑定状态',
      logoutButton: '退出登录',
      tabMining: '挖矿',
      tabInvite: '邀请',
      tabRecords: '记录',
      tabProfile: '我的',
      claimReady: '点击领取',
      cooldown: '冷却中',
      noRecords: '暂无记录',
      noRecordMeta: '当前分类还没有可展示的数据',
      claimTitle: '挖矿领取',
      inviteTitle: '邀请绑定',
      powerTitle: '算力变动',
      bindBound: '已绑定',
      bindUnbound: '未绑定',
      reasonInitialPower: '初始算力',
      reasonInviteReward: '邀请奖励',
      errorSelfInvite: '不能绑定自己的邀请码',
      errorAlreadyBound: '每个账号只能绑定一次邀请码',
      errorInvalidInvite: '邀请码无效',
      errorEmptyInvite: '请输入邀请码'
    }
  };

  function roundToSingle(value) {
    return Number(Number(value || 0).toFixed(1));
  }

  function formatMiningNumber(value) {
    return roundToSingle(value).toFixed(1);
  }

  function formatWholeNumber(value) {
    return String(Math.max(0, Math.floor(Number(value || 0))));
  }

  function formatPowerValue(value) {
    return formatWholeNumber(value);
  }

  function getStoredLocale(storage) {
    const raw = String(storage?.getItem?.(LOCALE_STORAGE_KEY) || '').trim().toLowerCase();
    return raw === 'zh' ? 'zh' : 'en';
  }

  function setStoredLocale(storage, locale) {
    if (!storage?.setItem) return;
    try {
      storage.setItem(LOCALE_STORAGE_KEY, locale === 'zh' ? 'zh' : 'en');
    } catch {}
  }

  function t(locale, key) {
    const table = TRANSLATIONS[locale] || TRANSLATIONS.en;
    return table[key] || TRANSLATIONS.en[key] || key;
  }

  function normalizeHostUser(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const uid = String(source.uid || `nexa_${Date.now().toString(36)}`).trim();
    const email = String(source.email || source.nickname || `${uid}@nexa.local`).trim();
    return {
      uid,
      email,
      nickname: String(source.nickname || '').trim(),
      networkConnected: Boolean(source.networkConnected)
    };
  }

  function getMockNexaUser() {
    return normalizeHostUser({
      uid: 'KGghQe3j',
      email: 'luffysg789@gmail.com',
      nickname: 'Nexa User',
      networkConnected: true
    });
  }

  function createInviteCode(uid) {
    const seed = String(uid || 'NEXA00').replace(/[^a-z0-9]/gi, '').toUpperCase();
    return (seed + '2G4WQC').slice(0, 6).padEnd(6, 'X');
  }

  function createDefaultMiningState(hostUser) {
    const user = normalizeHostUser(hostUser);
    return {
      uid: user.uid,
      balance: 0,
      power: 10,
      inviteCode: createInviteCode(user.uid),
      boundInviteCode: '',
      inviteCount: 0,
      invitePowerBonus: 0,
      claimRecords: [],
      inviteRecords: [],
      powerChanges: [
        {
          id: `power-${Date.now()}`,
          delta: 10,
          reason: '初始算力',
          createdAt: Date.now()
        }
      ],
      lastClaimAt: 0,
      createdAt: Date.now()
    };
  }

  function createDefaultNetworkStats() {
    return {
      totalUsers: 1,
      totalMined: 0,
      todayMined: 0,
      todayPower: 10,
      remainingSupply: TOTAL_SUPPLY,
      currentHalvingCycle: 1,
      nextHalvingDate: '2030/03/28',
      estimatedFinishYears: 100,
      dailyCap: DAILY_CAP
    };
  }

  function calculateClaimReward({ userPower, networkPower, dailyCap }) {
    const safeUserPower = Math.max(0, Number(userPower || 0));
    const safeNetworkPower = Math.max(1, Number(networkPower || 1));
    const safeDailyCap = Math.max(0, Number(dailyCap || DAILY_CAP));
    return roundToSingle((safeUserPower / safeNetworkPower) * (safeDailyCap / 1440));
  }

  function advanceNetworkStats(stats, elapsedMs) {
    const current = { ...createDefaultNetworkStats(), ...(stats || {}) };
    const minutes = Math.max(0, Number(elapsedMs || 0) / 60000);
    const increment = roundToSingle((current.dailyCap / 1440) * minutes);
    const nextTodayMined = roundToSingle(current.todayMined + increment);
    const nextTotalMined = roundToSingle(current.totalMined + increment);
    return {
      ...current,
      totalMined: nextTotalMined,
      todayMined: nextTodayMined,
      remainingSupply: roundToSingle(Math.max(0, TOTAL_SUPPLY - nextTotalMined)),
      estimatedFinishYears: roundToSingle(Math.max(0, 100 - nextTotalMined / (DAILY_CAP * 365))),
      totalUsers: roundToSingle(current.totalUsers + minutes * 0.02),
      todayPower: roundToSingle(Math.max(1, current.todayPower + minutes * 0.015))
    };
  }

  function canClaim({ lastClaimAt, now }) {
    const last = Number(lastClaimAt || 0);
    const current = Number(now || Date.now());
    return current - last >= CLAIM_COOLDOWN_MS;
  }

  function getClaimCooldownRemainingSeconds({ lastClaimAt, now }) {
    const last = Number(lastClaimAt || 0);
    const current = Number(now || Date.now());
    const remainingMs = Math.max(0, CLAIM_COOLDOWN_MS - (current - last));
    return Math.ceil(remainingMs / 1000);
  }

  function prependRecord(records, item) {
    return [item, ...(Array.isArray(records) ? records : [])].slice(0, MAX_RECORDS);
  }

  function applyClaimResult(state, { reward, claimedAt }) {
    const current = state || createDefaultMiningState(getMockNexaUser());
    const when = Number(claimedAt || Date.now());
    const safeReward = roundToSingle(reward);
    return {
      ...current,
      balance: roundToSingle(current.balance + safeReward),
      lastClaimAt: when,
      claimRecords: prependRecord(current.claimRecords, {
        id: `claim-${when}`,
        reward: safeReward,
        power: roundToSingle(current.power),
        createdAt: when
      })
    };
  }

  function bindInviteCode(state, inviteCode) {
    const current = state || createDefaultMiningState(getMockNexaUser());
    const normalizedCode = String(inviteCode || '').trim().toUpperCase();
    if (!normalizedCode) {
      throw new Error('invite required');
    }
    if (normalizedCode === current.inviteCode) {
      throw new Error('self bind is not allowed');
    }
    if (current.boundInviteCode) {
      throw new Error('already bound');
    }
    if (!DEMO_INVITE_CODES.includes(normalizedCode)) {
      throw new Error('invite invalid');
    }
    const timestamp = Date.now();
    return {
      ...current,
      power: roundToSingle(current.power + 10),
      boundInviteCode: normalizedCode,
      inviteCount: roundToSingle(current.inviteCount + 1),
      invitePowerBonus: roundToSingle(current.invitePowerBonus + 10),
      inviteRecords: prependRecord(current.inviteRecords, {
        id: `invite-${timestamp}`,
        code: normalizedCode,
        reward: 10,
        createdAt: timestamp
      }),
      powerChanges: prependRecord(current.powerChanges, {
        id: `power-${timestamp}`,
        delta: 10,
        reason: '邀请奖励',
        createdAt: timestamp
      })
    };
  }

  function getStorageKey(uid) {
    return `${STORAGE_KEY_PREFIX}${String(uid || '').trim()}`;
  }

  function loadMiningState(storage, hostUser) {
    const user = normalizeHostUser(hostUser);
    const fallback = createDefaultMiningState(user);
    try {
      const raw = storage?.getItem?.(getStorageKey(user.uid));
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return fallback;
      return {
        ...fallback,
        ...parsed,
        uid: fallback.uid,
        inviteCode: String(parsed.inviteCode || fallback.inviteCode).trim() || fallback.inviteCode
      };
    } catch {
      return fallback;
    }
  }

  function saveMiningState(storage, state) {
    if (!storage?.setItem) return;
    try {
      storage.setItem(getStorageKey(state.uid), JSON.stringify(state));
    } catch {}
  }

  function loadNetworkStats(storage) {
    const fallback = createDefaultNetworkStats();
    try {
      const raw = storage?.getItem?.(NETWORK_STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return fallback;
      return {
        ...fallback,
        ...parsed
      };
    } catch {
      return fallback;
    }
  }

  function saveNetworkStats(storage, stats) {
    if (!storage?.setItem) return;
    try {
      storage.setItem(NETWORK_STORAGE_KEY, JSON.stringify(stats));
    } catch {}
  }

  function getClaimUiState({ lastClaimAt, now, isProcessing }) {
    const current = Number(now || Date.now());
    const claimable = canClaim({ lastClaimAt, now: current });
    const remainingSeconds = claimable
      ? 0
      : getClaimCooldownRemainingSeconds({ lastClaimAt, now: current });
    const progress = claimable
      ? 100
      : Math.min(100, Math.max(0, ((CLAIM_COOLDOWN_MS - remainingSeconds * 1000) / CLAIM_COOLDOWN_MS) * 100));

    return {
      remainingSeconds,
      progress,
      isClaimable: claimable && !isProcessing,
      countdownLabel: claimable ? '60' : String(remainingSeconds),
      hintLabel: claimable ? '点击领取' : '冷却中'
    };
  }

  function applyTranslations(appState) {
    appState.elements.translatableNodes.forEach((node) => {
      node.textContent = t(appState.locale, node.dataset.i18n);
    });
    appState.elements.placeholderNodes.forEach((node) => {
      node.setAttribute('placeholder', t(appState.locale, node.dataset.i18nPlaceholder));
    });
    appState.elements.localeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.localeToggle === appState.locale);
    });
  }

  function toggleLanguage(appState, locale) {
    appState.locale = locale === 'zh' ? 'zh' : 'en';
    setStoredLocale(appState.storage, appState.locale);
    applyTranslations(appState);
    renderAll(appState);
  }

  function switchTab(appState, tab) {
    const nextTab = String(tab || 'mining').trim() || 'mining';
    appState.activeTab = nextTab;
    appState.elements.panels.forEach((panel) => {
      const isActive = panel.dataset.tab === nextTab;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    });
    appState.elements.navButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.tabTarget === nextTab);
    });
  }

  function renderClaimState(appState) {
    const ui = getClaimUiState({
      lastClaimAt: appState.state.lastClaimAt,
      now: Date.now(),
      isProcessing: appState.isProcessing
    });
    appState.elements.claimCountdown.textContent = ui.countdownLabel;
    appState.elements.claimHint.textContent = ui.isClaimable ? t(appState.locale, 'claimReady') : t(appState.locale, 'cooldown');
    appState.elements.claimButton.disabled = !ui.isClaimable;
    appState.elements.claimButton.style.setProperty('--progress', `${ui.progress}%`);
  }

  function renderMiningPanel(appState) {
    appState.network.todayPower = Math.max(Number(appState.network.todayPower || 0), Number(appState.state.power || 0), 10);
    const reward = calculateClaimReward({
      userPower: appState.state.power,
      networkPower: appState.network.todayPower,
      dailyCap: appState.network.dailyCap
    });
    appState.elements.balanceValue.textContent = formatMiningNumber(appState.state.balance);
    appState.elements.powerValue.textContent = formatPowerValue(appState.state.power);
    appState.elements.rewardPerMinute.textContent = formatMiningNumber(reward);
    appState.elements.totalUsers.textContent = formatWholeNumber(appState.network.totalUsers);
    appState.elements.totalMined.textContent = formatMiningNumber(appState.network.totalMined);
    appState.elements.todayMined.textContent = formatMiningNumber(appState.network.todayMined);
    appState.elements.todayPower.textContent = formatPowerValue(appState.network.todayPower);
    appState.elements.remainingSupply.textContent = formatMiningNumber(appState.network.remainingSupply);
    appState.elements.halvingCycle.textContent = `${appState.network.currentHalvingCycle} / 25`;
    appState.elements.nextHalvingDate.textContent = appState.network.nextHalvingDate;
    appState.elements.estimatedFinish.textContent = appState.locale === 'zh'
      ? `${formatMiningNumber(appState.network.estimatedFinishYears)} 年`
      : `${formatMiningNumber(appState.network.estimatedFinishYears)} Y`;
    renderClaimState(appState);
  }

  function renderInvitePanel(appState) {
    appState.elements.inviteCodeValue.textContent = appState.state.inviteCode;
    appState.elements.inviteCount.textContent = formatMiningNumber(appState.state.inviteCount);
    appState.elements.inviteBonus.textContent = formatPowerValue(appState.state.invitePowerBonus);
    appState.elements.inviteInput.disabled = Boolean(appState.state.boundInviteCode);
    appState.elements.inviteSubmitButton.disabled = Boolean(appState.state.boundInviteCode);
    appState.elements.inviteInput.value = appState.state.boundInviteCode || appState.elements.inviteInput.value;
  }

  function createRecordCardHtml(title, meta, value) {
    return `
      <article class="p-mining-card p-mining-record-card">
        <h3 class="p-mining-record-card__title">${title}</h3>
        <div class="p-mining-record-card__meta">${meta}</div>
        <div class="p-mining-record-card__value">${value}</div>
      </article>
    `;
  }

  function renderRecordsPanel(appState) {
    let records = appState.state.claimRecords;
    if (appState.activeRecordFilter === 'invites') {
      records = appState.state.inviteRecords;
    } else if (appState.activeRecordFilter === 'power') {
      records = appState.state.powerChanges;
    }

    if (!records.length) {
      appState.elements.recordsList.innerHTML = createRecordCardHtml(t(appState.locale, 'noRecords'), t(appState.locale, 'noRecordMeta'), '0.0');
      return;
    }

    appState.elements.recordsList.innerHTML = records.map((item) => {
      if (appState.activeRecordFilter === 'invites') {
        return createRecordCardHtml(t(appState.locale, 'inviteTitle'), new Date(item.createdAt).toLocaleString('zh-CN'), `+${formatPowerValue(item.reward)}`);
      }
      if (appState.activeRecordFilter === 'power') {
        const title = item.reason === '邀请奖励' ? t(appState.locale, 'reasonInviteReward') : t(appState.locale, 'reasonInitialPower');
        return createRecordCardHtml(title, new Date(item.createdAt).toLocaleString('zh-CN'), `+${formatPowerValue(item.delta)}`);
      }
      return createRecordCardHtml(t(appState.locale, 'claimTitle'), new Date(item.createdAt).toLocaleString('zh-CN'), `+${formatMiningNumber(item.reward)} P`);
    }).join('');
  }

  function renderProfilePanel(appState) {
    appState.elements.profileEmail.textContent = appState.hostUser.email;
    appState.elements.profileUid.textContent = `UID: ${appState.hostUser.uid}`;
    appState.elements.profileBalance.textContent = `${formatMiningNumber(appState.state.balance)} P`;
    appState.elements.profilePower.textContent = formatPowerValue(appState.state.power);
    appState.elements.profileBindStatus.textContent = appState.state.boundInviteCode ? t(appState.locale, 'bindBound') : t(appState.locale, 'bindUnbound');
  }

  function renderAll(appState) {
    applyTranslations(appState);
    renderMiningPanel(appState);
    renderInvitePanel(appState);
    renderRecordsPanel(appState);
    renderProfilePanel(appState);
  }

  function showInviteError(appState, message) {
    if (!message) {
      appState.elements.inviteError.hidden = true;
      appState.elements.inviteError.textContent = '';
      return;
    }
    appState.elements.inviteError.hidden = false;
    appState.elements.inviteError.textContent = message;
  }

  function handleClaimButtonClick(appState) {
    if (appState.isProcessing || !canClaim({ lastClaimAt: appState.state.lastClaimAt, now: Date.now() })) {
      renderClaimState(appState);
      return;
    }

    appState.isProcessing = true;
    const reward = calculateClaimReward({
      userPower: appState.state.power,
      networkPower: appState.network.todayPower,
      dailyCap: appState.network.dailyCap
    });
    appState.state = applyClaimResult(appState.state, {
      reward,
      claimedAt: Date.now()
    });
    appState.network = advanceNetworkStats(appState.network, 60_000);
    saveMiningState(appState.storage, appState.state);
    saveNetworkStats(appState.storage, appState.network);
    renderAll(appState);
    appState.isProcessing = false;
  }

  function handleInviteSubmit(appState) {
    try {
      appState.state = bindInviteCode(appState.state, appState.elements.inviteInput.value);
      saveMiningState(appState.storage, appState.state);
      showInviteError(appState, '');
      renderAll(appState);
    } catch (error) {
      const message = String(error?.message || '');
      if (message.includes('self')) {
        showInviteError(appState, t(appState.locale, 'errorSelfInvite'));
      } else if (message.includes('already')) {
        showInviteError(appState, t(appState.locale, 'errorAlreadyBound'));
      } else if (message.includes('invalid')) {
        showInviteError(appState, t(appState.locale, 'errorInvalidInvite'));
      } else {
        showInviteError(appState, t(appState.locale, 'errorEmptyInvite'));
      }
    }
  }

  function handleCopyInviteCode(appState) {
    const text = appState.state.inviteCode;
    if (globalScope.navigator?.clipboard?.writeText) {
      globalScope.navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  function attachRecordFilters(appState) {
    appState.elements.recordFilterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        appState.activeRecordFilter = button.dataset.recordFilter;
        appState.elements.recordFilterButtons.forEach((item) => {
          item.classList.toggle('is-active', item === button);
        });
        renderRecordsPanel(appState);
      });
    });
  }

  function createBrowserApp(root) {
    const hostUser = getMockNexaUser();
    const storage = globalScope.localStorage;
    const appState = {
      hostUser,
      storage,
      locale: getStoredLocale(storage),
      state: loadMiningState(storage, hostUser),
      network: loadNetworkStats(storage),
      activeTab: 'mining',
      activeRecordFilter: 'claims',
      isProcessing: false,
      elements: {
        panels: Array.from(root.querySelectorAll('[data-tab]')),
        navButtons: Array.from(root.querySelectorAll('[data-tab-target]')),
        recordFilterButtons: Array.from(root.querySelectorAll('[data-record-filter]')),
        localeButtons: Array.from(root.querySelectorAll('[data-locale-toggle]')),
        translatableNodes: Array.from(root.querySelectorAll('[data-i18n]')),
        placeholderNodes: Array.from(root.querySelectorAll('[data-i18n-placeholder]')),
        balanceValue: root.querySelector('#pMiningBalanceValue'),
        powerValue: root.querySelector('#pMiningPowerValue'),
        rewardPerMinute: root.querySelector('#pMiningRewardPerMinute'),
        claimButton: root.querySelector('#pMiningClaimButton'),
        claimCountdown: root.querySelector('#pMiningClaimCountdown'),
        claimHint: root.querySelector('#pMiningClaimHint'),
        totalUsers: root.querySelector('#pMiningTotalUsers'),
        totalMined: root.querySelector('#pMiningTotalMined'),
        todayMined: root.querySelector('#pMiningTodayMined'),
        todayPower: root.querySelector('#pMiningTodayPower'),
        remainingSupply: root.querySelector('#pMiningRemainingSupply'),
        halvingCycle: root.querySelector('#pMiningHalvingCycle'),
        nextHalvingDate: root.querySelector('#pMiningNextHalvingDate'),
        estimatedFinish: root.querySelector('#pMiningEstimatedFinish'),
        inviteCodeValue: root.querySelector('#pMiningInviteCodeValue'),
        inviteCount: root.querySelector('#pMiningInviteCount'),
        inviteBonus: root.querySelector('#pMiningInviteBonus'),
        inviteInput: root.querySelector('#pMiningInviteInput'),
        inviteSubmitButton: root.querySelector('#pMiningInviteSubmitButton'),
        inviteError: root.querySelector('#pMiningInviteError'),
        recordsList: root.querySelector('#pMiningRecordsList'),
        profileEmail: root.querySelector('#pMiningProfileEmail'),
        profileUid: root.querySelector('#pMiningProfileUid'),
        profileBalance: root.querySelector('#pMiningProfileBalance'),
        profilePower: root.querySelector('#pMiningProfilePower'),
        profileBindStatus: root.querySelector('#pMiningProfileBindStatus'),
        copyInviteButton: root.querySelector('#pMiningCopyInviteButton'),
        logoutButton: root.querySelector('#pMiningLogoutButton')
      }
    };

    appState.elements.navButtons.forEach((button) => {
      button.addEventListener('click', () => switchTab(appState, button.dataset.tabTarget));
    });
    appState.elements.localeButtons.forEach((button) => {
      button.addEventListener('click', () => toggleLanguage(appState, button.dataset.localeToggle));
    });
    appState.elements.claimButton?.addEventListener('click', () => handleClaimButtonClick(appState));
    appState.elements.inviteSubmitButton?.addEventListener('click', () => handleInviteSubmit(appState));
    appState.elements.copyInviteButton?.addEventListener('click', () => handleCopyInviteCode(appState));
    appState.elements.logoutButton?.addEventListener('click', () => {
      appState.state = createDefaultMiningState(appState.hostUser);
      saveMiningState(appState.storage, appState.state);
      saveNetworkStats(appState.storage, appState.network);
      showInviteError(appState, '');
      renderAll(appState);
      switchTab(appState, 'mining');
    });
    attachRecordFilters(appState);
    renderAll(appState);
    switchTab(appState, 'mining');
    root.classList.add('is-ready');

    globalScope.window.setInterval(() => {
      renderClaimState(appState);
    }, 1000);

    return appState;
  }

  function bootBrowser() {
    if (!globalScope.document) return;
    const root = globalScope.document.querySelector('[data-p-mining-app]');
    if (!root) return;
    createBrowserApp(root);
  }

  const exported = {
    TOTAL_SUPPLY,
    DAILY_CAP,
    CLAIM_COOLDOWN_MS,
    getMockNexaUser,
    normalizeHostUser,
    createDefaultMiningState,
    createDefaultNetworkStats,
    formatMiningNumber,
    formatWholeNumber,
    formatPowerValue,
    getStoredLocale,
    calculateClaimReward,
    advanceNetworkStats,
    canClaim,
    getClaimCooldownRemainingSeconds,
    applyClaimResult,
    bindInviteCode,
    loadMiningState,
    loadNetworkStats,
    saveNetworkStats,
    getClaimUiState,
    applyTranslations,
    toggleLanguage,
    switchTab,
    renderClaimState,
    handleClaimButtonClick,
    handleInviteSubmit,
    handleCopyInviteCode,
    renderRecordsPanel,
    renderProfilePanel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

  if (globalScope.window) {
    globalScope.window.PMiningPrototype = exported;
    bootBrowser();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
