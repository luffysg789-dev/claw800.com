function initSubmitModal(config) {
  const submitForm = document.getElementById('submitForm');
  const openSubmitFormBtn = document.getElementById('openSubmitFormBtn');
  const closeSubmitModalBtn = document.getElementById('closeSubmitModalBtn');
  const submitModal = document.getElementById('submitModal');
  const submitModalMask = document.getElementById('submitModalMask');
  const submitMessage = document.getElementById('submitMessage');
  const categorySelect = document.getElementById('categorySelect');

  if (!submitForm || !openSubmitFormBtn || !submitModal || !submitModalMask || !categorySelect) {
    return {
      setTexts() {},
      refreshCategories() {}
    };
  }

  const readTexts = () => (typeof config.getTexts === 'function' ? config.getTexts() || {} : {});
  const localizeError = (message) =>
    typeof config.localizeApiError === 'function' ? config.localizeApiError(message) : message;

  async function loadCategoriesForModal() {
    if (typeof config.getCategories === 'function') {
      const items = await config.getCategories();
      return Array.isArray(items) ? items : [];
    }
    return [];
  }

  function categoryLabel(item) {
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

  function setTexts() {
    const texts = readTexts();
    if (document.getElementById('submitTitle')) document.getElementById('submitTitle').textContent = texts.submitTitle || '';
    if (document.getElementById('submitDesc')) document.getElementById('submitDesc').textContent = texts.submitDesc || '';
    if (document.getElementById('labelName')) document.getElementById('labelName').childNodes[0].textContent = texts.labelName || '';
    if (document.getElementById('labelUrl')) document.getElementById('labelUrl').childNodes[0].textContent = texts.labelUrl || '';
    if (document.getElementById('labelDesc')) document.getElementById('labelDesc').childNodes[0].textContent = texts.labelDesc || '';
    if (document.getElementById('labelCategory')) document.getElementById('labelCategory').childNodes[0].textContent = texts.labelCategory || '';
    if (document.getElementById('labelSubmitter')) document.getElementById('labelSubmitter').childNodes[0].textContent = texts.labelSubmitter || '';
    if (document.getElementById('labelEmail')) document.getElementById('labelEmail').childNodes[0].textContent = texts.labelEmail || '';
    if (document.getElementById('submitBtn')) document.getElementById('submitBtn').textContent = texts.submitBtn || '';
    if (closeSubmitModalBtn) closeSubmitModalBtn.textContent = texts.closeSubmit || '';
  }

  async function refreshCategories() {
    const items = await loadCategoriesForModal();
    renderCategories(items);
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
