// 轻量 DOM / 提示 / 播放器助手，无第三方依赖。

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null || c === false) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// 封面 / 音频走 AI Music 媒体代理：服务端代取媒体后回传，前端无需关心跨域/来源限制。
export function mediaUrl(u) {
  if (!u) return '';
  if (/^https?:\/\//.test(u)) {
    try { if (!new URL(u).hostname.endsWith('ai6666.com')) return u; } catch (e) { /* 非法 URL, 落到代理 */ }
  }
  let abs = u;
  if (u.startsWith('/')) abs = 'https://ai6666.com' + u;
  else if (!/^https?:\/\//.test(u)) return u;
  return '/api/ai-music/media?u=' + encodeURIComponent(abs);
}

let toastTimer = null;
export function toast(msg, type = 'info') {
  let box = document.getElementById('gm-toast');
  if (!box) {
    box = el('div', { id: 'gm-toast', class: 'gm-toast' });
    document.body.appendChild(box);
  }
  box.textContent = msg;
  box.className = 'gm-toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.className = 'gm-toast ' + type; }, 3200);
}

// 全局唯一的迷你播放器：同一时间只播一首
let currentAudio = null;
let currentBtn = null;
export function playToggle(url, btn) {
  if (!url) { toast('音频还没准备好', 'warn'); return; }
  if (currentAudio && currentBtn === btn) {
    if (currentAudio.paused) { currentAudio.play(); btn.textContent = '⏸ 暂停'; }
    else { currentAudio.pause(); btn.textContent = '▶ 播放'; }
    return;
  }
  if (currentAudio) { currentAudio.pause(); if (currentBtn) currentBtn.textContent = '▶ 播放'; }
  currentAudio = new Audio(url);
  currentBtn = btn;
  btn.textContent = '⏸ 暂停';
  currentAudio.play().catch(() => { toast('播放失败', 'error'); btn.textContent = '▶ 播放'; });
  currentAudio.onended = () => { btn.textContent = '▶ 播放'; };
}

export function fmtDuration(sec) {
  if (!sec && sec !== 0) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
