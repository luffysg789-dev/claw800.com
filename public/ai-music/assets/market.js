import { api, ApiError, getApiKey, refreshMarketOrder } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast, mediaUrl } from './ui.js?v=20260617-ai-music-payment-refresh';
import { openKeyModal, launchNexaPayment } from './auth.js?v=20260617-ai-music-payment-refresh';
import { toggleGlobalSong } from './player.js?v=20260617-ai-music-payment-refresh';

const PENDING_MARKET_ORDER_KEY = 'claw800:ai-music:pending-market-order';
let state = { page: 1, page_size: 20, q: '', loading: false };
let searchTimer = null;
let marketStateBound = false;

export function renderMarket(root) {
  clear(root);
  state = { page: 1, page_size: 20, q: '', loading: false };
  root.appendChild(el('div', { class: 'gm-market' }, [
    el('div', { class: 'gm-head' }, [
      el('h2', { text: '音乐市场-版权自由交易' }),
      el('a', { class: 'hh-my-create-btn', href: '#generate', text: '写歌' })
    ]),
    searchBox(root),
    el('div', { id: 'gm-market-feed', class: 'gm-market-feed' }),
    el('div', { id: 'gm-market-pager', class: 'gm-square-pager' })
  ]));
  bindMarketPlayerState();
  refreshPendingMarketOrder({ silent: true }).catch(() => null).finally(() => load(root));
}

function searchBox(root) {
  const input = el('input', { class: 'gm-input', type: 'text', placeholder: '搜索市场歌曲...' });
  const go = () => {
    state.q = input.value.trim();
    state.page = 1;
    load(root);
  };
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(go, 320);
  });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') go(); });
  return el('div', { class: 'gm-square-search' }, [
    input,
    el('button', { type: 'button', class: 'gm-btn-ghost', text: '搜索', onclick: go })
  ]);
}

async function load(root) {
  if (state.loading) return;
  state.loading = true;
  const feed = root.querySelector('#gm-market-feed');
  const pager = root.querySelector('#gm-market-pager');
  clear(feed); clear(pager);
  feed.appendChild(el('div', { class: 'gm-square-empty', text: '加载中...' }));
  let data;
  try {
    data = await api.marketListings(state);
  } catch (error) {
    clear(feed);
    feed.appendChild(el('div', { class: 'gm-square-empty', text: error instanceof ApiError ? error.message : '加载失败' }));
    state.loading = false;
    return;
  }
  clear(feed);
  const listings = data.listings || [];
  if (!listings.length) {
    feed.appendChild(el('div', { class: 'gm-square-empty', text: state.q ? '没有找到匹配歌曲' : '市场还没有出售中的歌曲' }));
    state.loading = false;
    return;
  }
  listings.forEach((listing) => feed.appendChild(marketCard(listing, root)));
  renderPager(root, Number(data.total || listings.length) || listings.length);
  state.loading = false;
}

function marketCard(listing, root) {
  const song = listing.song || {};
  const title = song.title || '未命名';
  const cover = mediaUrl(song.image_url || song.cover_url || '');
  const author = String(song.author_nickname || song.authorNickname || '').trim() || '匿名';
  const owner = String(song.copyright_nickname || song.copyrightNickname || author).trim() || author;
  const price = `${String(listing.price || '0.00').replace(/\.00$/, '')} ${listing.currency || 'USDT'}`;
  return el('article', { class: 'gm-market-card' }, [
    el('button', {
      type: 'button',
      class: 'gm-market-cover',
      'data-song-id': String(song.id || song.song_id || song.upstream_song_id || ''),
      'aria-label': '播放 ' + title,
      onclick: () => playMarketSong(song)
    }, [
      cover ? el('img', { src: cover, alt: title, loading: 'lazy', onerror: (event) => { event.currentTarget.remove(); } }) : null,
      el('span', { class: 'gm-market-play', text: '▶' })
    ].filter(Boolean)),
    el('div', { class: 'gm-market-info' }, [
      el('div', { class: 'gm-market-title-row' }, [
        el('strong', { class: 'gm-market-title', text: title }),
        el('span', { class: 'gm-market-price', text: price })
      ]),
      el('div', { class: 'gm-market-meta', text: `作者：${author}` }),
      el('div', { class: 'gm-market-meta', text: `版权人：${owner}` })
    ]),
    el('div', { class: 'gm-market-actions' }, [
      el('button', {
        type: 'button',
        class: 'gm-market-buy',
        text: '购买',
        onclick: () => buyListing(listing, root)
      }),
      el('div', { class: 'gm-market-sub-actions' }, [
        el('button', { type: 'button', class: 'gm-btn-ghost sm gm-market-lyrics', text: '歌词', onclick: () => showMarketLyrics(song) }),
        el('button', { type: 'button', class: 'gm-btn-ghost sm gm-market-share', text: '分享', onclick: () => shareMarketSong(song) })
      ])
    ])
  ]);
}

function playMarketSong(song) {
  const started = toggleGlobalSong(song);
  if (started) setMarketPlaying(song.id || song.song_id || song.upstream_song_id, true);
}

function setMarketPlaying(songId, playing) {
  const id = String(songId || '');
  document.querySelectorAll('.gm-market-cover[data-song-id]').forEach((btn) => {
    const active = !!playing && String(btn.dataset.songId || '') === id;
    btn.classList.toggle('gm-market-playing', active);
    btn.setAttribute('aria-label', active ? '暂停' : '播放');
    const icon = btn.querySelector('.gm-market-play');
    if (icon) icon.textContent = active ? 'Ⅱ' : '▶';
  });
}

function bindMarketPlayerState() {
  if (marketStateBound) return;
  marketStateBound = true;
  window.addEventListener('gm-global-player-state', (event) => {
    setMarketPlaying(event.detail?.songId, !!event.detail?.playing);
  });
}

function cleanLyricsText(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  if (/^\s*[{[]/.test(value) || /^\s*</.test(value)) return '';
  if (/(function\s*\(|=>|const\s+|let\s+|var\s+|class=|style=|<\/?[a-z][\s>]|;\s*})/i.test(value)) return '';
  return /[\p{L}\p{N}\u4e00-\u9fff]/u.test(value) ? value : '';
}

function normalizeLyricsValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return cleanLyricsText(value);
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return cleanLyricsText(item);
      const text = cleanLyricsText(item?.text || item?.lyric || item?.line || item?.content || item?.words || item?.sentence);
      if (!text) return '';
      const rawTime = item?.time ?? item?.start ?? item?.startTime ?? item?.timestamp;
      const numericTime = typeof rawTime === 'number' ? rawTime : Number(rawTime);
      if (Number.isFinite(numericTime)) {
        const seconds = numericTime >= 1000 ? numericTime / 1000 : numericTime;
        const minutes = Math.floor(seconds / 60);
        const rest = (seconds - minutes * 60).toFixed(2).padStart(5, '0');
        return `[${minutes}:${rest}]${text}`;
      }
      return text;
    }).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    const candidates = [
      value.lyrics,
      value.lyric,
      value.lrc,
      value.lrcText,
      value.lrc_text,
      value.syncedLyrics,
      value.synced_lyrics,
      value.text,
      value.content,
      value.raw,
      value.lines,
      value.items,
      value.song,
      value.result,
      value.data
    ];
    for (const candidate of candidates) {
      const text = normalizeLyricsValue(candidate);
      if (text) return text;
    }
  }
  return '';
}

function extractLyricsPayload(payload) {
  return normalizeLyricsValue(payload);
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

async function showMarketLyrics(song) {
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

function shareMarketSong(song) {
  const title = song.title || 'AI 歌曲';
  const url = `${location.origin}/ai-music/song/${encodeURIComponent(String(song.id || ''))}`;
  const text = `我在 https://claw800.com/ai-music/ 发现了一首歌《${title}》, 你也来听听: ${url}`;
  navigator.clipboard?.writeText(text).then(() => toast('已复制', 'success')).catch(() => toast(text, 'info'));
}

async function buyListing(listing, root) {
  if (!getApiKey()) {
    openKeyModal({});
    return;
  }
  try {
    const payload = await api.createMarketOrder(listing.id || listing.listing_id);
    savePendingMarketOrder(payload.order?.orderNo || payload.payment?.orderNo);
    if (launchNexaPayment(payload)) return;
    toast(`订单已创建：${payload.order?.orderNo || ''}`, 'success');
    load(root);
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '创建购买订单失败', 'error');
  }
}

function savePendingMarketOrder(orderNo) {
  const normalized = String(orderNo || '').trim();
  if (!normalized) return;
  try {
    sessionStorage.setItem(PENDING_MARKET_ORDER_KEY, JSON.stringify({ orderNo: normalized, savedAt: Date.now() }));
  } catch {}
}

function getPendingMarketOrder() {
  try {
    const item = JSON.parse(sessionStorage.getItem(PENDING_MARKET_ORDER_KEY) || 'null');
    const orderNo = String(item?.orderNo || '').trim();
    return orderNo ? orderNo : '';
  } catch {
    return '';
  }
}

function clearPendingMarketOrder() {
  try { sessionStorage.removeItem(PENDING_MARKET_ORDER_KEY); } catch {}
}

export async function refreshPendingMarketOrder({ silent = false } = {}) {
  const orderNo = getPendingMarketOrder();
  if (!orderNo) return null;
  const payload = await refreshMarketOrder(orderNo);
  const status = String(payload.order?.status || '').toLowerCase();
  if (status === 'paid' || status === 'success') {
    clearPendingMarketOrder();
    if (!silent) toast('购买成功，歌曲已进入我的音乐', 'success');
  }
  return payload;
}

function renderPager(root, total) {
  const pager = root.querySelector('#gm-market-pager');
  const totalPages = Math.max(1, Math.ceil((Number(total || 0) || 0) / state.page_size));
  if (totalPages <= 1) return;
  pager.appendChild(el('button', {
    type: 'button',
    class: 'gm-btn-ghost sm',
    text: '上一页',
    disabled: state.page <= 1,
    onclick: () => { if (state.page > 1) { state.page -= 1; load(root); } }
  }));
  pager.appendChild(el('span', { class: 'gm-song-meta', text: `${state.page}/${totalPages}` }));
  pager.appendChild(el('button', {
    type: 'button',
    class: 'gm-btn-ghost sm',
    text: '下一页',
    disabled: state.page >= totalPages,
    onclick: () => { if (state.page < totalPages) { state.page += 1; load(root); } }
  }));
}
