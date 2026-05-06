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
        <article class="partner-card">
          ${
            logo
              ? `<img class="partner-logo-image" src="${escapeHtml(logo)}" alt="${escapeHtml(name)} logo" loading="lazy" decoding="async" />`
              : `<div class="partner-logo-fallback">${escapeHtml(partnerInitials(name))}</div>`
          }
          <div>
            <h3>${escapeHtml(name)}</h3>
            <p>${escapeHtml(description || '合作伙伴')}</p>
            <a href="${escapeHtml(url)}">查看合作伙伴</a>
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
