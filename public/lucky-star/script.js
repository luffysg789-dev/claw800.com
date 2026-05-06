(function () {
  const buttons = Array.from(document.querySelectorAll('[data-lang]'));
  const translatable = Array.from(document.querySelectorAll('[data-zh][data-en][data-ar]'));
  const storageKey = 'lucky-star-language';
  const galleryItems = Array.from(document.querySelectorAll('.gallery-item img'));
  const lightbox = document.querySelector('.gallery-lightbox');
  const lightboxImage = document.querySelector('[data-lightbox-image]');
  const lightboxCaption = document.querySelector('[data-lightbox-caption]');
  const lightboxClose = document.querySelector('[data-lightbox-close]');
  const lightboxNext = document.querySelector('[data-lightbox-next]');
  const lightboxPrev = document.querySelector('[data-lightbox-prev]');
  let activeImageIndex = 0;

  function setLanguage(language) {
    const normalized = language === 'en' || language === 'ar' ? language : 'zh';

    document.documentElement.lang = normalized === 'ar' ? 'ar' : normalized === 'en' ? 'en' : 'zh-CN';
    document.documentElement.dir = normalized === 'ar' ? 'rtl' : 'ltr';

    for (const element of translatable) {
      element.textContent = element.dataset[normalized];
    }

    for (const button of buttons) {
      const isActive = button.dataset.lang === normalized;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }

    try {
      window.localStorage.setItem(storageKey, normalized);
    } catch (_) {
      // Ignore storage failures in restricted browser contexts.
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => setLanguage(button.dataset.lang));
  }

  function showLightboxImage(index) {
    if (!galleryItems.length || !lightboxImage || !lightboxCaption) {
      return;
    }

    activeImageIndex = (index + galleryItems.length) % galleryItems.length;
    const activeImage = galleryItems[activeImageIndex];

    lightboxImage.src = activeImage.currentSrc || activeImage.src;
    lightboxImage.alt = activeImage.alt;
    lightboxCaption.textContent = activeImage.alt;
  }

  function openLightbox(index) {
    if (!lightbox) {
      return;
    }

    showLightboxImage(index);
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) {
      return;
    }

    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  galleryItems.forEach((image, index) => {
    const button = image.closest('button');
    if (button) {
      button.addEventListener('click', () => openLightbox(index));
    }
  });

  lightboxNext?.addEventListener('click', () => showLightboxImage(activeImageIndex + 1));
  lightboxPrev?.addEventListener('click', () => showLightboxImage(activeImageIndex - 1));
  lightboxClose?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', (event) => {
    const clickedPreviewContent = event.target.closest('[data-lightbox-image], button');
    if (!clickedPreviewContent) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!lightbox?.classList.contains('is-open')) {
      return;
    }

    if (event.key === 'Escape') {
      closeLightbox();
    } else if (event.key === 'ArrowRight') {
      showLightboxImage(activeImageIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      showLightboxImage(activeImageIndex - 1);
    }
  });

  let savedLanguage = 'zh';
  try {
    savedLanguage = window.localStorage.getItem(storageKey) || savedLanguage;
  } catch (_) {
    savedLanguage = 'zh';
  }

  setLanguage(savedLanguage);
})();
