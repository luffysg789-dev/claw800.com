// 「分轨」GPU 工作台 —— 数据源全走 /ai6api 封装的 stem-lab 接口：
//   选项 GET /stem-lab/options · 歌曲 GET /stem-lab/songs · 提交 POST /stem-lab/submit
//   轮询 GET /stem-lab/jobs/{job}/status（done 时 outputs 含各轨 play_url/download_urls + archive）
// 本版的取舍：
//   - 来源仅「平台歌曲选择」，不做本地上传 tab。
//   - 不做历史按钮 / 弹窗。
//   - 无套餐页 → 计费提示照常显示，但跳购买的链接省去。
import { api, ApiError, ai6Media, authedDownload } from './api.js';
import { el, clear, toast } from './ui.js';

// 分轨工作台 markup（去掉本地上传 / 历史 / 购买入口），作用域类 .gm-st-scope（样式见 styles.css）。
const TEMPLATE = `
  <div class="stem-app">
    <section class="stem-main">
      <header class="stem-topbar">
        <div class="stem-brand">
          <div class="stem-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div class="stem-title-group"><h1 class="stem-title">分轨工作台</h1></div>
        </div>
        <div class="stem-form">
          <div class="stem-source-wrap" data-stem-source-wrap>
            <div class="stem-source-tabs" aria-label="选择歌曲">
              <button class="stem-source-tab" type="button" data-stem-source-carbon data-active="true" aria-haspopup="listbox">选择歌曲</button>
            </div>
            <div class="stem-song-menu" data-stem-song-menu hidden>
              <input class="stem-song-search" type="search" data-stem-song-search placeholder="搜索歌曲" autocomplete="off">
              <div class="stem-song-options" data-stem-song-options></div>
            </div>
          </div>
          <select class="stem-select" data-stem-mode-select aria-label="分轨模式"></select>
          <select class="stem-select" data-stem-format-select aria-label="下载格式">
            <option value="mp3" selected>MP3</option>
            <option value="wav">WAV</option>
          </select>
          <span class="stem-cost-hint" data-stem-cost-hint></span>
        </div>
      </header>

      <div class="stem-workspace">
        <div class="stem-stage">
          <div class="stem-stage-head">
            <div class="stem-status"><span class="stem-dot"></span><span data-stem-status>请选择歌曲</span></div>
            <div class="stem-expire-note" data-stem-expire-note hidden>结果保留 1 天，请及时下载</div>
            <div class="stem-file-title" data-stem-file-title>-</div>
          </div>
          <div class="stem-stage-progress" data-stem-progress-stage>
            <div class="stem-pg-emoji" data-stem-pg-emoji></div>
            <div class="stem-pg-title" data-stem-pg-title>等待分轨任务</div>
            <div class="stem-pg-bar" data-stem-pg-bar hidden><span class="stem-pg-fill" data-stem-pg-fill></span></div>
            <div class="stem-pg-hint" data-stem-pg-hint hidden>最快 10 秒内完成；高峰期需要排队，请耐心等待</div>
            <button class="stem-pg-start" type="button" data-stem-stage-start hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
              提交分轨
            </button>
          </div>
          <div class="stem-tracks" data-stem-tracks hidden>
            <div class="stem-playhead" data-stem-playhead hidden><span data-stem-playhead-time>00:00</span></div>
            <div class="stem-track-list" data-stem-track-list></div>
          </div>
        </div>
      </div>

      <footer class="stem-bottom">
        <div class="stem-transport">
          <button class="stem-play" type="button" data-stem-play data-playing="false" data-loading="false" disabled aria-label="播放">
            <svg data-icon-play viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <svg data-icon-pause viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M8 5v14"/><path d="M16 5v14"/></svg>
            <svg data-icon-loading class="stem-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>
          </button>
          <button class="stem-skip" type="button" data-stem-back aria-label="回到开头">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 7v10l-7-5 7-5Zm2 0h2v10h-2V7Z"/></svg>
          </button>
          <div class="stem-progress-wrap">
            <div class="stem-buffer" aria-hidden="true"><span data-stem-buffer></span></div>
            <input class="stem-progress" type="range" min="0" max="0" value="0" step="0.01" data-stem-progress disabled aria-label="播放进度">
          </div>
          <div class="stem-time" data-stem-time>00:00 / 00:00</div>
        </div>
        <div class="stem-download" data-stem-download hidden>
          <button class="stem-save" type="button" data-stem-save disabled>下载压缩包</button>
          <div class="stem-zip-progress" data-stem-zip-progress hidden>
            <div class="stem-zip-bar" data-stem-zip-bar data-indeterminate="true"><span data-stem-zip-fill></span></div>
            <span class="stem-zip-label" data-stem-zip-label>压缩包准备中…</span>
          </div>
        </div>
      </footer>
    </section>
  </div>`;

const STAGE_ICONS = {
  idle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
  processing: '<svg class="stem-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>',
  failed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  ready: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
};

const LABEL_MAP = {
  vocals: '人声', drums: '鼓', bass: '贝斯', guitar: '吉他',
  piano: '钢琴', other: '其他', instrumental: '伴奏',
};
const ORDER = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other', 'instrumental'];

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function stemLabel(stem) { return LABEL_MAP[String(stem || '').toLowerCase()] || stem || 'Track'; }
function itemLabel(item) { return item && item.display_name ? item.display_name : stemLabel(item && item.stem); }
function formatTime(seconds) {
  seconds = Math.max(0, Number(seconds || 0));
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
function iconVolume(muted) {
  return muted
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="m19 9-6 6"/><path d="m13 9 6 6"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8 8 0 0 1 0 12"/></svg>';
}
function iconDownload() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
}
function waveHtml(stem) {
  let seed = 0;
  String(stem || '').split('').forEach((ch) => { seed += ch.charCodeAt(0); });
  let html = '';
  for (let i = 0; i < 96; i += 1) {
    let h = 20 + ((seed + i * 13 + (i % 9) * 7) % 62);
    if (i % 17 === 0) h = Math.max(12, Math.round(h * 0.45));
    html += '<span style="height:' + h + '%"></span>';
  }
  return html;
}

// 模块级 state（每次进入 renderStemLab 重置；与主站脚本同结构）
let opts = null;        // options 接口：cost_matrix / svip_free_remaining / first_free_available / credits / modes ...
let songOptions = [];   // 可分轨平台歌曲
let R = {};             // DOM 引用
let state = null;

export async function renderStemLab(root) {
  clear(root);
  root.innerHTML = '<div class="gm-st-scope">' + TEMPLATE + '</div>';
  const scope = root.querySelector('.gm-st-scope');

  R = {
    statusEl: scope.querySelector('[data-stem-status]'),
    fileTitle: scope.querySelector('[data-stem-file-title]'),
    expireNote: scope.querySelector('[data-stem-expire-note]'),
    tracksEl: scope.querySelector('[data-stem-tracks]'),
    trackList: scope.querySelector('[data-stem-track-list]'),
    playhead: scope.querySelector('[data-stem-playhead]'),
    playheadTime: scope.querySelector('[data-stem-playhead-time]'),
    playBtn: scope.querySelector('[data-stem-play]'),
    backBtn: scope.querySelector('[data-stem-back]'),
    progress: scope.querySelector('[data-stem-progress]'),
    timeEl: scope.querySelector('[data-stem-time]'),
    bufferBar: scope.querySelector('[data-stem-buffer]'),
    downloadArea: scope.querySelector('[data-stem-download]'),
    saveBtn: scope.querySelector('[data-stem-save]'),
    zipProgress: scope.querySelector('[data-stem-zip-progress]'),
    zipBar: scope.querySelector('[data-stem-zip-bar]'),
    zipFill: scope.querySelector('[data-stem-zip-fill]'),
    zipLabel: scope.querySelector('[data-stem-zip-label]'),
    sourceCarbon: scope.querySelector('[data-stem-source-carbon]'),
    songMenu: scope.querySelector('[data-stem-song-menu]'),
    songSearch: scope.querySelector('[data-stem-song-search]'),
    songOptionsEl: scope.querySelector('[data-stem-song-options]'),
    modeSelect: scope.querySelector('[data-stem-mode-select]'),
    formatSelect: scope.querySelector('[data-stem-format-select]'),
    costHint: scope.querySelector('[data-stem-cost-hint]'),
    progressStage: scope.querySelector('[data-stem-progress-stage]'),
    pgEmoji: scope.querySelector('[data-stem-pg-emoji]'),
    pgTitle: scope.querySelector('[data-stem-pg-title]'),
    pgBar: scope.querySelector('[data-stem-pg-bar]'),
    pgFill: scope.querySelector('[data-stem-pg-fill]'),
    pgHint: scope.querySelector('[data-stem-pg-hint]'),
    pgStart: scope.querySelector('[data-stem-stage-start]'),
  };

  state = {
    outputs: [], audios: {}, muted: {}, archiveDownloadUrls: {},
    playing: false, loading: false, playToken: 0, jobToken: 0,
    stage: 'idle', jobId: '', jobOutputFormat: 'mp3',
    selectedSongId: '', sourceTitle: '', zipBusy: false,
    currentTime: 0, duration: 0, raf: 0,
  };
  songOptions = [];
  opts = null;

  setStage('idle');

  let songsResp;
  try {
    [opts, songsResp] = await Promise.all([api.stemLabOptions(), api.stemLabSongs()]);
  } catch (e) {
    R.progressStage.innerHTML = '<p class="gm-error">' + escapeHtml(e instanceof ApiError ? e.message : '加载失败') + '</p>';
    return;
  }
  songOptions = (songsResp && songsResp.songs) || [];

  buildModeOptions();
  bindEvents();
  applyPreselect();
  updateCostHint();
  renderSongOptions('');
}

// 档位下拉：用 options.modes（含 2stem/4stem/6stem），默认 6stem（主站默认 6 轨）。
function buildModeOptions() {
  const modes = (opts.modes && opts.modes.length)
    ? opts.modes
    : [{ key: '6stem', label: '6 轨' }, { key: '4stem', label: '4 轨' }, { key: '2stem', label: '2 轨（人声+伴奏）' }];
  // 主站把 6 轨放第一项做默认；options 返回的是 2/4/6 顺序，这里翻转让 6 轨在前。
  const ordered = modes.slice().sort((a, b) => {
    const w = (k) => ({ '6stem': 0, '4stem': 1, '2stem': 2 }[k] ?? 9);
    return w(a.key) - w(b.key);
  });
  R.modeSelect.innerHTML = ordered
    .map((m) => '<option value="' + escapeHtml(m.key) + '">' + escapeHtml(m.label) + '</option>')
    .join('');
  R.modeSelect.value = '6stem';
}

// 「我的音乐」点「分离伴奏」跳来：sessionStorage 预选歌曲 + 档位（对齐主站 ?song=..&mode=inst → 2stem）。
function applyPreselect() {
  let pre;
  try { pre = JSON.parse(sessionStorage.getItem('gm_stem_preselect') || 'null'); } catch { pre = null; }
  if (!pre) return;
  sessionStorage.removeItem('gm_stem_preselect');
  if (pre.song_id) {
    const found = songOptions.find((x) => String(x.id) === String(pre.song_id));
    if (found) chooseSong(found);
    else toast('这首歌暂不在可分轨列表（可能还在处理中）', 'warn');
  }
  if (pre.mode === 'inst' || pre.mode === '2stem') {
    // 分离伴奏 = 2 轨（人声 + 伴奏）
    if ([...R.modeSelect.options].some((o) => o.value === '2stem')) R.modeSelect.value = '2stem';
  }
  updateCostHint();
}

// ---------- 计费提示（照搬主站 costHint：首免 / SVIP 本月免费剩 N / 本月用完五折 / 普通消耗 N 次）----------
function basePrice() {
  const mode = R.modeSelect ? R.modeSelect.value : '6stem';
  const fmt = R.formatSelect ? R.formatSelect.value : 'mp3';
  return ((opts && opts.cost_matrix && opts.cost_matrix[mode]) || {})[fmt] || 2;
}
function updateCostHint() {
  if (!R.costHint || !opts) return;
  const n = basePrice();
  const half = Math.ceil(n / 2);
  const isSvip = !!opts.is_svip;
  const svipFreeRemaining = opts.svip_free_remaining || 0;
  const perMonth = opts.svip_free_per_month || 5;
  const firstFree = !!opts.first_free_available;
  // gmw 无套餐页：去掉主站「前往购买/开通 SVIP」链接，文案其余照搬。
  if (isSvip && svipFreeRemaining > 0) {
    R.costHint.innerHTML = '<s>消耗 ' + n + ' 次</s> <em>SVIP 本月免费（还剩 ' + svipFreeRemaining + ' 次）</em>';
  } else if (isSvip) {
    R.costHint.innerHTML = '本月免费已用完 · SVIP 五折 <s>' + n + '</s> <b>' + half + '</b> 次';
  } else if (firstFree) {
    R.costHint.innerHTML = '首次免费体验 <em>· SVIP 每月 ' + perMonth + ' 次免费</em>';
  } else {
    R.costHint.innerHTML = '消耗 <b>' + n + '</b> 次 <em>· SVIP 每月 ' + perMonth + ' 次免费分轨</em>';
  }
}

// ---------- 工作区状态机（照搬主站 setStage：idle / processing / done / failed；ready=已选歌）----------
function setStage(stage, opt) {
  opt = opt || {};
  state.stage = stage;
  const showTracks = stage === 'done';
  if (R.tracksEl) R.tracksEl.hidden = !showTracks;
  if (R.progressStage) R.progressStage.hidden = showTracks;
  if (R.expireNote) R.expireNote.hidden = !showTracks;
  if (showTracks) return;
  let icon = STAGE_ICONS.idle, title = '等待分轨任务', barHidden = true, indeterminate = false, hintHidden = true;
  if (stage === 'processing') {
    icon = STAGE_ICONS.processing; barHidden = false; indeterminate = true;
    title = opt.title || '分轨中…'; hintHidden = false;
  } else if (stage === 'failed') {
    icon = STAGE_ICONS.failed; title = opt.message || '分轨失败，请重试';
  } else if (stage === 'ready') {
    icon = STAGE_ICONS.ready; title = '已选择：' + (opt.name || '歌曲');
  } else {
    title = opt.title || '等待分轨任务';
  }
  if (R.pgEmoji) R.pgEmoji.innerHTML = icon;
  if (R.pgTitle) R.pgTitle.textContent = title;
  if (R.pgBar) { R.pgBar.hidden = barHidden; R.pgBar.setAttribute('data-indeterminate', indeterminate ? 'true' : 'false'); }
  if (R.pgFill) R.pgFill.style.width = indeterminate ? '' : '0%';
  if (R.pgHint) R.pgHint.hidden = hintHidden;
  if (R.pgStart) R.pgStart.hidden = stage !== 'ready';  // 选好歌后显示「提交分轨」按钮
}

function setStatus(text) { if (R.statusEl) R.statusEl.textContent = text; }
function setCurrentFileTitle(text) { if (R.fileTitle) R.fileTitle.textContent = text || '-'; }

// ---------- 歌曲选择下拉（照搬主站搜索 + 选项；数据用 stemLabSongs，前端按标题过滤）----------
function renderSongOptions(filter) {
  if (!R.songOptionsEl) return;
  const q = String(filter || '').trim().toLowerCase();
  const rows = songOptions.filter((song) => !q || String(song.title || '').toLowerCase().indexOf(q) >= 0);
  if (!rows.length) {
    R.songOptionsEl.innerHTML = '<div class="stem-empty" style="min-height:76px">' + (songOptions.length ? '没有找到歌曲' : '暂无可分轨的歌曲') + '</div>';
    return;
  }
  R.songOptionsEl.innerHTML = rows.map((song) => {
    const selected = String(song.id) === String(state.selectedSongId);
    const meta = [song.format, song.created_at].filter(Boolean).join(' · ');
    return '<button class="stem-song-option" type="button" data-song-option="' + escapeHtml(song.id) + '" data-selected="' + (selected ? 'true' : 'false') + '">'
      + '<span><strong>' + escapeHtml(song.title || '未命名歌曲') + '</strong><br><small>' + escapeHtml(meta) + '</small></span>'
      + '</button>';
  }).join('');
}

function chooseSong(song) {
  if (!song) return;
  state.selectedSongId = String(song.id || '');
  setCurrentFileTitle(song.title || '未命名歌曲');
  state.sourceTitle = song.title || '未命名歌曲';
  renderSongOptions(R.songSearch && R.songSearch.value);
  if (state.stage === 'idle' || state.stage === 'ready') {
    setStage('ready', { name: song.title || '歌曲' });
  }
}

function isSongPickerEventTarget(target) {
  if (!target || !target.closest) return false;
  return Boolean(target.closest('[data-stem-song-menu]') || target.closest('[data-stem-source-carbon]'));
}

// 重新点「选择歌曲」时：取消进行中的轮询、清空轨道、回到 idle（照搬 resetWorkspace）。
function resetWorkspace() {
  state.jobToken += 1;
  state.jobId = '';
  clearPlayback();
  setStage('idle');
}

// ---------- 提交分轨（gmw 仅平台歌曲：POST /stem-lab/submit → 轮询 /jobs/{id}/status）----------
function submitJob() {
  if (state.stage === 'processing') return;
  if (!state.selectedSongId) { setStatus('请先选择歌曲'); toast('请先选择歌曲', 'warn'); return; }
  // 计费前置提示（与主站一致）：免费场景不卡，余额不足由服务端拦（gmw 无本地 credits 守卫页）。
  const token = (state.jobToken += 1);
  clearPlayback();
  setStatus('提交中');
  setStage('processing', { title: '提交中…' });
  const mode = R.modeSelect.value;
  const fmt = R.formatSelect.value;
  api.stemLabSubmit({ song_id: state.selectedSongId, mode, output_format: fmt })
    .then((data) => {
      if (token !== state.jobToken) return;
      state.jobId = data.job_id;
      state.jobOutputFormat = data.format || fmt;
      if (data.song_title) { state.sourceTitle = data.song_title; setCurrentFileTitle(data.song_title); }
      const queued = data.status === 'queued';
      setStatus(queued ? '排队中' : '分轨中');
      setStage('processing', { title: queued ? '排队中…' : '分轨中…' });
      pollJob(token);
    })
    .catch((e) => {
      if (token !== state.jobToken) return;
      const msg = e instanceof ApiError ? e.message : '提交失败';
      setStatus(msg);
      setStage('failed', { message: msg });
      toast(msg, 'error');
    });
}

function pollJob(token) {
  if (token !== state.jobToken || !state.jobId) return;
  api.stemLabJobStatus(state.jobId)
    .then((data) => {
      if (token !== state.jobToken) return;
      if (data.status === 'done') {
        state.archiveDownloadUrls = data.archive_download_urls || {};
        if (data.source_title) state.sourceTitle = data.source_title;
        if (data.output_format) state.jobOutputFormat = data.output_format;
        setStatus('完成');
        renderTracks(data.outputs || []);
        setStage('done');
        return;
      }
      if (data.status === 'failed') {
        const msg = data.error || '分轨失败，请重试';
        setStatus(msg);
        setStage('failed', { message: msg });
        return;
      }
      if (data.status === 'cleared') {
        setStatus('任务已过期');
        setStage('failed', { message: '该分轨结果已超过 1 天被清理，可重新发起分轨' });
        return;
      }
      const queued = data.status === 'queued';
      setStatus(queued ? '排队中' : '分轨中');
      setStage('processing', { title: queued ? '排队中…' : '分轨中…' });
      window.setTimeout(() => pollJob(token), 2500);
    })
    .catch((e) => {
      if (token !== state.jobToken) return;
      const msg = e instanceof ApiError ? e.message : '查询失败';
      setStatus(msg);
      setStage('failed', { message: msg + '，请重试' });
    });
}

// ---------- 轨道渲染 + 多轨同步播放（照搬主站：默认人声开声，其余静音；静音轨也同步播只是不出声）----------
function sortOutputs(outputs) {
  return outputs.slice().sort((a, b) => {
    let ai = ORDER.indexOf(String(a.stem || '').toLowerCase());
    let bi = ORDER.indexOf(String(b.stem || '').toLowerCase());
    if (ai < 0) ai = 99;
    if (bi < 0) bi = 99;
    return ai - bi;
  });
}

function renderTracks(outputs) {
  state.outputs = sortOutputs(outputs || []);
  if (!state.outputs.length) {
    R.trackList.innerHTML = '<div class="stem-empty">正在等待分轨文件</div>';
    if (R.playhead) R.playhead.hidden = true;
    R.playBtn.disabled = true;
    R.progress.disabled = true;
    if (R.saveBtn) R.saveBtn.disabled = true;
    if (R.downloadArea) R.downloadArea.hidden = true;
    return;
  }
  const stems = state.outputs.map((o) => String(o.stem || ''));
  const defaultOnStem = stems.indexOf('vocals') !== -1 ? 'vocals'
    : (stems.indexOf('instrumental') !== -1 ? 'instrumental' : (stems[0] || ''));
  R.trackList.innerHTML = state.outputs.map((item) => {
    const stem = String(item.stem || '');
    if (typeof state.muted[stem] === 'undefined') state.muted[stem] = stem !== defaultOnStem;
    const displayName = itemLabel(item);
    return [
      '<article class="stem-track" data-track="' + stem + '">',
      '<div class="stem-track-left">',
      '<button class="stem-mute" type="button" data-track-mute="' + stem + '" data-muted="' + (state.muted[stem] ? 'true' : 'false') + '" aria-label="切换声音">',
      iconVolume(state.muted[stem]),
      '</button>',
      '<div><div class="stem-track-name">' + escapeHtml(displayName) + '</div></div>',
      '</div>',
      '<div class="stem-wave" aria-hidden="true">' + waveHtml(stem) + '</div>',
      '<button class="stem-track-dl" type="button" data-track-dl="' + stem + '" title="下载这条轨" aria-label="下载 ' + escapeHtml(displayName) + '">',
      iconDownload(),
      '</button>',
      '</article>',
    ].join('');
  }).join('');
  if (R.playhead) R.playhead.hidden = false;
  R.playBtn.disabled = false;
  R.progress.disabled = false;
  if (R.downloadArea) R.downloadArea.hidden = false;
  refreshDownloadState();
  updateTime();
  preloadAudios();
}

function downloadFormat() { return state.jobOutputFormat || 'mp3'; }
function archiveDownloadUrl() {
  const fmt = downloadFormat();
  return (state.archiveDownloadUrls && state.archiveDownloadUrls[fmt]) || '';
}
function refreshDownloadState() {
  if (R.saveBtn) R.saveBtn.disabled = !state.outputs.length || !archiveDownloadUrl();
}

function preloadAudios() {
  state.outputs.forEach((item) => {
    const a = ensureAudio(item);
    if (a) { try { a.load(); } catch (e) { /* ignore */ } }
  });
}

function setLoading(loading, message) {
  state.loading = Boolean(loading);
  R.playBtn.dataset.loading = state.loading ? 'true' : 'false';
  if (state.loading && R.bufferBar && (!R.bufferBar.style.width || R.bufferBar.style.width === '0%')) {
    R.bufferBar.style.width = '8%';
  }
  if (message) setStatus(message);
}
function activeOutputs() { return state.outputs.filter((item) => !state.muted[String(item.stem || '')]); }
function allEnded() {
  const all = Object.keys(state.audios).map((s) => state.audios[s]);
  return all.length > 0 && all.every((a) => a.ended || a.paused);
}
function primaryAudio() {
  const active = activeOutputs();
  for (let i = 0; i < active.length; i += 1) {
    const stem = String(active[i].stem || '');
    if (state.audios[stem]) return state.audios[stem];
  }
  return state.audios[Object.keys(state.audios)[0]];
}
function updateBuffer(audio) {
  if (!R.bufferBar) return;
  const ref = audio || primaryAudio();
  const duration = state.duration || (ref && Number.isFinite(ref.duration) ? ref.duration : 0);
  let percent = 0;
  if (ref && ref.buffered && duration > 0) {
    for (let i = 0; i < ref.buffered.length; i += 1) {
      percent = Math.max(percent, Math.min(100, (ref.buffered.end(i) / duration) * 100));
    }
  }
  if (!percent && state.loading) percent = 8;
  R.bufferBar.style.width = percent.toFixed(2) + '%';
}
function updatePlayhead(current, duration) {
  if (!R.playhead) return;
  if (!state.outputs.length) { R.playhead.hidden = true; return; }
  const wave = R.trackList.querySelector('.stem-wave');
  if (!wave) return;
  const tracksRect = R.tracksEl.getBoundingClientRect();
  const waveRect = wave.getBoundingClientRect();
  const pct = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
  const x = waveRect.left - tracksRect.left + (waveRect.width * pct);
  R.playhead.hidden = false;
  R.playhead.style.transform = 'translateX(' + x.toFixed(2) + 'px)';
  if (R.playheadTime) R.playheadTime.textContent = formatTime(current);
}
function updateTime() {
  let current = state.currentTime;
  const audio = primaryAudio();
  if (audio) current = audio.currentTime || current;
  const duration = state.duration || (audio && Number.isFinite(audio.duration) ? audio.duration : 0);
  if (duration > 0) R.progress.max = String(duration);
  R.progress.value = String(current);
  R.timeEl.textContent = formatTime(current) + ' / ' + formatTime(duration);
  updatePlayhead(current, duration);
  updateBuffer(audio);
}
function tick() {
  updateTime();
  if (state.playing) state.raf = window.requestAnimationFrame(tick);
}
function setPlayingIcon(playing) {
  R.playBtn.dataset.playing = playing ? 'true' : 'false';
  R.playBtn.setAttribute('aria-label', playing ? '暂停' : '播放');
}
function stopVisuals(pauseAudio, message) {
  state.playToken += 1;
  state.playing = false;
  setLoading(false);
  window.cancelAnimationFrame(state.raf);
  if (pauseAudio) Object.keys(state.audios).forEach((s) => state.audios[s].pause());
  setPlayingIcon(false);
  if (message) setStatus(message);
  updateTime();
}
function clearPlayback() {
  stopVisuals(true);
  state.outputs = [];
  state.audios = {};
  state.muted = {};
  state.archiveDownloadUrls = {};
  state.currentTime = 0;
  state.duration = 0;
  if (R.progress) { R.progress.value = '0'; R.progress.max = '0'; R.progress.disabled = true; }
  if (R.bufferBar) R.bufferBar.style.width = '0%';
  if (R.trackList) R.trackList.innerHTML = '';
  if (R.playBtn) R.playBtn.disabled = true;
  if (R.saveBtn) R.saveBtn.disabled = true;
  if (R.downloadArea) R.downloadArea.hidden = true;
  if (R.playhead) R.playhead.hidden = true;
}
function ensureAudio(item) {
  const stem = String(item.stem || '');
  if (!stem) return null;
  if (state.audios[stem]) return state.audios[stem];
  // play_url 是后端签名的 mp3 试听片段 URL（/api/mini 前缀）→ ai6Media 改写到 /ai6api 经同源代理播放。
  const audio = new Audio(ai6Media(item.play_url || ''));
  audio.preload = 'auto';
  audio.muted = Boolean(state.muted[stem]);
  audio.playsInline = true;
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      state.duration = Math.max(state.duration, audio.duration);
      R.progress.max = String(state.duration);
      updateTime();
    }
  });
  audio.addEventListener('durationchange', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      state.duration = Math.max(state.duration, audio.duration);
      updateTime();
    }
  });
  audio.addEventListener('progress', () => updateBuffer(audio));
  audio.addEventListener('canplay', () => { setLoading(false); updateBuffer(audio); });
  audio.addEventListener('playing', () => setLoading(false, '播放中'));
  audio.addEventListener('waiting', () => { if (state.playing) setLoading(true, '缓冲中…'); });
  audio.addEventListener('ended', () => { if (allEnded()) stopVisuals(false, '播放结束'); });
  audio.addEventListener('error', () => { if (state.playing || state.loading) stopVisuals(false, '音频加载失败，请稍后重试'); });
  state.audios[stem] = audio;
  return audio;
}
function playAll() {
  if (!state.outputs.length) { setStatus('分轨文件还没准备好'); return; }
  if (!activeOutputs().length) { setStatus('请至少打开一轨声音'); return; }
  const startAt = Number(R.progress.value || state.currentTime || 0);
  const promises = [];
  const token = state.playToken + 1;
  state.playToken = token;
  setLoading(true, '缓冲中…');
  setPlayingIcon(true);
  state.outputs.forEach((item) => {
    const stem = String(item.stem || '');
    const audio = ensureAudio(item);
    if (!audio) return;
    audio.muted = Boolean(state.muted[stem]);
    try { if (Math.abs((audio.currentTime || 0) - startAt) > 0.15) audio.currentTime = startAt; } catch (e) { /* ignore */ }
    try { promises.push(audio.play() || Promise.resolve()); } catch (e) { promises.push(Promise.reject(e)); }
  });
  Promise.allSettled(promises).then((results) => {
    if (token !== state.playToken) return;
    const ok = results.some((r) => r.status === 'fulfilled');
    if (!ok) { stopVisuals(false, '音频还没加载好，请再点一次'); return; }
    state.playing = true;
    setLoading(false, '播放中');
    setPlayingIcon(true);
    tick();
  });
}

// ---------- 下载：绝对 CDN 直链直接 open；相对代理 URL 经 ai6Media + authedDownload ----------
function triggerDownload(url, name) {
  const a = document.createElement('a');
  a.href = url;
  if (name) a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadTrack(item, btn) {
  const fmt = downloadFormat();
  const urls = item.download_urls || {};
  const names = item.download_filenames || {};
  const url = urls[fmt] || urls.mp3 || '';
  if (!url) { setStatus('该轨下载暂不可用'); return; }
  const name = names[fmt] || names.mp3 || (itemLabel(item) + '.' + fmt);
  const label = itemLabel(item);
  // 绝对 CDN 直链 → 直接打开，文件名由 CDN disposition 决定。
  if (/^https?:\/\//.test(url)) {
    triggerDownload(url, name);
    setStatus(label + ' 开始下载');
    return;
  }
  // 相对代理 URL（尚无 CDN 直链 / 付费校验场景）→ ai6Media 改写 + fetch 带 Bearer。
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="stem-dl-spin"></span>'; }
  setStatus(label + ' 准备中…');
  try {
    await authedDownload(url, name);
    setStatus(label + ' 已开始下载');
  } catch (e) {
    setStatus((e instanceof ApiError ? e.message : (label + ' 下载失败，请重试')));
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = iconDownload(); }
  }
}

function zipFilename() {
  let t = String(state.sourceTitle || (R.fileTitle ? R.fileTitle.textContent : '') || '').trim();
  if (!t || t === '-') t = '分轨';
  t = t.replace(/[\\/:*?"<>|]/g, '_').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!t) t = '分轨';
  return t + '_分轨.zip';
}
function showZipProgress(show, label) {
  if (!R.zipProgress) return;
  R.zipProgress.hidden = !show;
  if (R.saveBtn) R.saveBtn.hidden = show;
  if (show && R.zipLabel && label) R.zipLabel.textContent = label;
}
async function downloadArchive() {
  if (state.zipBusy) return;
  const url = archiveDownloadUrl();
  if (!url) { setStatus('压缩包还没准备好'); return; }
  // 绝对 CDN 直链 → 直接下载。
  if (/^https?:\/\//.test(url)) {
    triggerDownload(url, null);
    setStatus('开始下载压缩包');
    return;
  }
  // 相对代理 URL（尚无 CDN 直链时的兜底）→ ai6Media + fetch 带 Bearer，文件名=歌名_分轨.zip。
  state.zipBusy = true;
  showZipProgress(true, '压缩包准备中…');
  setStatus('正在准备压缩包…');
  try {
    await authedDownload(url, zipFilename());
    setStatus('已开始下载');
  } catch (e) {
    setStatus((e instanceof ApiError ? e.message : '压缩包准备失败，请重试'));
  } finally {
    state.zipBusy = false;
    showZipProgress(false);
  }
}

// ---------- 事件绑定 ----------
function bindEvents() {
  R.sourceCarbon.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetWorkspace();
    if (R.songMenu) {
      R.songMenu.hidden = false;
      renderSongOptions(R.songSearch ? R.songSearch.value : '');
      if (R.songSearch) R.songSearch.focus();
    }
  });
  if (R.songMenu) R.songMenu.addEventListener('click', (e) => e.stopPropagation());
  if (R.songSearch) {
    R.songSearch.addEventListener('input', () => renderSongOptions(R.songSearch.value));
  }
  if (R.songOptionsEl) {
    R.songOptionsEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-song-option]');
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      const id = btn.getAttribute('data-song-option');
      const song = songOptions.find((item) => String(item.id) === String(id));
      chooseSong(song);
      if (R.songMenu) R.songMenu.hidden = true;
      setStatus('已选择歌曲');
    });
  }
  document.addEventListener('click', (event) => {
    if (R.songMenu && !R.songMenu.hidden && !isSongPickerEventTarget(event.target)) R.songMenu.hidden = true;
  });

  if (R.modeSelect) R.modeSelect.addEventListener('change', updateCostHint);
  if (R.formatSelect) R.formatSelect.addEventListener('change', updateCostHint);
  if (R.pgStart) R.pgStart.addEventListener('click', submitJob);

  // 轨道：静音切换（照搬主站；正在播时取消静音即时生效）
  R.tracksEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-track-mute]');
    if (!btn || btn.disabled) return;
    const stem = btn.getAttribute('data-track-mute');
    state.muted[stem] = !state.muted[stem];
    btn.setAttribute('data-muted', state.muted[stem] ? 'true' : 'false');
    btn.innerHTML = iconVolume(state.muted[stem]);
    if (state.audios[stem]) state.audios[stem].muted = state.muted[stem];
    if (state.playing && !state.muted[stem]) {
      const item = state.outputs.find((o) => String(o.stem || '') === stem);
      const audio = item && ensureAudio(item);
      if (audio) {
        audio.muted = false;
        if (audio.paused || audio.ended) {
          try { audio.currentTime = Number(R.progress.value || state.currentTime || 0); } catch (e) { /* ignore */ }
          try {
            const pr = audio.play();
            if (pr && pr.catch) pr.catch(() => setStatus('这一路音频还没加载好'));
          } catch (e) { setStatus('这一路音频还没加载好'); }
        }
      }
    }
    updateTime();
  });

  // 轨道：单轨下载
  R.tracksEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-track-dl]');
    if (!btn || btn.disabled) return;
    const stem = btn.getAttribute('data-track-dl');
    const item = state.outputs.find((o) => String(o.stem || '') === stem);
    if (item) downloadTrack(item, btn);
  });

  R.playBtn.addEventListener('click', () => {
    if (state.playing || state.loading) stopVisuals(true, '已暂停');
    else playAll();
  });
  R.backBtn.addEventListener('click', () => {
    state.currentTime = 0;
    R.progress.value = '0';
    Object.keys(state.audios).forEach((s) => { try { state.audios[s].currentTime = 0; } catch (e) { /* ignore */ } });
    updateTime();
  });
  R.progress.addEventListener('input', () => {
    state.currentTime = Number(R.progress.value || 0);
    Object.keys(state.audios).forEach((s) => { try { state.audios[s].currentTime = state.currentTime; } catch (e) { /* ignore */ } });
    updateTime();
  });
  R.saveBtn.addEventListener('click', downloadArchive);

  window.addEventListener('resize', updateTime);
}
