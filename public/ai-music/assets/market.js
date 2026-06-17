import { api, ApiError, getApiKey, refreshMarketOrder } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast, mediaUrl } from './ui.js?v=20260617-ai-music-payment-refresh';
import { openKeyModal, launchNexaPayment } from './auth.js?v=20260617-ai-music-payment-refresh';
import { toggleGlobalSong } from './player.js?v=20260617-ai-music-payment-refresh';

const PENDING_MARKET_ORDER_KEY = 'claw800:ai-music:pending-market-order';
let state = { page: 1, page_size: 20, q: '', loading: false };
let searchTimer = null;

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
      'aria-label': '播放 ' + title,
      onclick: () => toggleGlobalSong(song)
    }, [
      cover ? el('img', { src: cover, alt: title, loading: 'lazy', onerror: (event) => { event.currentTarget.remove(); } }) : null,
      el('span', { text: '▶' })
    ].filter(Boolean)),
    el('div', { class: 'gm-market-info' }, [
      el('div', { class: 'gm-market-title-row' }, [
        el('strong', { class: 'gm-market-title', text: title }),
        el('span', { class: 'gm-market-price', text: price })
      ]),
      el('div', { class: 'gm-market-meta', text: `作者：${author}` }),
      el('div', { class: 'gm-market-meta', text: `版权人：${owner}` })
    ]),
    el('button', {
      type: 'button',
      class: 'gm-market-buy',
      text: '购买',
      onclick: () => buyListing(listing, root)
    })
  ]);
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
