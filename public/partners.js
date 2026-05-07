const partnersList = document.getElementById('partnersList');
let currentPartners = [];

const DEFAULT_PARTNERS = [
  {
    name: 'LUCKY STAR INVESTMENT L.L.C',
    description: '迪拜注册投资公司，连接产业、资本与跨境合作机会。',
    url: '/lucky-star/'
  },
  {
    name: 'Panda Dog Thailand',
    description: '泰国 Live Commerce、创意制作、KOL 管理与线下活动执行合作伙伴。',
    url: '/panda-dog-thailand/'
  }
];

const PARTNER_I18N = {
  'LUCKY STAR INVESTMENT L.L.C': {
    description: 'Dubai-registered investment company connecting industries, capital, and cross-border partnership opportunities.'
  },
  'Panda Dog Thailand': {
    description: 'Thailand Live Commerce partner for creative production, KOL management, and offline event execution.'
  }
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCurrentMenuLang() {
  try {
    return String(window.localStorage.getItem('claw800_lang') || '').trim() === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

function localizePartner(item) {
  if (getCurrentMenuLang() !== 'en') return item;
  const name = String(item.name || '').trim();
  const translation = PARTNER_I18N[name];
  if (!translation) return item;
  return {
    ...item,
    description: translation.description || item.description
  };
}

function renderPartners(items) {
  if (!partnersList || !Array.isArray(items) || !items.length) return;
  currentPartners = items;
  const actionText = getCurrentMenuLang() === 'en' ? 'Visit Website' : '查看官网';
  partnersList.innerHTML = items
    .map((item) => {
      const displayItem = localizePartner(item);
      const name = String(displayItem.name || '').trim();
      const description = String(displayItem.description || '').trim();
      const url = String(displayItem.url || '#').trim();
      return `
        <article class="game-card">
          <div class="game-card__body">
            <h3>${escapeHtml(name)}</h3>
            <p>${escapeHtml(description || '合作伙伴')}</p>
          </div>
          <div class="game-card__actions">
            <a class="game-card__play" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(actionText)}</a>
          </div>
        </article>
      `;
    })
    .join('');
}

renderPartners(DEFAULT_PARTNERS);

window.addEventListener('claw800-language-change', () => {
  renderPartners(currentPartners);
});

fetch('/api/partners', { cache: 'no-store' })
  .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
  .then((data) => renderPartners(data.items || []))
  .catch(() => {});
