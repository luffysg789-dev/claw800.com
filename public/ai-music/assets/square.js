import { api, ApiError } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast, mediaUrl, fmtDate } from './ui.js?v=20260617-ai-music-payment-refresh';
import { toggleGlobalSong } from './player.js?v=20260617-ai-music-payment-refresh';

let state = { page: 1, page_size: 20, q: '' };

export function renderSquare(root) {
  clear(root);
  state = { page: 1, page_size: 20, q: '' };

  const wrap = el('div', { class: 'gm-square' }, [
    el('div', { class: 'gm-head' }, [
      el('h2', { text: '音乐广场' }),
      el('a', { class: 'gm-btn-ghost sm', href: '#generate', text: '写歌' })
    ]),
    searchBox(root),
    el('div', { id: 'gm-square-feed', class: 'gm-square-grid' }),
    el('div', { id: 'gm-square-pager', class: 'gm-square-pager' })
  ]);
  root.appendChild(wrap);
  load(root);
}

function searchBox(root) {
  const input = el('input', { class: 'gm-input', type: 'text', placeholder: '搜索公开歌曲...' });
  const go = () => {
    state.q = input.value.trim();
    state.page = 1;
    load(root);
  };
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') go(); });
  return el('div', { class: 'gm-square-search' }, [
    input,
    el('button', { type: 'button', class: 'gm-btn-ghost', text: '搜索', onclick: go })
  ]);
}

async function load(root) {
  const feed = root.querySelector('#gm-square-feed');
  const pager = root.querySelector('#gm-square-pager');
  clear(feed);
  clear(pager);
  feed.appendChild(el('div', { class: 'gm-square-empty', text: '加载中...' }));
  let data;
  try {
    data = await api.publicSongs(state);
  } catch (error) {
    clear(feed);
    feed.appendChild(el('div', { class: 'gm-square-empty', text: error instanceof ApiError ? error.message : '加载失败' }));
    return;
  }
  clear(feed);
  const songs = data.songs || [];
  if (!songs.length) {
    feed.appendChild(el('div', { class: 'gm-square-empty', text: state.q ? '没有找到匹配歌曲' : '广场还没有歌曲' }));
    return;
  }
  songs.forEach((song) => feed.appendChild(squareCard(song)));
  renderPager(root, data.total || songs.length);
}

function squareCard(song) {
  const title = song.title || '未命名';
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
      el('div', { class: 'gm-song-meta', text: fmtDate(song.created_at) }),
      el('div', { class: 'gm-actions' }, [
        el('button', { type: 'button', class: 'gm-btn-ghost sm', text: '播放', onclick: () => toggleGlobalSong(song) }),
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
    text: '下一页',
    disabled: state.page >= totalPages,
    onclick: () => { state.page += 1; load(root); }
  }));
}

function shareSong(song) {
  const title = song.title || 'AI 歌曲';
  const url = `${location.origin}/ai-music/song/${encodeURIComponent(String(song.id || ''))}`;
  const text = `我在 claw800.com 用 AI 1 分钟做了首歌《${title}》, 你也来做一首: ${url}`;
  navigator.clipboard?.writeText(text).then(() => toast('已复制', 'success')).catch(() => toast(text, 'info'));
}
