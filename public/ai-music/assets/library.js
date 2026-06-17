// 「我的音乐」—— 卡片/操作条样式逐字抄自主站 /music/my/（见 assets/my-music.css，
// 复用 .hh-my-* / .hh-music-* / .hh-card-bar / .hh-cat-* 类）。这里只把 Django 模板换成
// JS 取数 + /ai6api 调接口；播放走本地单实例 Audio（gmw 无主站常驻迷你播放器）。
import { api, poll, ApiError, authedDownload } from './api.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast, fmtDuration, mediaUrl } from './ui.js?v=20260617-ai-music-payment-refresh';
import { toggleGlobalSong } from './player.js?v=20260617-ai-music-payment-refresh';

let state = { tab: 'mine', page: 1, page_size: 20, q: '' };
let globalBound = false;

// 全局单一音频：同时只播一首
let cur = { audio: null, player: null };
function stopCurrent() {
  if (cur.audio) cur.audio.pause();
  if (cur.player) cur.player.classList.remove('hh-music-playing');
  cur = { audio: null, player: null };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function getLibRoot() { return document.getElementById('screen-library'); }

// 下载分两种情况：
//  1) 接口下发的绝对签名直链(可跨域取、且带 response-content-disposition=attachment)
//     ——直接 window.open 即下载。
//  2) 本站直链(浏览器直开可能因来源限制失败)——经 /media 同源代理取回, 再以 blob 触发「另存为」。
async function proxyDownload(rawUrl, filename) {
  if (/^https?:\/\//.test(rawUrl)) {
    try {
      if (!new URL(rawUrl).hostname.endsWith('ai6666.com')) { window.open(rawUrl, '_blank'); return; }
    } catch (e) { /* 非法 URL, 落到代理 */ }
  }
  const resp = await fetch(mediaUrl(rawUrl));
  if (!resp.ok) throw new ApiError('下载失败 (' + resp.status + ')', resp.status);
  const blob = await resp.blob();
  const obj = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = obj; a.download = filename || 'download';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(obj), 20000);
}

export function renderLibrary(root) {
  clear(root);
  state = { tab: 'mine', page: 1, page_size: 20, q: '' };
  stopCurrent();
  bindGlobalOnce();

  const wrap = el('div', { class: 'hh-my-wrap' });

  // ——— 工具条：搜索置顶 + 一行(tab 左 / 写歌 右)。照搬主站 owner 视图——无「我的音乐」大标题 header ———
  const tabsBox = el('div', { class: 'hh-my-tabs' }, [tabBtn('mine', '歌曲'), tabBtn('favorites', '收藏')]);
  const inlineActions = el('div', { class: 'hh-my-inline-actions' }, [
    el('a', { class: 'hh-my-create-btn', href: '#generate', text: '写歌' }),
  ]);
  const toolbar = el('div', { class: 'hh-my-toolbar' }, [
    searchBox(),
    el('div', { class: 'hh-my-toolbar-row' }, [tabsBox, inlineActions]),
  ]);

  // 「正在创作」进度区(生成页提交后跳来这里轮询显示)，在歌曲列表上方
  const activeBox = el('div', { id: 'activeGenBox', style: 'display:none;flex-direction:column;gap:12px;margin-bottom:14px;' });
  const feed = el('div', { id: 'myMusicFeed', style: 'display:flex;flex-direction:column;gap:16px;' });
  const pager = el('div', { id: 'lib-pager', style: 'display:flex;align-items:center;justify-content:center;gap:12px;margin-top:18px;flex-wrap:wrap;' });

  wrap.appendChild(toolbar);
  wrap.appendChild(activeBox);
  wrap.appendChild(feed);
  wrap.appendChild(pager);
  root.appendChild(wrap);
  load(root);
  pollPendingGens(root);
}

function tabBtn(key, label) {
  return el('button', {
    type: 'button', 'data-tab': key, text: label,
    class: 'hh-my-tab' + (key === state.tab ? ' hh-my-tab-active' : ''),
    onclick: (e) => {
      if (state.tab === key) return;
      state.tab = key; state.page = 1;
      e.currentTarget.parentNode.querySelectorAll('.hh-my-tab').forEach((b) => b.classList.toggle('hh-my-tab-active', b.dataset.tab === key));
      load(getLibRoot());
    },
  });
}

function searchBox() {
  const box = el('div', { class: 'hh-my-search' });
  const input = el('input', { type: 'text', placeholder: '搜索歌名…', value: state.q });
  const go = () => { state.q = input.value.trim(); state.page = 1; load(getLibRoot()); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  box.appendChild(input);
  box.appendChild(el('button', { type: 'button', text: '搜索', onclick: go }));
  return box;
}

function emptyBox(msg) {
  return el('div', { class: 'hh-my-empty', text: msg, style: 'background:#fff;border:1px solid #f3f4f6;border-radius:16px;padding:48px 24px;text-align:center;color:#6b7280;font-weight:600;' });
}

async function load(root) {
  root = root || getLibRoot();
  const feed = root.querySelector('#myMusicFeed');
  const pager = root.querySelector('#lib-pager');
  clear(feed); clear(pager);
  feed.appendChild(el('div', { style: 'text-align:center;padding:40px;color:#9ca3af;font-size:14px;', text: '加载中…' }));
  let data;
  try { data = await api.mySongs(state); }
  catch (e) { clear(feed); feed.appendChild(emptyBox(e instanceof ApiError ? e.message : '加载失败')); return; }
  clear(feed);
  const songs = data.songs || [];
  if (!songs.length) {
    feed.appendChild(emptyBox(state.q
      ? `没有匹配 “${state.q}” 的歌曲`
      : (state.tab === 'favorites' ? '还没有收藏，在播放器上点收藏即可' : '还没有作品，去「写歌」创作第一首吧')));
    return;
  }
  songs.forEach((s) => feed.appendChild(playerCard(s)));

  const total = data.total || songs.length;
  const totalPages = Math.max(1, Math.ceil(total / state.page_size));
  if (totalPages > 1) {
    pager.appendChild(el('button', { type: 'button', class: 'hh-bar-btn', text: '‹ 上一页', disabled: state.page <= 1, onclick: () => { if (state.page > 1) { state.page--; load(getLibRoot()); window.scrollTo({ top: 0 }); } } }));
    pager.appendChild(el('span', { style: 'color:#64748b;font-size:13px;font-weight:700;', text: `第 ${state.page}/${totalPages} 页 · 共 ${total} 首` }));
    pager.appendChild(el('button', { type: 'button', class: 'hh-bar-btn', text: '下一页 ›', disabled: state.page >= totalPages, onclick: () => { if (state.page < totalPages) { state.page++; load(getLibRoot()); window.scrollTo({ top: 0 }); } } }));
  }

  // PC：把操作条挪进时长行 + 溢出按钮收进「⋯」（与主站一致）
  layoutBars(feed);
}

// ——— 单首歌卡片：照搬 _player.html(size=md) + _my_songs_cards.html 的结构 ———
function playerCard(s) {
  const title = s.title || '(未命名)';
  const cover = mediaUrl(s.image_url);
  const durTxt = s.duration ? `${Math.round(s.duration)}s` : '--:--';
  const card = el('div', { class: 'hh-my-song-card', style: 'position:relative;' + (s.is_hidden ? 'opacity:0.5;' : '') });
  card.innerHTML = `
    <div class="hh-my-song-owner-actions" style="position:absolute;top:8px;right:8px;display:flex;gap:6px;z-index:6;">
      <button type="button" class="hh-btn-fav hh-my-owner-fav${s.user_favorited ? ' hh-fav-active' : ''}" data-act="fav" title="收藏" aria-label="收藏">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </button>
    </div>
    <div class="hh-music-player hh-music-player-md" data-song-id="${esc(s.id)}">
      <div class="hh-music-player-inner">
        <div class="hh-music-cover${cover ? '' : ' hh-music-cover-fallback'}">
          ${cover ? `<img src="${esc(cover)}" alt="${esc(title)}" loading="lazy" onerror="this.parentElement.classList.add('hh-music-cover-fallback');this.remove();">` : ''}
          <button type="button" class="hh-music-play-btn" data-act="play" aria-label="播放">
            <svg class="hh-icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
            <svg class="hh-icon-pause" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <div class="hh-music-equalizer" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
        </div>
        <div class="hh-music-body">
          <div class="hh-music-head">
            <div class="hh-music-title-wrap">
              <span class="hh-music-title" title="${esc(title)}">${esc(title)}</span>
            </div>
          </div>
          <div class="hh-music-progress" data-act="seek">
            <div class="hh-music-progress-buffer" style="width:0%;position:absolute;top:0;left:0;height:100%;background:rgba(255,255,255,0.2);border-radius:inherit;"></div>
            <div class="hh-music-progress-fill"></div>
            <div class="hh-music-progress-knob"></div>
          </div>
          <div class="hh-music-time">
            <span class="hh-music-cur">0:00</span>
            <span class="hh-music-total">${esc(durTxt)}</span>
          </div>
        </div>
      </div>
    </div>`;
  card.appendChild(actionBar(s));
  wireCard(card, s);
  return card;
}

function wireCard(card, s) {
  card.querySelector('[data-act="play"]').addEventListener('click', (e) => { e.stopPropagation(); togglePlay(s, card); });
  card.querySelector('.hh-music-progress').addEventListener('click', (e) => seek(e, card));
  const favBtn = card.querySelector('.hh-my-owner-fav');
  favBtn.addEventListener('click', (e) => { e.stopPropagation(); doFavorite(s, favBtn); });
  card.querySelector('.hh-card-bar').addEventListener('click', (e) => onBarClick(e, s));
}

function togglePlay(s, card) {
  toggleGlobalSong(s);
  card.querySelector('.hh-music-player')?.classList.add('hh-music-playing');
}
function seek(e, card) {
  const player = card.querySelector('.hh-music-player');
  if (cur.player !== player || !cur.audio || !cur.audio.duration) return;
  const r = e.currentTarget.getBoundingClientRect();
  cur.audio.currentTime = ((e.clientX - r.left) / r.width) * cur.audio.duration;
}

// ——— 操作条：逐字照搬主站 _my_songs_cards.html 的 .hh-card-bar ———
//   下载▾(MP3 / WAV[4 态] / 封面 / 复制歌词 / 歌词下载 / 动态歌词) ·
//   授权 · 分享 · 重做 · 分轨[/升级分轨] · 分离伴奏 · ⋯(改名 / 删除)
//   注：主站此操作条无「公开到广场」——那是 C 端广场语义，不放在我的音乐（规矩#2）。
function actionBar(s) {
  const bar = el('div', { class: 'hh-card-bar' });
  const hasLyrics = !!(s.lyrics && String(s.lyrics).trim());
  const hasCover = !!s.image_url;
  const stemmed = !!(s.stem_basic || s.stem_pro);
  bar.innerHTML = `
    <div class="hh-cat">
      <button type="button" class="hh-bar-btn hh-bar-btn-primary" data-cat-toggle aria-expanded="false">下载<svg class="hh-cat-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg></button>
      <div class="hh-cat-menu" hidden><div class="hh-cat-list">
        <button type="button" class="hh-cat-item" data-dl="mp3">MP3</button>
        ${wavItemHtml(s)}
        ${hasCover ? '<button type="button" class="hh-cat-item" data-dl="cover">封面</button>' : ''}
        ${hasLyrics ? `<button type="button" class="hh-cat-item" data-lyric="copy">复制歌词</button>
        <button type="button" class="hh-cat-item" data-lyric="txt">歌词下载</button>
        <button type="button" class="hh-cat-item" data-lyric="lrc">动态歌词</button>` : ''}
      </div></div>
    </div>
    <button type="button" data-bar-move data-bar-order="1" class="hh-bar-btn" data-act="copyright">授权</button>
    <button type="button" data-bar-move data-bar-order="2" class="hh-bar-btn" data-act="lyrics">歌词</button>
    <button type="button" data-bar-move data-bar-order="3" class="hh-bar-btn" data-act="share">分享</button>
    <button type="button" data-bar-move data-bar-order="4" class="hh-bar-btn" data-act="remake">重做</button>
    <button type="button" data-bar-move data-bar-order="5" class="hh-bar-btn" data-act="stem-split">${stemmed ? '升级分轨' : '分轨'}</button>
    <button type="button" data-bar-move data-bar-order="6" class="hh-bar-btn" data-act="stem-inst">分离伴奏</button>
    <div class="hh-cat hh-cat-more-wrap">
      <button type="button" class="hh-bar-btn hh-bar-btn-more" data-cat-toggle aria-label="更多" aria-expanded="false">⋯</button>
      <div class="hh-cat-menu" hidden><div class="hh-cat-list">
        <button type="button" class="hh-cat-item" data-act="rename">改名</button>
        <button type="button" class="hh-cat-item hh-cat-item-danger" data-act="delete">删除</button>
      </div></div>
    </div>`;
  return bar;
}

// WAV 下拉项：已生成→可下载；生成中→灰；未生成→生成入口（对齐主站 4 态分支）
function wavItemHtml(s) {
  if (s.wav_ready && s.wav_url) return '<button type="button" class="hh-cat-item" data-wav="download">WAV 无损</button>';
  if (s.wav_status === 'generating') return '<span class="hh-cat-item hh-cat-item-muted">WAV 生成中…</span>';
  return '<button type="button" class="hh-cat-item" data-wav="generate">生成 WAV 无损</button>';
}

function onBarClick(e, s) {
  const toggle = e.target.closest('[data-cat-toggle]');
  if (toggle) { e.stopPropagation(); catToggle(toggle); return; }
  const item = e.target.closest('[data-act],[data-dl],[data-wav],[data-lyric]');
  if (!item) return;
  e.stopPropagation();
  closeAllCat();
  const dl = item.getAttribute('data-dl');
  if (dl) { ({ mp3: dlMp3, cover: dlCover }[dl] || (() => {}))(s); return; }
  const wav = item.getAttribute('data-wav');
  if (wav === 'download') { wavDownload(s); return; }
  if (wav === 'generate') { wavGenerate(s); return; }
  const ly = item.getAttribute('data-lyric');
  if (ly) { ({ copy: copyLyrics, txt: downloadLyricsTxt, lrc: dlLrc }[ly] || (() => {}))(s); return; }
  switch (item.getAttribute('data-act')) {
    case 'copyright': doCopyright(s); break;
    case 'lyrics': doLyrics(s); break;
    case 'share': doShare(s); break;
    case 'remake': doRemake(s, item); break;
    case 'stem-split': goStemLab(s); break;
    case 'stem-inst': goStemLab(s, 'inst'); break;
    case 'rename': doRename(s); break;
    case 'delete': doDelete(s, item); break;
  }
}

// ——— .hh-cat 二级菜单：点击切换 / 点外部关闭 / 下方空间不够则向上展开（照搬主站 hhCatToggle）———
function closeAllCat(except) {
  document.querySelectorAll('.hh-cat-menu:not([hidden])').forEach((m) => {
    if (m === except) return;
    m.hidden = true;
    const b = m.closest('.hh-cat') && m.closest('.hh-cat').querySelector('[data-cat-toggle]');
    if (b) b.setAttribute('aria-expanded', 'false');
    const cd = m.closest('.hh-my-song-card'); if (cd) cd.classList.remove('hh-card-menu-open');
  });
}
function catToggle(btn) {
  const cat = btn.closest('.hh-cat'); if (!cat) return;
  const menu = cat.querySelector('.hh-cat-menu'); if (!menu) return;
  const willOpen = menu.hidden;
  closeAllCat(menu);
  menu.hidden = !willOpen;
  btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  const card = cat.closest('.hh-my-song-card');
  if (card) card.classList.toggle('hh-card-menu-open', willOpen);
  if (willOpen) {
    menu.classList.remove('hh-cat-menu-up');
    const r = menu.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) menu.classList.add('hh-cat-menu-up');
  }
}

// ——— 操作条排版：PC 接进「时长」那一行；放不下就从右往左把按钮收进「⋯」（照搬主站 layoutBar）———
function layoutBar(bar) {
  const more = bar.querySelector('.hh-cat-more-wrap'); if (!more) return;
  const list = more.querySelector('.hh-cat-list'); if (!list) return;
  const card = bar.closest('.hh-my-song-card');
  const isPC = window.matchMedia('(min-width:761px)').matches;
  // 1) 先把之前收进 ⋯ 的按钮按原顺序放回 bar
  Array.prototype.slice.call(list.querySelectorAll('[data-bar-move]'))
    .sort((a, b) => (+a.dataset.barOrder || 0) - (+b.dataset.barOrder || 0))
    .forEach((btn) => { btn.classList.remove('hh-cat-item'); btn.classList.add('hh-bar-btn'); bar.insertBefore(btn, more); });
  // 2) 放置 bar：PC 接在时长行后面；H5 放回卡片底部
  const timeRow = card && card.querySelector('.hh-music-time');
  if (isPC && timeRow) { if (bar.parentNode !== timeRow) timeRow.appendChild(bar); }
  else if (card && bar.parentNode !== card) { card.appendChild(bar); }
  // 3) 溢出收纳
  const rowEl = (isPC && timeRow && bar.parentNode === timeRow) ? timeRow : bar;
  let guard = 0;
  while (rowEl.scrollWidth > rowEl.clientWidth + 1 && guard < 20) {
    guard++;
    const movs = bar.querySelectorAll(':scope > [data-bar-move]');
    if (!movs.length) break;
    const last = movs[movs.length - 1];
    last.classList.remove('hh-bar-btn'); last.classList.add('hh-cat-item');
    list.insertBefore(last, list.firstChild);
  }
}
function layoutBars(scope) {
  (scope || document).querySelectorAll('.hh-card-bar').forEach(layoutBar);
}

function bindGlobalOnce() {
  if (globalBound) return;
  globalBound = true;
  document.addEventListener('click', (e) => { if (!(e.target.closest && e.target.closest('.hh-cat'))) closeAllCat(); });
  window.addEventListener('gm-global-player-state', (event) => {
    const songId = String(event.detail?.songId || '');
    const playing = !!event.detail?.playing;
    document.querySelectorAll('.hh-music-player[data-song-id]').forEach((player) => {
      player.classList.toggle('hh-music-playing', playing && String(player.dataset.songId || '') === songId);
    });
  });
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { const f = document.getElementById('myMusicFeed'); if (f) layoutBars(f); }, 150); });
}

function refresh() { const root = getLibRoot(); if (root) load(root); }

// ============ 「正在创作」进度（生成页提交后跳来这里轮询）============
let pendingTimer = null;
const pendingStatus = {};   // gen id -> { percent, label, status }
function readPendingGens() { try { return JSON.parse(sessionStorage.getItem('gm_pending_gens') || '[]'); } catch { return []; } }
function writePendingGens(arr) { try { sessionStorage.setItem('gm_pending_gens', JSON.stringify(arr)); } catch (e) {} }
function curActiveBox() { const r = getLibRoot(); return r ? r.querySelector('#activeGenBox') : null; }

// 占位卡组：照搬主站 my_songs.html 的 .hh-my-active-group + 2 个 .hh-active-slot 占位歌卡
// (尺寸/布局与成品一致：封面转圈 + 进度条 + 骨架操作条)；某代生成好后原地换成真 playerCard。
function activeGroupHtml(g) {
  const title = esc(g.title || '生成中的歌曲');
  const slot = (n) => `
    <div class="hh-active-slot" data-slot="${n - 1}">
      <div class="hh-my-song-card" data-role="ph" style="position:relative;">
        <div class="hh-music-player hh-music-player-md">
          <div class="hh-music-player-inner">
            <div class="hh-music-cover hh-active-cover"><span class="hh-active-spinner" aria-hidden="true"></span></div>
            <div class="hh-music-body">
              <div class="hh-music-head"><div class="hh-music-title-wrap">
                <span class="hh-music-title">${title}</span>
                <span class="hh-music-sub">第 ${n} 首 · 生成中 <span data-role="percent">0%</span></span>
              </div></div>
              <div class="hh-music-progress" aria-hidden="true"><div class="hh-music-progress-fill" data-role="fill" style="width:5%"></div></div>
              <div class="hh-music-time"><span>AI 创作中…</span><span data-role="percent">0%</span></div>
            </div>
          </div>
        </div>
        <div class="hh-skel-row" aria-hidden="true">
          <span class="hh-skel-pill" style="width:62px;"></span><span class="hh-skel-pill" style="width:56px;"></span><span class="hh-skel-pill" style="width:44px;"></span>
          <span class="hh-skel-pill" style="width:72px;"></span><span class="hh-skel-pill" style="width:58px;"></span><span class="hh-skel-pill" style="width:50px;"></span>
        </div>
      </div>
    </div>`;
  return `<div class="hh-my-active-group" data-generation-id="${esc(g.id)}" style="display:flex;flex-direction:column;gap:16px;">${slot(1)}${slot(2)}</div>`;
}

// 增量渲染：已有 group 只更新进度(不重建, 免抖动/转圈重置)；缺的补建, 已完成移除的删掉。
function renderActiveGenCards(box) {
  if (!box) return;
  const arr = readPendingGens();
  box.style.display = arr.length ? 'flex' : 'none';
  const seen = {};
  arr.forEach((g) => {
    seen[g.id] = 1;
    let group = box.querySelector('.hh-my-active-group[data-generation-id="' + g.id + '"]');
    if (!group) {
      const tmp = document.createElement('div');
      tmp.innerHTML = activeGroupHtml(g);
      group = tmp.firstElementChild;
      box.appendChild(group);
    }
    const st = pendingStatus[g.id] || { percent: 0 };
    const pct = Math.max(5, st.percent || 0);
    group.querySelectorAll('[data-role="fill"]').forEach((f) => { f.style.width = pct + '%'; });
    group.querySelectorAll('[data-role="percent"]').forEach((p) => { p.textContent = (st.percent || 0) + '%'; });
  });
  Array.prototype.slice.call(box.querySelectorAll('.hh-my-active-group')).forEach((grp) => {
    if (!seen[grp.getAttribute('data-generation-id')]) grp.remove();
  });
}

// 某代生成完成：占位组原地换成真歌卡(插到 feed 顶部, 最新在前), 不整页刷新、不打断播放。
// generation_status 完成时直接返回 songs(id/title/duration/playable_url/image_url/lyrics)→ 够建卡。
function morphGroupToSongs(genId, songs) {
  const box = curActiveBox();
  const group = box && box.querySelector('.hh-my-active-group[data-generation-id="' + genId + '"]');
  const feed = (getLibRoot() || document).querySelector('#myMusicFeed');
  if (!feed || !(songs && songs.length)) { if (group) group.remove(); refresh(); return; }  // 拿不到歌→兜底刷新
  const frag = document.createDocumentFragment();
  songs.forEach((s) => frag.appendChild(playerCard(s)));
  feed.insertBefore(frag, feed.firstChild);
  if (group) group.remove();
  layoutBars(feed);
}

function pollPendingGens(root) {
  if (pendingTimer) { clearInterval(pendingTimer); pendingTimer = null; }
  renderActiveGenCards(root.querySelector('#activeGenBox'));
  if (!readPendingGens().length) return;
  const tick = async () => {
    if (!readPendingGens().length) { clearInterval(pendingTimer); pendingTimer = null; renderActiveGenCards(curActiveBox()); return; }
    for (const g of readPendingGens()) {
      try {
        const r = await api.generationStatus(g.id);
        pendingStatus[g.id] = { percent: r.percent || 0, label: r.label || r.status || '生成中…', status: r.status };
        if (['success', 'failed', 'rejected'].includes(r.status)) {
          writePendingGens(readPendingGens().filter((x) => x.id !== g.id));
          if (r.status === 'success') morphGroupToSongs(g.id, r.songs || []);   // 占位原地换真卡, 不整页刷新/不打断播放
          else toast(r.status === 'rejected' ? '有一首未通过审核' : '有一首生成失败', 'warn');
        }
      } catch (e) { /* 网络抖动: 下个 tick 再试 */ }
    }
    renderActiveGenCards(curActiveBox());
    if (!readPendingGens().length) { clearInterval(pendingTimer); pendingTimer = null; }
  };
  pendingTimer = setInterval(tick, 3500);
  tick();
}

// ============ 操作实现（弹窗/点击交互逐字照搬主站 /music/my/） ============

// 通用模态：gm-modal 遮罩(styles.css) + 主站白卡(内联 style 逐字照搬)。点遮罩/✕ 关闭。
// onMount(card, close) 里挂事件；带 [data-close] 的元素自动绑关闭。
function openModal(cardHtml, onMount, maxw) {
  const overlay = el('div', { class: 'gm-modal' });
  const card = el('div', {
    style: `position:relative;width:100%;max-width:${maxw || '24rem'};background:#fff;border-radius:1rem;`
      + 'padding:1.5rem;box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1);',
  });
  card.innerHTML = cardHtml;
  card.addEventListener('click', (e) => e.stopPropagation());
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  card.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  if (onMount) onMount(card, close);
  return close;
}

// 自定义确认框（照搬主站 showConfirmModal：取消 / 继续）
function confirmModal(msg, onOk) {
  openModal(
    `<p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 18px;">${esc(msg)}</p>`
    + '<div style="display:flex;gap:10px;">'
    + '<button data-close style="flex:1;padding:10px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">取消</button>'
    + '<button data-ok style="flex:1;padding:10px;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;">继续</button>'
    + '</div>',
    (card, close) => { card.querySelector('[data-ok]').onclick = () => { close(); onOk(); }; });
}

const MODAL_INPUT = 'width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;';
const MODAL_X = 'position:absolute;top:.75rem;right:1rem;color:#9ca3af;font-size:1.5rem;line-height:1;background:none;border:none;cursor:pointer;';

async function dlMp3(s) {
  try {
    const r = await api.downloadMp3(s.id);
    if (r.ready && r.url) { toast('开始下载 MP3…', 'info'); await proxyDownload(r.url, r.filename || `${s.title || 'song'}.mp3`); toast('已开始下载 MP3', 'success'); }
    else toast(r.error || 'MP3 尚未就绪', 'warn');
  } catch (e) { toast(e instanceof ApiError ? e.message : (e.message || '下载失败'), 'error'); }
}
// WAV 已生成：弹「过期提示」确认窗 → 确认下载（照搬主站 wavDlModal）
function wavDownload(s) {
  openModal(
    `<button data-close style="${MODAL_X}">&times;</button>`
    + '<div style="text-align:center;">'
    + '<div style="font-size:44px;margin-bottom:8px;">💎</div>'
    + '<h3 style="font-size:18px;font-weight:800;color:#111;margin:0 0 12px;">WAV 高清无损下载</h3>'
    + '<p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 18px;">普通用户 WAV 保留 <b style="color:#ef4444;">15 天</b><br><span style="font-size:12px;color:#9ca3af;">升级 SVIP 可永久保留所有 WAV</span></p>'
    + '<button data-ok style="width:100%;padding:11px;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;">确认下载</button>'
    + '</div>',
    (card, close) => {
      card.querySelector('[data-ok]').onclick = async () => {
        close(); toast('开始下载 WAV…', 'info');
        try { await proxyDownload(s.wav_url, `${s.title || 'song'}.wav`); toast('已开始下载 WAV', 'success'); }
        catch (e) { toast(e instanceof ApiError ? e.message : 'WAV 下载失败', 'error'); }
      };
    });
}

// WAV 未生成：有权益→确认生成→轮询→下载；无权益→弹付费门槛窗（照搬主站 hhWavButtonClick）
function wavGenerate(s) {
  if (!s.has_wav_access) { wavUpgradeModal(); return; }
  confirmModal('生成高清无损 WAV 格式，约 30-90 秒完成后可下载（15 天有效）。继续？', async () => {
    toast('已提交，预计 30-90 秒完成', 'info');
    try {
      await api.exportWav(s.id);
      const r = await poll(() => api.wavStatus(s.id), { interval: 3500, done: (x) => x.wav_ready || x.wav_status === 'failed' });
      if (r.wav_ready && r.wav_url) {
        s.wav_ready = true; s.wav_url = r.wav_url; s.wav_status = 'success';
        toast('WAV 已就绪，开始下载', 'success');
        await proxyDownload(r.wav_url, `${s.title || 'song'}.wav`);
      } else { toast(r.wav_error || 'WAV 生成失败', 'error'); }
    } catch (e) { toast(e instanceof ApiError ? e.message : 'WAV 失败', 'error'); }
  });
}

// WAV 付费门槛窗
function wavUpgradeModal() {
  openModal(
    `<button data-close style="${MODAL_X}">&times;</button>`
    + '<div style="text-align:center;">'
    + '<div style="font-size:44px;margin-bottom:6px;">🎚</div>'
    + '<h3 style="font-size:18px;font-weight:800;color:#111;margin:0 0 10px;">WAV 高清无损下载</h3>'
    + '<p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 18px;">当前账号权益不足。可先购买 AI 音乐生成次数，再重试导出。</p>'
    + '<div style="display:flex;gap:10px;">'
    + '<button data-close style="flex:1;padding:11px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">稍后</button>'
    + '<button data-buy style="flex:2;padding:11px;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;">购买次数</button>'
    + '</div></div>',
    (card, close) => { card.querySelector('[data-buy]').onclick = () => { close(); toast('请点击顶部购买次数选择套餐', 'info'); }; });
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

async function fetchLyrics(s) {
  if (s.lyrics && String(s.lyrics).trim()) return String(s.lyrics).trim();
  try {
    const r = await api.songLyrics(s.id);
    const text = extractLyricsPayload(r);
    if (text) return text;
  } catch (e) {
    // 老上游可能没有独立 lyrics 端点，落到歌曲详情兜底。
  }
  const detail = await api.songDetail(s.id);
  return extractLyricsPayload(detail);
}

async function doLyrics(s) {
  const close = openModal(
    `<button data-close style="${MODAL_X}">&times;</button>`
    + '<h3 style="font-size:18px;font-weight:900;color:#111827;margin:0 0 10px;text-align:center;">歌词</h3>'
    + `<div style="font-size:13px;font-weight:800;color:#be123c;text-align:center;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.title || '未命名')}</div>`
    + '<pre data-role="lyrics-body" style="min-height:180px;max-height:52vh;overflow:auto;white-space:pre-wrap;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:14px;font-size:13px;line-height:1.8;margin:0 0 14px;">加载中...</pre>'
    + '<div style="display:flex;gap:10px;">'
    + '<button data-copy style="flex:1;padding:10px;background:#fff;color:#be123c;border:1px solid #fecdd3;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;">复制歌词</button>'
    + '<button data-close style="flex:1;padding:10px;background:linear-gradient(135deg,#f43f5e,#ec4899,#f97316);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:900;cursor:pointer;">关闭</button>'
    + '</div>',
    async (card) => {
      const body = card.querySelector('[data-role="lyrics-body"]');
      const copyBtn = card.querySelector('[data-copy]');
      let lyrics = '';
      copyBtn.disabled = true;
      try {
        lyrics = await fetchLyrics(s);
        body.textContent = lyrics || '暂无歌词';
        s.lyrics = lyrics || s.lyrics;
      } catch (e) {
        body.textContent = e instanceof ApiError ? e.message : '歌词加载失败';
      } finally {
        copyBtn.disabled = !lyrics;
      }
      copyBtn.onclick = () => {
        if (!lyrics) return;
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(lyrics).then(() => toast('歌词已复制', 'success')).catch(() => fallbackCopy(lyrics, () => toast('歌词已复制', 'success')));
        else fallbackCopy(lyrics, () => toast('歌词已复制', 'success'));
      };
    },
    '32rem');
  return close;
}

// 复制歌词 / 歌词下载(.txt)（照搬主站 copyLyrics / downloadLyrics，纯前端用 s.lyrics）
function copyLyrics(s) {
  const text = (s.lyrics || '').trim();
  if (!text) { toast('暂无歌词', 'warn'); return; }
  const done = () => toast('歌词已复制', 'success');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta); done();
  } catch (e) { toast('复制失败', 'error'); }
}
function downloadLyricsTxt(s) {
  const text = (s.lyrics || '').trim();
  if (!text) { toast('暂无歌词', 'warn'); return; }
  const blob = new Blob([text.replace(/\r?\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' });
  const obj = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = obj; a.download = (s.title || '歌词') + '.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(obj), 10000);
}
async function dlCover(s) {
  try {
    const r = await api.downloadCover(s.id);
    if (r.ready && r.url) { toast('开始下载封面…', 'info'); await proxyDownload(r.url, r.filename || `${s.title || 'cover'}.jpg`); toast('已开始下载封面', 'success'); }
    else toast(r.error || '封面不可用', 'warn');
  } catch (e) { toast(e instanceof ApiError ? e.message : (e.message || '下载失败'), 'error'); }
}
async function dlLrc(s) {
  try { await authedDownload(`/ai6api/music/song/${s.id}/download-lrc`, `${s.title || 'lyrics'}.lrc`); toast('开始下载歌词', 'success'); }
  catch (e) { toast(e instanceof ApiError ? e.message : '歌词下载失败', 'error'); }
}
// 授权：三字段弹窗(歌名/姓名*/公司) → 生成 PDF（照搬主站 crModal / doCopyright）
function doCopyright(s) {
  openModal(
    `<button data-close style="${MODAL_X}">&times;</button>`
    + '<h3 style="font-size:18px;font-weight:800;color:#111;margin:0 0 4px;text-align:center;">📜 商业授权下载</h3>'
    + '<p style="font-size:12px;color:#9ca3af;text-align:center;margin-bottom:16px;">填写信息后生成 PDF 商业授权文件</p>'
    + '<div style="margin-bottom:12px;"><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px;">歌曲名称</label>'
    + `<input id="cr-title" type="text" placeholder="请输入歌曲名称" style="${MODAL_INPUT}"></div>`
    + '<div style="margin-bottom:12px;"><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px;">姓名 <span style="color:#ef4444;">*</span></label>'
    + `<input id="cr-name" type="text" placeholder="请输入真实姓名" style="${MODAL_INPUT}"></div>`
    + '<div style="margin-bottom:16px;"><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px;">公司 <span style="color:#9ca3af;font-weight:400;">（选填）</span></label>'
    + `<input id="cr-company" type="text" placeholder="如适用" style="${MODAL_INPUT}"></div>`
    + '<button id="cr-submit" style="width:100%;padding:12px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;">下载 PDF 商业授权</button>',
    (card, close) => {
      card.querySelector('#cr-title').value = s.title || '';
      const submit = card.querySelector('#cr-submit');
      submit.onclick = async () => {
        const name = card.querySelector('#cr-name').value.trim();
        if (!name) { toast('请填写姓名', 'warn'); return; }
        const company = card.querySelector('#cr-company').value.trim();
        const song_title = card.querySelector('#cr-title').value.trim();
        submit.disabled = true; submit.textContent = '生成中...';
        try {
          const r = await api.copyright(s.id, { name, company, song_title });
          if (r.ready && r.url) { window.open(r.url, '_blank'); toast('授权 PDF 已生成', 'success'); close(); }
          else { toast(r.error || '生成失败', 'warn'); submit.disabled = false; submit.textContent = '下载 PDF 商业授权'; }
        } catch (e) { toast(e instanceof ApiError ? e.message : '生成失败', 'error'); submit.disabled = false; submit.textContent = '下载 PDF 商业授权'; }
      };
      setTimeout(() => card.querySelector('#cr-name').focus(), 50);
    });
}
// 分享：复制一条带播放链接的邀请文案到剪贴板 + toast（照搬主站 shareMySong，不调后端）
function doShare(s) {
  const title = s.title || 'AI 歌曲';
  const url = `${location.origin}/ai-music/song/${encodeURIComponent(String(s.id || ''))}`;
  const text = '我在 claw800.com 用 AI 1 分钟做了首歌《' + title + '》, 你也来做一首: ' + url;
  const done = () => toast('已复制', 'success');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => shareFallback(text));
    return;
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); document.body.removeChild(ta);
    if (ok) { done(); return; }
  } catch (e) { /* 落到 fallback */ }
  shareFallback(text);
}
// 剪贴板挂掉时的保底（照搬主站 hhShareFallbackPrompt）
function shareFallback(text) {
  const overlay = el('div', { class: 'gm-modal' });
  overlay.innerHTML = '<div style="background:#fff;border-radius:14px;padding:18px;max-width:420px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,0.2);">'
    + '<p style="font-size:13px;color:#666;margin:0 0 8px;">长按下面的文字选中, 然后点“全选 → 复制”</p>'
    + '<textarea readonly style="width:100%;min-height:88px;border:1px solid #ddd;border-radius:8px;padding:10px;font-size:13px;line-height:1.5;resize:none;" onclick="this.select()"></textarea>'
    + '<div style="text-align:right;margin-top:10px;"><button data-close style="padding:7px 16px;background:linear-gradient(135deg,#f43f5e,#ec4899);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">关闭</button></div>'
    + '</div>';
  overlay.querySelector('textarea').value = text;
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.hasAttribute('data-close')) overlay.remove(); });
  document.body.appendChild(overlay);
}
async function doRemake(s, btn) {
  btn.disabled = true;
  try {
    const r = await api.remakePreset(s.id);
    if (!r.ok || !r.preset) { toast('这首歌不支持做同款', 'warn'); return; }
    sessionStorage.setItem('gm_remake', JSON.stringify(r.preset));
    toast('已带入创作参数，去生成', 'success');
    location.hash = 'generate';
  } catch (e) { toast(e instanceof ApiError ? e.message : '做同款失败', 'error'); }
  finally { btn.disabled = false; }
}
// 改名：自定义弹窗输入（照搬主站 renameModal / doRename）
function doRename(s) {
  openModal(
    `<button data-close style="${MODAL_X}">&times;</button>`
    + '<h3 style="font-size:18px;font-weight:800;color:#111;margin:0 0 14px;text-align:center;">✏️ 修改歌曲名称</h3>'
    + '<input id="rn-input" type="text" placeholder="输入新的歌曲名称" maxlength="200" style="width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;margin-bottom:14px;">'
    + '<button id="rn-submit" style="width:100%;padding:11px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;">保存</button>',
    (card, close) => {
      const input = card.querySelector('#rn-input');
      input.value = s.title || '';
      const submit = card.querySelector('#rn-submit');
      const go = async () => {
        const t = input.value.trim();
        if (!t) return;
        submit.disabled = true; submit.textContent = '保存中...';
        try { const r = await api.rename(s.id, t); s.title = r.title || t; toast('已改名', 'success'); close(); refresh(); }
        catch (e) { toast(e instanceof ApiError ? e.message : '改名失败', 'error'); submit.disabled = false; submit.textContent = '保存'; }
      };
      submit.onclick = go;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      setTimeout(() => { input.focus(); input.select(); }, 50);
    });
}
async function doFavorite(s, btn) {
  try {
    const r = await api.favorite(s.id);
    s.user_favorited = r.user_favorited !== undefined ? r.user_favorited : !s.user_favorited;
    if (btn) btn.classList.toggle('hh-fav-active', !!s.user_favorited);
    toast(s.user_favorited ? '已收藏' : '已取消收藏', 'success');
    if (state.tab === 'favorites' && !s.user_favorited) refresh();
  } catch (e) { toast(e instanceof ApiError ? e.message : '收藏失败', 'error'); }
}
// 删除：原生 confirm（主站本就用原生）+ 单卡片淡出收高动画（照搬主站 deleteSong）
function doDelete(s, item) {
  if (!confirm('确认删除这首歌？此操作不可撤回，本地 MP3、封面和云端 WAV 文件都会被清除。')) return;
  const card = item && item.closest('.hh-my-song-card');
  api.remove(s.id).then(() => {
    if (!card) { refresh(); return; }
    card.style.transition = 'opacity 0.3s, max-height 0.3s';
    card.style.opacity = '0'; card.style.overflow = 'hidden';
    setTimeout(() => { card.style.maxHeight = '0'; card.style.padding = '0'; card.style.margin = '0'; }, 300);
    setTimeout(() => card.remove(), 600);
  }).catch((e) => toast(e instanceof ApiError ? e.message : '删除失败', 'error'));
}

// 分轨 / 分离伴奏：跳「分轨」工作台并预选歌曲（照搬主站 hhMusicStem → /stem/?song=..&mode=..）
function goStemLab(s, mode) {
  sessionStorage.setItem('gm_stem_preselect', JSON.stringify({ song_id: s.id, mode: mode || '' }));
  location.hash = 'stemlab';
}
