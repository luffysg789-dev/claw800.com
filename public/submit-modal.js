function initSubmitModal(config) {
  const submitForm = document.getElementById('submitForm');
  const openSubmitFormBtn = document.getElementById('openSubmitFormBtn');
  const closeSubmitModalBtn = document.getElementById('closeSubmitModalBtn');
  const submitModal = document.getElementById('submitModal');
  const submitModalMask = document.getElementById('submitModalMask');
  const submitMessage = document.getElementById('submitMessage');
  const categorySelect = document.getElementById('categorySelect');
  const submitMainCategorySelect = document.getElementById('submitMainCategorySelect');

  if (!submitForm || !openSubmitFormBtn || !submitModal || !submitModalMask || !categorySelect) {
    return {
      setTexts() {},
      refreshCategories() {}
    };
  }

  const readTexts = () => (typeof config.getTexts === 'function' ? config.getTexts() || {} : {});
  const localizeError = (message) =>
    typeof config.localizeApiError === 'function' ? config.localizeApiError(message) : message;
  let categoryGroupsCache = [];

  async function loadCategoriesForModal() {
    if (typeof config.getCategories === 'function') {
      const items = await config.getCategories();
      return Array.isArray(items) ? items : [];
    }
    return [];
  }

  async function loadCategoryGroupsForModal() {
    if (typeof config.getCategoryGroups === 'function') {
      const groups = await config.getCategoryGroups();
      if (Array.isArray(groups) && groups.length) return groups;
    }
    const items = await loadCategoriesForModal();
    return [
      {
        value: 'navigation',
        label: readTexts().submitGroupNavigation || readTexts().labelCategory || '分类',
        categories: items
      }
    ];
  }

  function categoryLabel(item) {
    const activeGroup = getSelectedGroup();
    if (typeof activeGroup?.categoryLabel === 'function') {
      return String(activeGroup.categoryLabel(item) || '').trim();
    }
    if (typeof config.categoryLabel === 'function') {
      return String(config.categoryLabel(item) || '').trim();
    }
    return String(item?.category || '').trim();
  }

  function categoryValue(item) {
    return String(item?.category || '').trim();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function groupValue(group, index) {
    return String(group?.value || group?.key || group?.type || `group-${index}`).trim();
  }

  function groupLabel(group, index) {
    return String(group?.label || group?.name || groupValue(group, index)).trim();
  }

  function renderMainCategories(groups) {
    if (!submitMainCategorySelect) return;
    const safeGroups = Array.isArray(groups) ? groups : [];
    submitMainCategorySelect.innerHTML = safeGroups
      .map((group, index) => {
        const value = groupValue(group, index);
        const label = groupLabel(group, index) || value;
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      })
      .join('');
    const preferred = String(config.defaultMainCategory || '').trim();
    if (preferred && safeGroups.some((group, index) => groupValue(group, index) === preferred)) {
      submitMainCategorySelect.value = preferred;
    }
  }

  function getSelectedGroup() {
    if (!submitMainCategorySelect || !categoryGroupsCache.length) return categoryGroupsCache[0] || null;
    const selectedValue = submitMainCategorySelect.value;
    return categoryGroupsCache.find((group, index) => groupValue(group, index) === selectedValue) || categoryGroupsCache[0] || null;
  }

  function renderCategories(items) {
    const safeItems = Array.isArray(items) ? items : [];
    categorySelect.innerHTML = safeItems
      .map((item) => {
        const value = categoryValue(item);
        const label = categoryLabel(item) || value;
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      })
      .join('');
  }

  function renderCategoriesForSelectedGroup() {
    if (!submitMainCategorySelect || !categoryGroupsCache.length) {
      renderCategories(categoryGroupsCache[0]?.categories || []);
      return;
    }
    const selectedGroup = getSelectedGroup();
    renderCategories(Array.isArray(selectedGroup?.categories) ? selectedGroup.categories : []);
  }

  function setTexts() {
    const texts = readTexts();
    if (document.getElementById('submitTitle')) document.getElementById('submitTitle').textContent = texts.submitTitle || '';
    if (document.getElementById('submitDesc')) document.getElementById('submitDesc').textContent = texts.submitDesc || '';
    if (document.getElementById('labelName')) document.getElementById('labelName').childNodes[0].textContent = texts.labelName || '';
    if (document.getElementById('labelUrl')) document.getElementById('labelUrl').childNodes[0].textContent = texts.labelUrl || '';
    if (document.getElementById('labelDesc')) document.getElementById('labelDesc').childNodes[0].textContent = texts.labelDesc || '';
    if (document.getElementById('labelMainCategory')) document.getElementById('labelMainCategory').childNodes[0].textContent = texts.labelMainCategory || '';
    if (document.getElementById('labelCategory')) document.getElementById('labelCategory').childNodes[0].textContent = texts.labelCategory || '';
    if (document.getElementById('labelSubmitter')) document.getElementById('labelSubmitter').childNodes[0].textContent = texts.labelSubmitter || '';
    if (document.getElementById('labelEmail')) document.getElementById('labelEmail').childNodes[0].textContent = texts.labelEmail || '';
    if (document.getElementById('submitBtn')) document.getElementById('submitBtn').textContent = texts.submitBtn || '';
    if (closeSubmitModalBtn) closeSubmitModalBtn.textContent = texts.closeSubmit || '';
    if (categoryGroupsCache.length) {
      renderMainCategories(categoryGroupsCache);
      renderCategoriesForSelectedGroup();
    }
  }

  async function refreshCategories() {
    categoryGroupsCache = await loadCategoryGroupsForModal();
    renderMainCategories(categoryGroupsCache);
    renderCategoriesForSelectedGroup();
  }

  async function openModal() {
    await refreshCategories();
    submitModal.classList.remove('hidden');
  }

  function closeModal() {
    submitModal.classList.add('hidden');
  }

  openSubmitFormBtn.addEventListener('click', openModal);
  if (closeSubmitModalBtn) closeSubmitModalBtn.addEventListener('click', closeModal);
  submitModalMask.addEventListener('click', closeModal);
  if (submitMainCategorySelect) submitMainCategorySelect.addEventListener('change', renderCategoriesForSelectedGroup);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  submitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitMessage.textContent = '';

    const payload = Object.fromEntries(new FormData(submitForm).entries());
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      submitMessage.textContent = localizeError(data.error);
      submitMessage.className = 'message error';
      return;
    }

    const texts = readTexts();
    submitMessage.textContent = texts.submitSuccess || data.message || '';
    submitMessage.className = 'message success';
    submitForm.reset();
    await refreshCategories();
    closeModal();
  });

  return {
    setTexts,
    refreshCategories
  };
}

window.initSubmitModal = initSubmitModal;
