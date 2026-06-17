import { api, ApiError } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast, mediaUrl, fmtDate } from './ui.js?v=20260617-ai-music-payment-refresh';
import { toggleGlobalSong } from './player.js?v=20260617-ai-music-payment-refresh';

export function publicSongIdFromPath(pathname = location.pathname) {
  const match = String(pathname || '').match(/^\/ai-music\/song\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export function renderPublicSong(root, songId = publicSongIdFromPath()) {
  clear(root);
  const wrap = el('div', { class: 'gm-public-song' }, [
    el('div', { class: 'gm-square-empty', text: '加载中...' })
  ]);
  root.appendChild(wrap);
  load(wrap, songId);
}

async function load(wrap, songId) {
  clear(wrap);
  if (!songId) {
    wrap.appendChild(el('div', { class: 'gm-square-empty', text: '歌曲不存在' }));
    return;
  }
  let payload;
  try {
    payload = await api.publicSong(songId);
  } catch (error) {
    wrap.appendChild(el('div', { class: 'gm-square-empty', text: error instanceof ApiError ? error.message : '歌曲不存在' }));
    return;
  }
  const song = payload.song || {};
  const title = song.title || '未命名';
  const cover = mediaUrl(song.image_url || song.cover_url || '');
  const plays = el('div', { class: 'gm-public-plays', text: formatPlayCount(song) });
  wrap.appendChild(el('article', { class: 'gm-public-card' }, [
    el('div', { class: 'gm-public-cover', style: cover ? `background-image:url("${cover}")` : '' }),
    el('div', { class: 'gm-public-body' }, [
      el('div', { class: 'gm-song-meta', text: 'AI 音乐公开作品' }),
      el('h1', { class: 'gm-public-title', text: title }),
      plays,
      el('div', { class: 'gm-song-meta', text: fmtDate(song.created_at) }),
      el('div', { class: 'gm-actions' }, [
        el('button', { type: 'button', class: 'gm-btn-primary gm-public-play', text: '播放歌曲', onclick: () => playPublicSong(song, plays) }),
        el('button', { type: 'button', class: 'gm-btn-ghost', text: '复制链接', onclick: () => shareSong(song) }),
        el('a', { class: 'gm-btn-ghost', href: '/ai-music/#square', text: '去广场' }),
        el('a', { class: 'gm-btn-ghost', href: '/ai-music/#generate', text: '我也写歌' })
      ])
    ])
  ]));
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
    // 播放不依赖计数成功。
  }
}

function shareSong(song) {
  const title = song.title || 'AI 歌曲';
  const url = `${location.origin}/ai-music/song/${encodeURIComponent(String(song.id || ''))}`;
  const text = `我在 claw800.com 用 AI 1 分钟做了首歌《${title}》, 你也来做一首: ${url}`;
  navigator.clipboard?.writeText(text).then(() => toast('已复制', 'success')).catch(() => toast(text, 'info'));
}
