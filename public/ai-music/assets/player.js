import { api } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, fmtDuration, mediaUrl, toast } from './ui.js?v=20260617-ai-music-payment-refresh';

let audio = null;
let currentSong = null;
let playerEl = null;
let lyricLines = [];
let lyricIndex = -1;

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function parseLyrics(raw) {
  return cleanText(raw)
    .split(/\r?\n+/)
    .map((line) => line.replace(/\[[0-9:.]+\]/g, '').trim())
    .filter(Boolean)
    .slice(0, 80);
}

function extractLyricsPayload(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.trim();
  const candidates = [
    payload.lyrics,
    payload.lyric,
    payload.text,
    payload.lrc,
    payload.data?.lyrics,
    payload.data?.lyric,
    payload.data?.text,
    payload.data?.lrc,
    payload.song?.lyrics,
    payload.song?.lyric
  ];
  return String(candidates.find((value) => value != null && String(value).trim()) || '').trim();
}

async function loadSongLyrics(song, songId) {
  if (!songId) return;
  try {
    const payload = await api.songLyrics(songId);
    const text = extractLyricsPayload(payload);
    if (!text || cleanText(currentSong?.id) !== songId) return;
    currentSong = { ...currentSong, lyrics: text };
    lyricLines = parseLyrics(text);
    lyricIndex = -1;
    updateLyric(true);
  } catch {
    // 歌词接口不可用时保留标题，不影响播放。
  }
}

function emitState() {
  window.dispatchEvent(new CustomEvent('gm-global-player-state', {
    detail: {
      songId: cleanText(currentSong?.id),
      playing: !!(audio && !audio.paused && !audio.ended)
    }
  }));
}

function setHidden(hidden) {
  ensurePlayer();
  playerEl.hidden = !!hidden;
  document.body.classList.toggle('gm-has-mini-player', !hidden);
}

function updateLyric(force = false) {
  if (!playerEl || !currentSong) return;
  const track = playerEl.querySelector('[data-role="lyric"]');
  if (!track) return;
  if (!lyricLines.length) {
    track.textContent = cleanText(currentSong.title) || 'AI 音乐';
    return;
  }
  const nextIndex = Math.max(0, Math.min(lyricLines.length - 1, Math.floor(((audio && audio.currentTime) || 0) / 6) % lyricLines.length));
  if (!force && nextIndex === lyricIndex) return;
  lyricIndex = nextIndex;
  track.textContent = lyricLines[lyricIndex];
  track.style.animation = 'none';
  track.offsetHeight;
  track.style.animation = '';
}

function updateUi() {
  if (!playerEl || !currentSong) return;
  const title = playerEl.querySelector('[data-role="title"]');
  const cover = playerEl.querySelector('[data-role="cover"]');
  const play = playerEl.querySelector('[data-role="play"]');
  const cur = playerEl.querySelector('[data-role="current"]');
  const total = playerEl.querySelector('[data-role="total"]');
  const fill = playerEl.querySelector('[data-role="fill"]');
  const isPlaying = !!(audio && !audio.paused && !audio.ended);
  if (title) title.textContent = cleanText(currentSong.title) || '未命名';
  if (cover) {
    const image = mediaUrl(currentSong.image_url || currentSong.cover_url || '');
    cover.style.backgroundImage = image ? `url("${image}")` : '';
  }
  if (play) play.textContent = isPlaying ? '暂停' : '播放';
  if (cur) cur.textContent = fmtDuration((audio && audio.currentTime) || 0);
  if (total) total.textContent = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? fmtDuration(audio.duration) : '--:--';
  if (fill) {
    const duration = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const pct = duration ? Math.max(0, Math.min(100, ((audio.currentTime || 0) / duration) * 100)) : 0;
    fill.style.width = pct + '%';
  }
  playerEl.classList.toggle('is-playing', isPlaying);
  updateLyric();
  emitState();
}

function seek(event) {
  if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  audio.currentTime = pct * audio.duration;
  updateUi();
}

export function initGlobalPlayer() {
  ensurePlayer();
}

function ensurePlayer() {
  if (playerEl) return playerEl;
  playerEl = el('div', { id: 'gm-mini-player', class: 'gm-mini-player', hidden: true }, [
    el('div', { class: 'gm-mini-lyric' }, [
      el('span', { class: 'gm-mini-lyric-track', 'data-role': 'lyric', text: 'AI 音乐' })
    ]),
    el('div', { class: 'gm-mini-shell' }, [
      el('div', { class: 'gm-mini-cover', 'data-role': 'cover' }),
      el('div', { class: 'gm-mini-info' }, [
        el('div', { class: 'gm-mini-title', 'data-role': 'title', text: '未命名' }),
        el('div', { class: 'gm-mini-time' }, [
          el('span', { 'data-role': 'current', text: '0:00' }),
          el('span', { text: ' / ' }),
          el('span', { 'data-role': 'total', text: '--:--' })
        ])
      ]),
      el('button', { type: 'button', class: 'gm-mini-play', 'data-role': 'play', text: '播放', onclick: toggleCurrent }),
      el('div', { class: 'gm-mini-progress', 'data-role': 'seek', onclick: seek }, [
        el('span', { class: 'gm-mini-progress-fill', 'data-role': 'fill' })
      ]),
      el('button', { type: 'button', class: 'gm-mini-close', text: '—', title: '收起播放器', onclick: hideGlobalPlayer })
    ])
  ]);
  document.body.appendChild(playerEl);
  return playerEl;
}

export function hideGlobalPlayer() {
  setHidden(true);
}

export function toggleCurrent() {
  if (!audio) return;
  if (audio.paused || audio.ended) {
    audio.play().catch(() => toast('播放失败', 'error'));
  } else {
    audio.pause();
  }
  updateUi();
}

export function toggleGlobalSong(song = {}) {
  const songId = cleanText(song.id || song.song_id || song.upstream_song_id);
  const currentId = cleanText(currentSong?.id || currentSong?.song_id || currentSong?.upstream_song_id);
  if (audio && songId && currentId && songId === currentId) {
    toggleCurrent();
    return;
  }
  const url = mediaUrl(song.playable_url || song.audio_url || song.mp3_url || song.url || song.play_url || '');
  if (!url) {
    toast('音频还没准备好', 'warn');
    return;
  }
  if (audio) {
    audio.pause();
    audio.src = '';
  }
  currentSong = { ...song, id: songId || cleanText(song.id) };
  lyricLines = parseLyrics(song.lyrics || song.lyric || '');
  lyricIndex = -1;
  const needsLyricsFetch = !lyricLines.length;
  if (needsLyricsFetch) {
    currentSong.lyrics = '正在加载歌词...';
    lyricLines = parseLyrics(currentSong.lyrics);
  }
  audio = new Audio(url);
  const activeAudio = audio;
  audio.preload = 'auto';
  audio.playsInline = true;
  audio.addEventListener('timeupdate', updateUi);
  audio.addEventListener('durationchange', updateUi);
  audio.addEventListener('play', updateUi);
  audio.addEventListener('pause', updateUi);
  audio.addEventListener('ended', updateUi);
  audio.addEventListener('error', () => {
    if (activeAudio !== audio) return;
    toast('音频加载失败', 'error');
  });
  setHidden(false);
  updateUi();
  updateLyric(true);
  if (needsLyricsFetch) loadSongLyrics(currentSong, cleanText(currentSong.id));
  audio.play().catch(() => {
    if (activeAudio !== audio) return;
    toast('播放失败', 'error');
    updateUi();
  });
}
