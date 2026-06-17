// 「编曲房」—— 对齐主站 /music/studio/ 页。
// 把想法/歌词编排成结构化歌词 + 风格标签，可多轮调整，一键带去创作。
// {% %} → JS；{% url 'music:studio_arrange' %} → api.studioArrange/Poll；
// Yapie 帮我写 → api.generateLyrics/lyricsStatus（gmw 无 generate-lyrics-stream 端点，
//   改用现成 generateLyrics 一次性回填）。Yapie 头像主站取 pk=1，gmw 无该接口 → emoji 🎩 + 名字「Yapie」兜底。
import { api, poll, ApiError, getApiKey } from './api.js?v=20260617-ai-music-payment-refresh';
import { ensureKey } from './auth.js?v=20260617-ai-music-payment-refresh';
import { clear } from './ui.js?v=20260617-ai-music-payment-refresh';

const STYLE_DELIM = '===风格===';
const HOST_NAME = 'Yapie';

// 「示例」按钮一键填入的完整分段编曲示例（逐字搬自 studio.html ST_REQ_EXAMPLE）
const ST_REQ_EXAMPLE = [
  '歌剧院风格女中高音+前奏8小节空灵静谧开篇水晶钵+管风琴+独奏竖琴+低音大提琴+高音长笛+小型管风琴（弱音长音）；',
  '主歌一人声：女中高音中音区叙事唱法，咬字规整如歌剧宣叙调，沉稳平缓+高音排箫+单簧管主旋律+低音大提琴拨奏+钢片琴+轻柔竖琴+琵琶分解+弦乐组；',
  '副歌一：完整弦乐组全奏+大号铺底+第一小提琴群+双簧管+圆号+轻型定音鼓+空灵碰钟穿插+副歌旋律+空灵水晶钵间歇长音留存太空质感；',
  '主歌二：长笛碎音+木管组+管风琴+中提琴+三角铁+低音大管；',
  '副歌二：全组弦乐组+铜管组+小号+大号+定音鼓滚奏+风铃+双簧管齐奏；',
  '间奏：小提琴独奏高亮+大跨度竖琴琶音+单簧管独奏+圆号低音长音+太空泛音风铃；',
  '歌三：小提琴独奏++竖琴+圆号铺垫+单簧管+低音大提琴长音；',
  '副歌三：全编制管弦乐团（弦乐 + 全套木管 + 全套铜管）+歌剧大镲+宇宙水晶钟+管风琴主奏（空灵童声唱出）多想能陪你走过每一个太阳日，欢迎宇航员平安回家；',
  '尾奏：钢琴+管风琴（空灵童声+假空灵女高音唱出）如今只能唱出和你相逢，欢迎宇航员平安回家+小提琴泛音+排箫+竖琴+水晶钵+零星钢琴单音（收尾仅剩水晶钵余音）',
].join('\n\n');

const TRY_CHIPS = [
  '古风治愈，空灵女声，副歌再炸一点',
  '抖音热门风，副歌洗脑，节奏带感',
  '深夜情歌，温柔男声，钢琴前奏',
  '摇滚，情绪炸裂，电吉他 solo',
  '轻快流行，正能量，明亮女声',
  '纯钢琴演奏，治愈，无人声纯音乐',
];
const TRY_LABELS = ['古风治愈', '抖音热门', '深夜情歌', '摇滚炸裂', '轻快正能量', '纯音乐·钢琴'];

const LANGS = ['中文', 'English', '日本語', '한국어', '粤语'];

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// 把流式原文拆成 {lyrics, style}（与后端 _parse_studio_output 对齐）
function parseRaw(raw) {
  let t = String(raw || '').trim();
  t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '');
  const idx = t.indexOf(STYLE_DELIM);
  if (idx === -1) return { lyrics: t.trim(), style: '' };
  return { lyrics: t.slice(0, idx).trim(), style: t.slice(idx + STYLE_DELIM.length).trim() };
}

function copyText(text, btn) {
  const done = () => { const t = btn.textContent; btn.textContent = '已复制 ✓'; setTimeout(() => { btn.textContent = t; }, 1200); };
  if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done).catch(() => {}); return; }
  const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} document.body.removeChild(ta);
}

export function renderStudio(root) {
  clear(root);
  root.innerHTML = formHTML();
  wire(root);
}

function formHTML() {
  const chips = TRY_CHIPS.map((fill, i) =>
    `<button type="button" class="st-chip" data-fill="${esc(fill)}">${esc(TRY_LABELS[i])}</button>`).join('');
  const langOpts = LANGS.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');

  return `<div class="st-wrap">
    <header style="margin:6px 2px 20px;display:flex;align-items:center;gap:12px;">
      <div style="width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#f1f3f5;flex-shrink:0;font-size:22px;">🎩</div>
      <div style="min-width:0;">
        <h1 style="margin:0;font-size:21px;font-weight:900;color:#111827;line-height:1.2;">🎩 教父编曲房</h1>
        <div style="font-size:13px;color:#9ca3af;font-weight:600;margin-top:4px;">把想法或歌词，编成 AI 唱得好的结构化歌词 + 风格标签</div>
      </div>
    </header>

    <div id="stThread" style="display:flex;flex-direction:column;gap:14px;"></div>

    <div id="stStart" style="margin-top:8px;">
      <div style="font-size:13px;font-weight:800;color:#374151;margin:0 0 6px 2px;">要求</div>
      <div style="position:relative;">
        <textarea id="stReq" rows="4"
          style="width:100%;box-sizing:border-box;padding:14px 16px 36px 16px;border:1px solid #e5e7eb;border-radius:16px;outline:none;font-size:15px;line-height:1.7;resize:vertical;"
          placeholder="想要什么风格 / 情绪 / 故事？也可以直接贴整段编排…"></textarea>
        <button type="button" id="stReqExampleBtn" title="填入一段完整的分段编曲示例"
          style="position:absolute;left:10px;bottom:10px;z-index:2;display:inline-flex;align-items:center;gap:3px;padding:4px 11px;border-radius:999px;border:1px solid #fecdd3;background:rgba(255,255,255,0.95);color:#be123c;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 6px 16px -12px rgba(190,18,60,0.6);">✨ 示例</button>
        <button type="button" id="stReqClearBtn" title="清空"
          style="position:absolute;right:10px;bottom:10px;z-index:2;display:none;align-items:center;gap:3px;padding:4px 11px;border-radius:999px;border:1px solid #e5e7eb;background:rgba(255,255,255,0.92);color:#9ca3af;font-size:12px;font-weight:700;cursor:pointer;">✕ 清空</button>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:11px;align-items:center;">
        <span style="font-size:12px;color:#9ca3af;font-weight:700;">试试</span>
        ${chips}
      </div>

      <div style="font-size:13px;font-weight:800;color:#374151;margin:18px 0 8px 2px;">📝 歌词<span style="font-weight:600;color:#9ca3af;">（可选）</span></div>

      <div style="display:inline-flex;gap:4px;background:#f3f4f6;padding:4px;border-radius:12px;margin-bottom:10px;">
        <button id="stTabSelf" type="button" data-tab="self"
          style="padding:6px 16px;border:0;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer;background:#fff;color:#111;box-shadow:0 1px 3px rgba(0,0,0,.1);">自己输入</button>
        <button id="stTabAi" type="button" data-tab="ai"
          style="padding:6px 16px;border:0;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer;background:transparent;color:#6b7280;">✨ Yapie 帮我写</button>
      </div>

      <div id="stPaneSelf">
        <textarea id="stLyrics" rows="5"
          style="width:100%;box-sizing:border-box;padding:14px 16px;border:1px solid #e5e7eb;border-radius:16px;outline:none;font-size:15px;line-height:1.7;resize:vertical;"
          placeholder="把你写好的歌词粘进来（可以很长，这里看得全）…"></textarea>
      </div>

      <div id="stPaneAi" style="display:none;">
        <textarea id="stPrompt" rows="4"
          style="width:100%;box-sizing:border-box;padding:14px 16px;border:1px solid #fbcfe8;border-radius:16px;outline:none;font-size:15px;line-height:1.7;resize:vertical;background:#fff7fb;"
          placeholder="用一句话说你想要的歌：写给谁、什么故事、什么情绪。&#10;例如：写给异地恋的女朋友，想她，又怕她等不下去。"></textarea>
        <div style="display:flex;align-items:center;gap:10px;margin-top:10px;">
          <span style="font-size:12px;color:#9ca3af;">写完会自动填到「自己输入」，可继续改</span>
          <button id="stWrite" type="button"
            style="margin-left:auto;padding:9px 20px;border:1px solid #fbcfe8;background:#fff;color:#be123c;border-radius:999px;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 2px 10px -4px rgba(0,0,0,.2);">
            ✨ 生成歌词
          </button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:12px;margin-top:16px;">
        <label style="font-size:13px;color:#6b7280;">语言</label>
        <select id="stLang" style="padding:6px 12px;border:1px solid #e5e7eb;border-radius:999px;font-size:13px;outline:none;">${langOpts}</select>
        <button id="stGo" type="button"
          style="margin-left:auto;padding:11px 26px;border:0;border-radius:999px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#f43f5e,#ec4899,#f97316);box-shadow:0 10px 22px -12px rgba(236,72,153,.7);">
          ✨ 开始编排
        </button>
      </div>

      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #f3f4f6;font-size:12.5px;color:#9ca3af;line-height:1.8;text-align:center;">
        ① 说要求　→　② AI 编排成结构化歌词 + 风格　→　③ 一键带去创作
      </div>
    </div>

    <div id="stFollow" style="display:none;position:sticky;bottom:14px;margin-top:18px;">
      <div style="display:flex;gap:8px;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:6px 6px 6px 16px;box-shadow:0 10px 30px -12px rgba(0,0,0,.18);">
        <input id="stFollowInput" type="text"
          style="flex:1;border:0;outline:none;font-size:14px;background:transparent;"
          placeholder="继续调整：副歌再短一点 / 换男声 / 加前奏 …">
        <button id="stFollowGo" type="button"
          style="padding:8px 18px;border:0;border-radius:999px;color:#fff;font-weight:800;font-size:14px;cursor:pointer;background:linear-gradient(135deg,#f43f5e,#ec4899,#f97316);">发送</button>
      </div>
    </div>
  </div>`;
}

function wire(root) {
  const $ = (sel) => root.querySelector(sel);
  const thread = $('#stThread');
  const startBox = $('#stStart');
  const follow = $('#stFollow');
  let messages = [];
  let busy = false;

  // 用户气泡：浅灰圆角靠右；长文本（整首歌词）折叠
  function addUserBubble(text) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:flex-end;';
    const b = document.createElement('div');
    b.style.cssText = 'max-width:86%;background:#f1f3f5;color:#111;border-radius:18px;font-size:15px;line-height:1.65;overflow:hidden;';

    const isLong = text.length > 180 || text.split('\n').length > 7;
    const COLLAPSED = '120px';

    if (!isLong) {
      const body = document.createElement('div');
      body.style.cssText = 'padding:10px 15px;white-space:pre-wrap;word-break:break-word;';
      body.textContent = text;
      b.appendChild(body);
    } else {
      const clip = document.createElement('div');
      clip.style.cssText = 'position:relative;max-height:' + COLLAPSED + ';overflow:hidden;';
      const body2 = document.createElement('div');
      body2.style.cssText = 'padding:10px 15px;white-space:pre-wrap;word-break:break-word;';
      body2.textContent = text;
      clip.appendChild(body2);
      const fade = document.createElement('div');
      fade.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:44px;background:linear-gradient(to bottom,rgba(241,243,245,0),#f1f3f5);pointer-events:none;';
      clip.appendChild(fade);
      b.appendChild(clip);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.textContent = '展开全部 ▾';
      toggle.style.cssText = 'display:block;width:100%;padding:6px 15px 9px;border:0;background:transparent;color:#6b7280;font-size:13px;font-weight:700;cursor:pointer;';
      let expanded = false;
      toggle.addEventListener('click', () => {
        expanded = !expanded;
        clip.style.maxHeight = expanded ? 'none' : COLLAPSED;
        fade.style.display = expanded ? 'none' : 'block';
        toggle.textContent = expanded ? '收起 ▴' : '展开全部 ▾';
      });
      b.appendChild(toggle);
    }

    row.appendChild(b);
    thread.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  // 助手一行：左侧 🎩 头像 + 名字 + 内容容器
  function addAssistantRow() {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:11px;align-items:flex-start;';
    const av = document.createElement('div');
    av.style.cssText = 'width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #f1f3f5;background:#f1f3f5;font-size:18px;';
    av.textContent = '🎩';
    const col = document.createElement('div');
    col.style.cssText = 'flex:1;min-width:0;';
    const name = document.createElement('div');
    name.style.cssText = 'font-size:12px;font-weight:800;color:#6b7280;margin:4px 0 7px;';
    name.textContent = HOST_NAME;
    const content = document.createElement('div');
    col.appendChild(name); col.appendChild(content);
    row.appendChild(av); row.appendChild(col);
    thread.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return { row, content };
  }

  function lyricsBlock() {
    const d = document.createElement('div');
    d.style.cssText = 'background:#f9fafb;border:1px solid #eef0f2;border-radius:14px;padding:14px 16px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;line-height:1.85;white-space:pre-wrap;word-break:break-word;color:#1f2937;min-height:22px;';
    return d;
  }

  function mkBtn(text, kind) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
    if (kind === 'primary') {
      b.style.cssText = 'padding:8px 18px;border:0;border-radius:999px;color:#fff;font-weight:800;font-size:13px;cursor:pointer;background:linear-gradient(135deg,#7c3aed,#ec4899,#f97316);';
    } else {
      b.style.cssText = 'padding:7px 14px;border:1px solid #e5e7eb;background:#fff;color:#374151;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;';
    }
    return b;
  }

  // 出最终结果：结构化歌词 + 风格标签 + 操作按钮
  function renderResult(content, lyrics, style) {
    content.innerHTML = '';
    const lb = lyricsBlock();
    lb.textContent = lyrics;
    content.appendChild(lb);
    if (style) {
      const sl = document.createElement('div');
      sl.style.cssText = 'margin-top:10px;background:#fdf2f8;border:1px solid #fce7f3;border-radius:12px;padding:10px 14px;font-size:13px;line-height:1.6;color:#9d174d;word-break:break-word;';
      const lab = document.createElement('span'); lab.style.cssText = 'font-weight:800;color:#be185d;'; lab.textContent = '风格标签　';
      const sv = document.createElement('span'); sv.textContent = style;
      sl.appendChild(lab); sl.appendChild(sv);
      content.appendChild(sl);
    }
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;';
    const cp1 = mkBtn('复制歌词', 'light'); cp1.addEventListener('click', () => { copyText(lyrics, cp1); });
    actions.appendChild(cp1);
    if (style) { const cp2 = mkBtn('复制风格', 'light'); cp2.addEventListener('click', () => { copyText(style, cp2); }); actions.appendChild(cp2); }
    // 没有要唱的词（纯音乐）：风格标签以 instrumental 开头(后端约定)，或含 no vocals
    const _styleTrim = (style || '').trim();
    const isInstrumental = /^instrumental\b/i.test(_styleTrim) || /\bno\s+vocals?\b/i.test(_styleTrim);
    const go = mkBtn('🎵 带去创作', 'primary');
    go.addEventListener('click', () => {
      try { sessionStorage.setItem('gm_studio_handoff', JSON.stringify({ lyrics, style: style || '', instrumental: isInstrumental })); } catch (e) {}
      location.hash = 'generate';
      // 生成页可能已挂载(不会重渲) → 派事件让它即时消费 handoff, 否则按钮看着没反应
      setTimeout(() => window.dispatchEvent(new CustomEvent('gm-studio-handoff')), 0);
    });
    actions.appendChild(go);
    content.appendChild(actions);
    content.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  async function send(userContent) {
    if (busy) return;
    if (!getApiKey() && !(await ensureKey())) return;
    if (!userContent.trim()) return;
    busy = true;
    addUserBubble(userContent);
    messages.push({ role: 'user', content: userContent });
    const asst = addAssistantRow();
    const live = lyricsBlock();
    live.innerHTML = '<span style="color:#c4b5fd;">正在编排…</span>';
    asst.content.appendChild(live);
    const lang = ($('#stLang') || {}).value || '中文';

    function fail(msg, popUser) {
      busy = false;
      if (popUser) messages.pop();
      asst.content.innerHTML = '';
      const e = document.createElement('div'); e.style.cssText = 'color:#dc2626;font-size:13px;';
      e.textContent = '⚠️ ' + (msg || '编排失败，请重试');
      asst.content.appendChild(e);
      asst.content.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    let taskId;
    try {
      const d = await api.studioArrange({ messages, lang });
      if (!d || !d.ok || !d.task_id) { fail(d && d.error, true); return; }
      taskId = d.task_id;
    } catch (e) { fail(e instanceof ApiError ? e.message : '网络错误，请重试', true); return; }

    try {
      const r = await poll(() => api.studioArrangePoll(taskId), {
        interval: 600, timeout: 200000, done: (d) => d.done || !!d.error,
        onTick: (d) => { const p = parseRaw(d.text || ''); if (p.lyrics) { live.textContent = p.lyrics; live.scrollIntoView({ behavior: 'smooth', block: 'end' }); } },
      });
      if (r.error) { fail(r.error, true); return; }
      const parsed = parseRaw(r.text || '');
      busy = false;
      if (!parsed.lyrics) { fail('编排返回为空，请重试', true); return; }
      messages.push({ role: 'assistant', content: r.text });
      renderResult(asst.content, parsed.lyrics, parsed.style);
    } catch (e) { fail(e instanceof ApiError ? e.message : '编排超时，请重试', true); }
  }

  $('#stGo').addEventListener('click', () => {
    const lyrics = ($('#stLyrics').value || '').trim();
    const req = ($('#stReq').value || '').trim();
    if (!lyrics && !req) { $('#stReq').focus(); return; }
    const parts = [];
    if (lyrics) parts.push('歌词：\n' + lyrics);
    if (req) parts.push('要求：\n' + req);
    const content = parts.join('\n\n');
    startBox.style.display = 'none';
    follow.style.display = '';
    send(content);
  });

  const fi = $('#stFollowInput');
  function sendFollow() { const v = (fi.value || '').trim(); if (!v) return; fi.value = ''; send(v); }
  $('#stFollowGo').addEventListener('click', sendFollow);
  fi.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFollow(); } });

  // ---------- 歌词来源 tab：自己输入 / Yapie 帮我写 ----------
  const tabSelf = $('#stTabSelf');
  const tabAi = $('#stTabAi');
  const paneSelf = $('#stPaneSelf');
  const paneAi = $('#stPaneAi');
  const lyricsBox = $('#stLyrics');
  const promptBox = $('#stPrompt');

  function setTab(which) {
    const self = which === 'self';
    paneSelf.style.display = self ? '' : 'none';
    paneAi.style.display = self ? 'none' : '';
    tabSelf.style.background = self ? '#fff' : 'transparent';
    tabSelf.style.color = self ? '#111' : '#6b7280';
    tabSelf.style.boxShadow = self ? '0 1px 3px rgba(0,0,0,.1)' : 'none';
    tabAi.style.background = self ? 'transparent' : '#fff';
    tabAi.style.color = self ? '#6b7280' : '#111';
    tabAi.style.boxShadow = self ? 'none' : '0 1px 3px rgba(0,0,0,.1)';
  }
  tabSelf.addEventListener('click', () => { setTab('self'); lyricsBox.focus(); });
  tabAi.addEventListener('click', () => { setTab('ai'); promptBox.focus(); });

  // ---------- 示例 chip：一点即填进「要求」框 ----------
  root.querySelectorAll('.st-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const v = chip.getAttribute('data-fill') || chip.textContent;
      const box = $('#stReq');
      box.value = v;
      box.focus();
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  // ---------- 「示例」按钮：一键填完整分段编曲要求（右下角） ----------
  const stReqExampleBtn = $('#stReqExampleBtn');
  const stReqBox = $('#stReq');
  if (stReqExampleBtn && stReqBox) {
    stReqExampleBtn.addEventListener('click', () => {
      if (stReqBox.value.trim() && !confirm('当前要求框已有内容，用示例替换吗？')) return;
      stReqBox.value = ST_REQ_EXAMPLE;
      stReqBox.style.height = 'auto';
      stReqBox.style.height = (stReqBox.scrollHeight + 2) + 'px';
      stReqBox.focus();
      stReqBox.setSelectionRange(0, 0);
      stReqBox.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  // ---------- 「清空」按钮（要求框右下角）：有内容才显示 ----------
  const stReqClearBtn = $('#stReqClearBtn');
  if (stReqClearBtn && stReqBox) {
    const syncStReqClear = () => { stReqClearBtn.style.display = stReqBox.value.trim() ? 'inline-flex' : 'none'; };
    stReqBox.addEventListener('input', syncStReqClear);
    stReqClearBtn.addEventListener('click', () => {
      stReqBox.value = '';
      stReqBox.style.height = '';
      stReqBox.focus();
      syncStReqClear();
    });
    syncStReqClear();
  }

  // ---------- Yapie 帮我写歌词（一次性回填进「自己输入」歌词框） ----------
  const writeBtn = $('#stWrite');
  let writing = false;

  function setWriteBtn(text, disabled) {
    writeBtn.textContent = text;
    writeBtn.disabled = !!disabled;
    writeBtn.style.opacity = disabled ? '.7' : '1';
    writeBtn.style.cursor = disabled ? 'default' : 'pointer';
  }

  async function writeLyrics() {
    if (writing) return;
    if (!getApiKey() && !(await ensureKey())) return;
    const theme = (promptBox.value || '').trim();
    if (!theme) {
      promptBox.focus();
      promptBox.style.borderColor = '#f43f5e';
      setTimeout(() => { promptBox.style.borderColor = '#fbcfe8'; }, 1400);
      return;
    }
    if ((lyricsBox.value || '').trim() && !confirm('歌词框已有内容，用 Yapie 写的歌词替换吗？')) return;
    writing = true;
    setWriteBtn('写词中…', true);
    setTab('self');   // 切到「自己输入」，让歌词回填可见
    lyricsBox.value = '';
    const lang = ($('#stLang') || {}).value || '中文';
    try {
      const { task_id } = await api.generateLyrics({ theme, style: '', lang });
      const r = await poll(() => api.lyricsStatus(task_id), {
        interval: 1500, done: (x) => ['done', 'failed'].includes(x.status),
      });
      if (r.status === 'done') { lyricsBox.value = r.lyrics || ''; lyricsBox.scrollTop = lyricsBox.scrollHeight; lyricsBox.focus(); }
      else { alert('⚠️ ' + (r.error || '写词失败，请重试')); }
    } catch (e) {
      alert('⚠️ ' + (e instanceof ApiError ? e.message : '网络错误，请重试'));
    } finally {
      writing = false;
      setWriteBtn('✨ 生成歌词', false);
    }
  }

  writeBtn.addEventListener('click', writeLyrics);
}
