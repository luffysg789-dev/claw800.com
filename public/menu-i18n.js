(() => {
  const LANG_KEY = 'claw800_lang';
  const texts = {
    zh: {
      htmlLang: 'zh-CN',
      homeBtn: '首页',
      skillsBtn: '技能',
      gamesBtn: '游戏与工具',
      partnersBtn: '伙伴',
      openSubmit: '提交',
      githubStarBtn: 'GitHub 加星',
      heroSubtitle: '龙虾学习导航网，为你的龙虾赋能。',
      submitTitle: '免费提交网站',
      submitDesc: '提交后进入审核，管理员通过后展示在首页。',
      labelName: '网站名称',
      labelUrl: '网站地址',
      labelDesc: '一句话简介',
      labelCategory: '分类',
      labelSubmitter: '提交人',
      labelEmail: '邮箱',
      submitBtn: '提交审核',
      closeSubmit: '关闭',
      submitSuccess: '提交成功，等待管理员审核'
    },
    en: {
      htmlLang: 'en',
      homeBtn: 'Home',
      skillsBtn: 'Skills',
      gamesBtn: 'Tools',
      partnersBtn: 'Partners',
      openSubmit: 'Submit',
      githubStarBtn: 'Star on GitHub',
      heroSubtitle: 'OpenClaw ecosystem directory for AI websites',
      submitTitle: 'Submit a Website',
      submitDesc: 'Submissions are reviewed by admins before they appear on the homepage.',
      labelName: 'Website Name',
      labelUrl: 'Website URL',
      labelDesc: 'Short Description',
      labelCategory: 'Category',
      labelSubmitter: 'Submitted By',
      labelEmail: 'Email',
      submitBtn: 'Submit for Review',
      closeSubmit: 'Close',
      submitSuccess: 'Submitted successfully. Waiting for admin review.'
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
    const openSubmitFormBtn = getById('openSubmitFormBtn');
    const githubStarBtn = getById('githubStarBtn');

    if (heroSubtitle) heroSubtitle.textContent = text.heroSubtitle;
    if (homeNavBtn) homeNavBtn.textContent = text.homeBtn;
    if (skillsNavBtn) skillsNavBtn.textContent = text.skillsBtn;
    if (gamesNavBtn) gamesNavBtn.textContent = text.gamesBtn;
    if (partnersNavBtn) partnersNavBtn.textContent = text.partnersBtn;
    if (openSubmitFormBtn) openSubmitFormBtn.textContent = text.openSubmit;
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

  const submitModalController = window.initSubmitModal?.({
    getTexts: () => texts[currentLang],
    getCategories: async () => [{ category: currentLang === 'en' ? 'Tools' : '工具' }],
    categoryLabel: (item) => item.category
  });
  submitModalController?.setTexts();
})();
