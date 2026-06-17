import { api, ApiError } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast, mediaUrl } from './ui.js?v=20260617-ai-music-payment-refresh';
import { toggleGlobalSong } from './player.js?v=20260617-ai-music-payment-refresh';

let state = { page: 1, page_size: 20, q: '', loading: false, hasMore: true };
let squareObserver = null;
let searchTimer = null;

export function renderSquare(root) {
  clear(root);
  state = { page: 1, page_size: 20, q: '', loading: false, hasMore: true };
  if (squareObserver) {
    squareObserver.disconnect();
    squareObserver = null;
  }

  const wrap = el('div', { class: 'gm-square' }, [
    el('div', { class: 'gm-head' }, [
      el('h2', { text: '音乐广场' }),
      el('a', { class: 'hh-my-create-btn', href: '#generate', text: '写歌' })
    ]),
    searchBox(root),
    el('div', { id: 'gm-square-feed', class: 'gm-square-grid' }),
    el('div', { id: 'gm-square-pager', class: 'gm-square-pager' }),
    el('button', { type: 'button', id: 'gm-square-sentinel', class: 'gm-square-sentinel', text: '上拉加载更多', onclick: () => loadMore(root) })
  ]);
  root.appendChild(wrap);
  setupAutoLoad(root);
  load(root);
}

function searchBox(root) {
  const input = el('input', { class: 'gm-input', type: 'text', placeholder: '搜索公开歌曲...' });
  const go = () => {
    state.q = input.value.trim();
    state.page = 1;
    state.hasMore = true;
    load(root);
  };
  const scheduleSearch = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => go(), 320);
  };
  input.addEventListener('input', scheduleSearch);
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') go(); });
  return el('div', { class: 'gm-square-search' }, [
    input,
    el('button', { type: 'button', class: 'gm-btn-ghost', text: '搜索', onclick: go })
  ]);
}

async function load(root, { append = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  const feed = root.querySelector('#gm-square-feed');
  const pager = root.querySelector('#gm-square-pager');
  const sentinel = root.querySelector('#gm-square-sentinel');
  clear(pager);
  if (!append) {
    clear(feed);
    feed.appendChild(el('div', { class: 'gm-square-empty', text: '加载中...' }));
  }
  if (sentinel) {
    sentinel.hidden = false;
    sentinel.disabled = true;
    sentinel.textContent = append ? '正在加载更多...' : '加载中...';
  }
  let data;
  try {
    data = await api.publicSongs(state);
  } catch (error) {
    if (!append) {
      clear(feed);
      feed.appendChild(el('div', { class: 'gm-square-empty', text: error instanceof ApiError ? error.message : '加载失败' }));
    } else {
      toast(error instanceof ApiError ? error.message : '加载失败', 'error');
    }
    state.loading = false;
    updateSentinel(root);
    return;
  }
  if (!append) clear(feed);
  const songs = data.songs || [];
  if (!songs.length) {
    if (!append) {
      feed.appendChild(el('div', { class: 'gm-square-empty', text: state.q ? '没有找到匹配歌曲' : '广场还没有歌曲' }));
    }
    state.hasMore = false;
    state.loading = false;
    updateSentinel(root);
    return;
  }
  songs.forEach((song) => feed.appendChild(squareCard(song)));
  const total = Number(data.total || 0) || 0;
  const loaded = feed.querySelectorAll('.gm-square-card').length;
  state.hasMore = total ? loaded < total : songs.length >= state.page_size;
  state.loading = false;
  renderPager(root, total || loaded);
  updateSentinel(root);
}

function squareCard(song) {
  const title = song.title || '未命名';
  const author = String(song.author_nickname || song.authorNickname || '').trim();
  const cover = mediaUrl(song.image_url || song.cover_url || '');
  const plays = el('div', { class: 'gm-square-plays', text: formatPlayCount(song) });
  const coverChildren = [
    cover ? el('img', {
      class: 'gm-square-cover-img',
      src: cover,
      alt: title,
      loading: 'lazy',
      onerror: (event) => { event.currentTarget.remove(); }
    }) : null,
    el('span', { class: 'gm-square-play', text: '▶' })
  ].filter(Boolean);
  const card = el('article', { class: 'gm-square-card' }, [
    el('button', {
      type: 'button',
      class: 'gm-square-cover',
      'aria-label': '播放 ' + title,
      onclick: () => playPublicSong(song, plays)
    }, coverChildren),
    el('div', { class: 'gm-square-info' }, [
      el('div', { class: 'gm-square-title-row' }, [
        el('a', { class: 'gm-square-title', href: `/ai-music/song/${encodeURIComponent(String(song.id || ''))}`, text: title }),
        plays
      ]),
      el('div', { class: 'gm-square-author-row' }, [
        el('div', { class: 'gm-square-author', text: author ? `作者：${author}` : '作者：匿名' }),
        el('div', { class: 'gm-square-actions' }, [
          el('button', { type: 'button', class: 'gm-btn-ghost sm gm-square-lyrics', text: '歌词', onclick: () => showLyrics(song) }),
          el('button', { type: 'button', class: 'gm-btn-ghost sm gm-square-share', text: '分享', onclick: () => shareSong(song) })
        ])
      ]),
    ])
  ]);
  return card;
}

function getPlayCount(song = {}) {
  return Math.max(0, Number(song.play_count ?? song.playCount ?? 0) || 0);
}

function formatPlayCount(song = {}) {
  return `播放 ${getPlayCount(song)} 次`;
}

async function playPublicSong(song, countEl) {
  const started = toggleGlobalSong(song);
  if (!started || !song?.id) return;
  try {
    const payload = await api.recordPublicPlay(song.id);
    const next = Math.max(0, Number(payload.play_count ?? payload.playCount ?? getPlayCount(song) + 1) || 0);
    song.play_count = next;
    song.playCount = next;
    if (countEl) countEl.textContent = formatPlayCount(song);
  } catch {
    // 播放不能被计数接口影响。
  }
}

function extractLyricsPayload(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.trim();
  const candidates = [
    payload.lyrics,
    payload.lyric,
    payload.text,
    payload.lrc,
    payload.raw,
    payload.data?.lyrics,
    payload.data?.lyric,
    payload.data?.text,
    payload.data?.lrc,
    payload.data?.raw,
    payload.song?.lyrics,
    payload.song?.lyric,
    payload.song?.text,
    payload.song?.lrc
  ];
  return String(candidates.find((value) => value != null && String(value).trim()) || '').trim();
}

function fallbackCopy(text, done) {
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.focus();
  area.select();
  try { document.execCommand('copy'); done?.(); } catch {}
  area.remove();
}

function openLyricsModal(song) {
  const overlay = el('div', { class: 'gm-square-lyrics-mask' });
  const close = () => overlay.remove();
  const title = song.title || '未命名';
  const body = el('pre', { class: 'gm-square-lyrics-body', text: '加载中...' });
  const copyBtn = el('button', { type: 'button', class: 'gm-square-lyrics-copy', text: '复制歌词', disabled: true });
  overlay.appendChild(el('div', { class: 'gm-square-lyrics-card' }, [
    el('button', { type: 'button', class: 'gm-square-lyrics-close', html: '&times;', onclick: close }),
    el('h3', { text: '歌词' }),
    el('div', { class: 'gm-square-lyrics-title', text: title }),
    body,
    el('div', { class: 'gm-square-lyrics-footer' }, [
      copyBtn,
      el('button', { type: 'button', class: 'gm-square-lyrics-done', text: '关闭', onclick: close })
    ])
  ]));
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  document.body.appendChild(overlay);
  return { body, copyBtn };
}

async function showLyrics(song) {
  const { body, copyBtn } = openLyricsModal(song);
  let lyrics = String(song.lyrics || song.lyric || '').trim();
  try {
    if (!lyrics && song.id) {
      const payload = await api.publicSongLyrics(song.id);
      lyrics = extractLyricsPayload(payload);
    }
    body.textContent = lyrics || '暂无歌词';
    song.lyrics = lyrics || song.lyrics;
  } catch (error) {
    body.textContent = error instanceof ApiError ? error.message : '歌词加载失败';
  }
  copyBtn.disabled = !lyrics;
  copyBtn.onclick = () => {
    if (!lyrics) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(lyrics).then(() => toast('歌词已复制', 'success')).catch(() => fallbackCopy(lyrics, () => toast('歌词已复制', 'success')));
    } else {
      fallbackCopy(lyrics, () => toast('歌词已复制', 'success'));
    }
  };
}

function renderPager(root, total) {
  const pager = root.querySelector('#gm-square-pager');
  const totalPages = Math.max(1, Math.ceil((Number(total || 0) || 0) / state.page_size));
  if (totalPages <= 1) return;
  pager.appendChild(el('button', {
    type: 'button',
    class: 'gm-btn-ghost sm',
    text: '上一页',
    disabled: state.page <= 1,
    onclick: () => { state.page -= 1; load(root); }
  }));
  pager.appendChild(el('span', { class: 'gm-song-meta', text: `${state.page}/${totalPages}` }));
  pager.appendChild(el('button', {
    type: 'button',
    class: 'gm-btn-ghost sm',
    text: state.hasMore ? '加载更多' : '没有更多',
    disabled: !state.hasMore,
    onclick: () => loadMore(root)
  }));
}

function loadMore(root) {
  if (state.loading || !state.hasMore) return;
  state.page += 1;
  load(root, { append: true }).then(() => {
    root.querySelector('#gm-square-sentinel')?.scrollIntoView({ block: 'nearest' });
  });
}

function updateSentinel(root) {
  const sentinel = root.querySelector('#gm-square-sentinel');
  if (!sentinel) return;
  sentinel.disabled = state.loading || !state.hasMore;
  sentinel.hidden = false;
  sentinel.textContent = state.loading ? '加载中...' : (state.hasMore ? '上拉加载更多' : '已经到底了');
}

function setupAutoLoad(root) {
  const sentinel = root.querySelector('#gm-square-sentinel');
  if (!sentinel || !('IntersectionObserver' in window)) return;
  squareObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadMore(root);
  }, { root: null, rootMargin: '260px 0px 360px', threshold: 0.01 });
  squareObserver.observe(sentinel);
}

function shareSong(song) {
  const title = song.title || 'AI 歌曲';
  const url = `${location.origin}/ai-music/song/${encodeURIComponent(String(song.id || ''))}`;
  const text = `我在 claw800.com 用 AI 1 分钟做了首歌《${title}》, 你也来做一首: ${url}`;
  navigator.clipboard?.writeText(text).then(() => toast('已复制', 'success')).catch(() => toast(text, 'info'));
}
