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

function absoluteAiMusicUrl(rawUrl) {
  const url = cleanText(rawUrl);
  if (!url) return '';
  if (url.startsWith('/api/ai-music/')) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `https://ai6666.com${url}`;
  return '';
}

function addUnique(list, value) {
  const url = cleanText(value);
  if (url && !list.includes(url)) list.push(url);
}

function buildAudioCandidates(song = {}) {
  const rawValues = [
    song.playable_url,
    song.audio_url,
    song.mp3_url,
    song.url,
    song.play_url
  ];
  const urls = [];
  rawValues.forEach((raw) => {
    const url = cleanText(raw);
    if (!url) return;
    addUnique(urls, mediaUrl(url));
    const absoluteUrl = absoluteAiMusicUrl(url);
    let hostname = '';
    try { hostname = absoluteUrl ? new URL(absoluteUrl).hostname : ''; } catch { hostname = ''; }
    if (absoluteUrl && /(^|\.)ai6666\.com$/i.test(hostname)) {
      addUnique(urls, `/api/ai-music/public/media?u=${encodeURIComponent(absoluteUrl)}`);
      addUnique(urls, `/api/ai-music/media?u=${encodeURIComponent(absoluteUrl)}`);
    }
    if (/^https?:\/\//i.test(url) && !/ai6666\.com/i.test(url)) addUnique(urls, url);
  });
  return urls;
}

function parseLyricTimestamp(token) {
  const match = String(token || '').match(/^(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?$/);
  if (!match) return null;
  const minutes = Number(match[1] || 0) || 0;
  const seconds = Number(match[2] || 0) || 0;
  const fraction = String(match[3] || '');
  const millis = fraction ? Number(fraction.padEnd(3, '0').slice(0, 3)) || 0 : 0;
  return minutes * 60 + seconds + millis / 1000;
}

function normalizeLyricsValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item;
      const text = cleanText(item?.text || item?.lyric || item?.line || item?.content || item?.words);
      if (!text) return '';
      const rawTime = item?.time ?? item?.start ?? item?.startTime ?? item?.timestamp;
      const numericTime = typeof rawTime === 'number' ? rawTime : Number(rawTime);
      if (Number.isFinite(numericTime)) {
        const seconds = numericTime > 1000 ? numericTime / 1000 : numericTime;
        const minutes = Math.floor(seconds / 60);
        const rest = (seconds - minutes * 60).toFixed(2).padStart(5, '0');
        return `[${minutes}:${rest}]${text}`;
      }
      return text;
    }).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    return normalizeLyricsValue(value.lyrics || value.lyric || value.text || value.lrc || value.lines || value.items || value.data);
  }
  return String(value || '').trim();
}

function parseLyrics(raw) {
  return normalizeLyricsValue(raw)
    .split(/\r?\n+/)
    .flatMap((line) => {
      const timestamps = Array.from(line.matchAll(/\[([0-9:.]+)\]/g))
        .map((match) => parseLyricTimestamp(match[1]))
        .filter((time) => time !== null);
      const text = line.replace(/\[[0-9:.]+\]/g, '').trim();
      if (!text) return [];
      if (!timestamps.length) return [{ time: null, text }];
      return timestamps.map((time) => ({ time, text }));
    })
    .slice(0, 80);
}

function hasTimedLyrics(lines) {
  return (lines || []).some((line) => line && line.time !== null);
}

function extractLyricsPayload(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.trim();
  const candidates = [
    payload.raw,
    payload.lyrics,
    payload.lyric,
    payload.text,
    payload.lrc,
    payload.lrcText,
    payload.lrc_text,
    payload.syncedLyrics,
    payload.synced_lyrics,
    payload.data?.raw,
    payload.data?.lyrics,
    payload.data?.lyric,
    payload.data?.text,
    payload.data?.lrc,
    payload.data?.lrcText,
    payload.data?.lrc_text,
    payload.data?.syncedLyrics,
    payload.data?.synced_lyrics,
    payload.song?.lyrics,
    payload.song?.lyric,
    payload.song?.lrc,
    payload.song?.lrcText,
    payload.song?.lrc_text,
    payload.song?.syncedLyrics,
    payload.song?.synced_lyrics
  ];
  return normalizeLyricsValue(candidates.find((value) => normalizeLyricsValue(value)));
}

async function loadSongLyrics(song, songId) {
  if (!songId) return;
  let text = '';
  try {
    const lrcPayload = await api.songLrc(songId);
    const lrcText = extractLyricsPayload(lrcPayload);
    if (hasTimedLyrics(parseLyrics(lrcText))) text = lrcText;
  } catch {
    // 上游同步歌词接口不可用时，再尝试普通歌词和歌曲详情。
  }
  try {
    if (!text) {
      const payload = await api.songLyrics(songId);
      text = extractLyricsPayload(payload);
    }
  } catch {
    // 老上游可能没有独立 lyrics 端点，落到歌曲详情兜底。
  }
  if (!text) {
    try {
      const detail = await api.songDetail(songId);
      text = extractLyricsPayload(detail);
    } catch {
      text = '';
    }
  }
  if (text && cleanText(currentSong?.id) === songId) {
    currentSong = { ...currentSong, lyrics: text };
    lyricLines = parseLyrics(text);
    lyricIndex = -1;
    updateLyric(true);
    return;
  }
  if (cleanText(currentSong?.id) === songId && cleanText(currentSong?.lyrics) === '正在加载歌词...') {
    currentSong = { ...currentSong, lyrics: '' };
    lyricLines = parseLyrics(cleanText(currentSong.title) || 'AI 音乐');
    lyricIndex = -1;
    updateLyric(true);
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
  const currentTime = (audio && audio.currentTime) || 0;
  const fallbackStep = audio && Number.isFinite(audio.duration) && audio.duration > 0
    ? Math.max(2, audio.duration / Math.max(1, lyricLines.length))
    : 6;
  let nextIndex = Math.max(0, Math.min(lyricLines.length - 1, Math.floor(currentTime / fallbackStep) % lyricLines.length));
  const timedLines = lyricLines.filter((line) => line.time !== null);
  if (timedLines.length) {
    nextIndex = 0;
    for (let i = 0; i < lyricLines.length; i += 1) {
      const line = lyricLines[i];
      if (line.time === null) continue;
      if (line.time <= currentTime) nextIndex = i;
      else break;
    }
  }
  if (!force && nextIndex === lyricIndex) return;
  lyricIndex = nextIndex;
  track.textContent = lyricLines[lyricIndex]?.text || cleanText(currentSong.title) || 'AI 音乐';
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
  if (!audio) return false;
  const willPlay = audio.paused || audio.ended;
  if (willPlay) {
    audio.play().catch(() => toast('播放失败', 'error'));
  } else {
    audio.pause();
  }
  updateUi();
  return willPlay;
}

export function toggleGlobalSong(song = {}) {
  const songId = cleanText(song.id || song.song_id || song.upstream_song_id);
  const currentId = cleanText(currentSong?.id || currentSong?.song_id || currentSong?.upstream_song_id);
  if (audio && songId && currentId && songId === currentId) {
    return toggleCurrent();
  }
  const candidates = buildAudioCandidates(song);
  if (!candidates.length) {
    toast('音频还没准备好', 'warn');
    return false;
  }
  if (audio) {
    audio.pause();
    audio.src = '';
  }
  currentSong = { ...song, id: songId || cleanText(song.id) };
  lyricLines = parseLyrics(song.lyrics || song.lyric || '');
  lyricIndex = -1;
  const needsLyricsFetch = !lyricLines.length;
  const needsSyncedLyricsFetch = !hasTimedLyrics(lyricLines);
  if (needsLyricsFetch) {
    currentSong.lyrics = '正在加载歌词...';
    lyricLines = parseLyrics(currentSong.lyrics);
  }
  audio = new Audio();
  const activeAudio = audio;
  audio.preload = 'auto';
  audio.playsInline = true;
  audio.addEventListener('timeupdate', updateUi);
  audio.addEventListener('durationchange', updateUi);
  audio.addEventListener('play', updateUi);
  audio.addEventListener('pause', updateUi);
  audio.addEventListener('ended', updateUi);
  setHidden(false);
  updateUi();
  updateLyric(true);
  if (needsSyncedLyricsFetch) loadSongLyrics(currentSong, cleanText(currentSong.id));
  playCandidate(candidates, 0, activeAudio);
  return true;
}

function playCandidate(candidates, index, expectedAudio) {
  if (expectedAudio !== audio) return;
  const url = candidates[index];
  if (!url) {
    toast('音频加载失败', 'error');
    updateUi();
    return;
  }

  let settled = false;
  const tryNext = () => {
    if (settled || expectedAudio !== audio) return;
    settled = true;
    playCandidate(candidates, index + 1, expectedAudio);
  };
  const markReady = () => { settled = true; };

  audio.src = url;
  audio.preload = 'auto';
  audio.playsInline = true;
  audio.addEventListener('canplay', markReady, { once: true });
  audio.addEventListener('playing', markReady, { once: true });
  audio.addEventListener('error', tryNext, { once: true });
  audio.play().catch(tryNext);
}
