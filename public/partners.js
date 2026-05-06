const partnersList = document.getElementById('partnersList');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function partnerInitials(name) {
  return String(name || 'P')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function renderPartners(items) {
  if (!partnersList || !Array.isArray(items) || !items.length) return;
  partnersList.innerHTML = items
    .map((item) => {
      const name = String(item.name || '').trim();
      const description = String(item.description || '').trim();
      const url = String(item.url || '#').trim();
      const logo = String(item.logo || '').trim();
      return `
        <article class="game-card">
          ${
            logo
              ? `<div class="game-card__cover"><img src="${escapeHtml(logo)}" alt="${escapeHtml(name)} logo" loading="lazy" decoding="async" /></div>`
              : `<div class="game-card__icon" aria-hidden="true">${escapeHtml(partnerInitials(name))}</div>`
          }
          <div class="game-card__body">
            <h3>${escapeHtml(name)}</h3>
            <p>${escapeHtml(description || '合作伙伴')}</p>
          </div>
          <div class="game-card__actions">
            <a class="game-card__play" href="${escapeHtml(url)}">跳转新页面</a>
          </div>
        </article>
      `;
    })
    .join('');
}

fetch('/api/partners', { cache: 'no-store' })
  .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
  .then((data) => renderPartners(data.items || []))
  .catch(() => {});
