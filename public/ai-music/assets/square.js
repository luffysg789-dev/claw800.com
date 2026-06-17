import { api, ApiError } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast, mediaUrl, fmtDate } from './ui.js?v=20260617-ai-music-payment-refresh';
import { toggleGlobalSong } from './player.js?v=20260617-ai-music-payment-refresh';

let state = { page: 1, page_size: 20, q: '', loading: false, hasMore: true };
let squareObserver = null;

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
      el('a', { class: 'gm-btn-ghost sm', href: '#generate', text: '写歌' })
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
  const card = el('article', { class: 'gm-square-card' }, [
    el('button', {
      type: 'button',
      class: 'gm-square-cover',
      style: cover ? `background-image:url("${cover}")` : '',
      'aria-label': '播放 ' + title,
      onclick: () => toggleGlobalSong(song)
    }, [
      el('span', { class: 'gm-square-play', text: '▶' })
    ]),
    el('div', { class: 'gm-square-info' }, [
      el('a', { class: 'gm-square-title', href: `/ai-music/song/${encodeURIComponent(String(song.id || ''))}`, text: title }),
      el('div', { class: 'gm-square-author', text: author ? `作者：${author}` : '作者：匿名' }),
      el('div', { class: 'gm-song-meta', text: fmtDate(song.created_at) }),
      el('div', { class: 'gm-actions gm-square-actions' }, [
        el('button', { type: 'button', class: 'gm-btn-ghost sm', text: '分享', onclick: () => shareSong(song) })
      ])
    ])
  ]);
  return card;
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
