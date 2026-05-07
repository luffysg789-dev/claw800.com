(() => {
  const LANG_KEY = 'claw800_lang';
  const texts = {
    zh: {
      htmlLang: 'zh-CN',
      homeBtn: '首页',
      skillsBtn: '技能',
      gamesBtn: '游戏与工具',
      partnersBtn: '伙伴',
      githubStarBtn: 'GitHub 加星',
      heroSubtitle: '龙虾学习导航网，为你的龙虾赋能。'
    },
    en: {
      htmlLang: 'en',
      homeBtn: 'Home',
      skillsBtn: 'Skills',
      gamesBtn: 'Tools',
      partnersBtn: 'Partners',
      githubStarBtn: 'Star on GitHub',
      heroSubtitle: 'OpenClaw ecosystem directory for AI websites'
    }
  };

  const getById = (id) => document.getElementById(id);
  const normalizeLang = (value) => (value === 'en' ? 'en' : 'zh');
  let currentLang = normalizeLang(localStorage.getItem(LANG_KEY));

  function applyMenuLanguage(language) {
    currentLang = normalizeLang(language);
    localStorage.setItem(LANG_KEY, currentLang);

    const text = texts[currentLang];
    document.documentElement.lang = text.htmlLang;

    const heroSubtitle = getById('heroSubtitle');
    const homeNavBtn = getById('homeNavBtn');
    const skillsNavBtn = getById('skillsNavBtn');
    const gamesNavBtn = getById('gamesNavBtn');
    const partnersNavBtn = getById('partnersNavBtn');
    const githubStarBtn = getById('githubStarBtn');

    if (heroSubtitle) heroSubtitle.textContent = text.heroSubtitle;
    if (homeNavBtn) homeNavBtn.textContent = text.homeBtn;
    if (skillsNavBtn) skillsNavBtn.textContent = text.skillsBtn;
    if (gamesNavBtn) gamesNavBtn.textContent = text.gamesBtn;
    if (partnersNavBtn) partnersNavBtn.textContent = text.partnersBtn;
    if (githubStarBtn) {
      githubStarBtn.setAttribute('aria-label', text.githubStarBtn);
      githubStarBtn.setAttribute('title', text.githubStarBtn);
    }
    window.dispatchEvent(new CustomEvent('claw800-language-change', { detail: { lang: currentLang } }));
  }

  function closeLangMenu() {
    const langMenuBtn = getById('langMenuBtn');
    const langMenuPopup = getById('langMenuPopup');
    if (!langMenuBtn || !langMenuPopup) return;
    langMenuPopup.classList.add('hidden');
    langMenuBtn.setAttribute('aria-expanded', 'false');
  }

  function bindLanguageMenu() {
    const langMenuBtn = getById('langMenuBtn');
    const langMenuPopup = getById('langMenuPopup');
    if (!langMenuBtn || !langMenuPopup) return;

    langMenuBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const isHidden = langMenuPopup.classList.toggle('hidden');
      langMenuBtn.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
    });

    langMenuPopup.addEventListener('click', (event) => {
      const button = event.target?.closest?.('button[data-lang]');
      if (!button) return;
      applyMenuLanguage(button.dataset.lang);
      closeLangMenu();
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (langMenuBtn.contains(target) || langMenuPopup.contains(target)) return;
      closeLangMenu();
    });
  }

  applyMenuLanguage(currentLang);
  bindLanguageMenu();
})();
