// 「生成音乐」—— 对齐主站 /music/create/ 页。
// 傻瓜模式(description) / 专业模式(lyrics) 的 UI + 点击行为照搬主站；数据源走 Claw800 AI Music 代理。
// gmw 两处有意保留与主站不同：
//   1) 自由模式(free)保留为顶部第三个 tab（2026-06-16 产品决策），不回退成主站的勾选框。
//   2) 点击生成后立即跳「我的音乐」展示正在生成占位。
// 其余傻瓜/专业内部交互与主站一致。
import { api, poll, ApiError, getApiKey } from './api.js?v=20260617-ai-music-payment-refresh';
import { ensureKey, openBuyCreditsModal } from './auth.js?v=20260617-ai-music-payment-refresh';
import { el, clear, toast, fmtDuration, mediaUrl } from './ui.js?v=20260617-ai-music-payment-refresh';
import { toggleGlobalSong } from './player.js?v=20260617-ai-music-payment-refresh';

// 风格标签库 — 逐字搬自 create.html 各 tagGroup 的 data-tag 集合（中文 label 对齐）。
const STYLE_GROUPS = {
  genre: [['Pop','流行'],['Rock','摇滚'],['Indie','独立'],['Alternative','另类'],['Electronic','电子'],['EDM','EDM'],['House','浩室'],['Techno','Techno'],['Trance','迷幻电子'],['Dubstep','Dubstep'],['Drum and Bass','鼓打贝斯'],['Hip-hop','嘻哈'],['Trap','Trap'],['R&B','R&B'],['Soul','灵魂'],['Funk','放克'],['Jazz','爵士'],['Smooth Jazz','平滑爵士'],['Bossa Nova','波萨诺瓦'],['Folk','民谣'],['Acoustic','原声'],['Country','乡村'],['Bluegrass','蓝草'],['Blues','蓝调'],['Classical','古典'],['Opera','歌剧'],['Orchestral','管弦乐'],['Metal','金属'],['Heavy Metal','重金属'],['Punk','朋克'],['Grunge','垃圾摇滚'],['Reggae','雷鬼'],['Ska','斯卡'],['Disco','迪斯科'],['Latin','拉丁'],['Reggaeton','雷鬼动'],['Flamenco','弗拉门戈'],['Afrobeat','非洲节拍'],['K-Pop','K-Pop'],['J-Pop','J-Pop'],['Chinese traditional','中国风'],['Ancient Chinese','古风'],['Lo-fi','Lo-fi'],['Synthwave','合成波'],['Vaporwave','蒸汽波'],['Cinematic','电影感'],['Ambient','氛围'],['New Age','新世纪'],['Psychedelic','迷幻'],['Progressive','前卫'],['Gospel','福音'],['Acapella','阿卡贝拉'],['Ballad','抒情'],['Musical','音乐剧'],['Lullaby','摇篮曲'],['Children','儿歌'],['Swing','摇摆'],['Waltz','华尔兹'],['Tango','探戈'],['City Pop','City Pop'],['Future Bass','Future Bass'],['Chillhop','Chillhop'],['Downtempo','缓拍'],['Phonk','Phonk'],['Hardstyle','Hardstyle'],['Dancehall','Dancehall'],['Drill','Drill'],['Grime','Grime'],['Shoegaze','盯鞋'],['Post-rock','后摇'],['Math rock','数学摇滚'],['Emo','Emo'],['Cumbia','昆比亚'],['Samba','桑巴'],['Salsa','萨尔萨'],['Trap Soul','Trap Soul'],['Garage','Garage'],['Industrial','工业'],['Noise','噪音'],['Meditation','冥想'],['Worship','赞美诗'],['Chiptune','8-bit'],['Game music','游戏音乐'],['Anime','动漫'],['Musical Theater','百老汇'],['March','进行曲']],
  mood: [['Upbeat','欢快'],['Happy','开心'],['Joyful','喜悦'],['Sad','悲伤'],['Melancholy','忧郁'],['Heartbroken','心碎'],['Gentle','温柔'],['Tender','柔情'],['Passionate','激昂'],['Aggressive','激烈'],['Angry','愤怒'],['Dreamy','梦幻'],['Ethereal','空灵'],['Chill','舒缓'],['Relaxing','放松'],['Peaceful','平和'],['Romantic','浪漫'],['Seductive','性感'],['Inspiring','励志'],['Motivational','鼓舞'],['Triumphant','凯旋'],['Nostalgic','怀旧'],['Bittersweet','苦甜'],['Dark','黑暗'],['Eerie','诡异'],['Suspenseful','悬疑'],['Epic','史诗'],['Mysterious','神秘'],['Playful','俏皮'],['Groovy','律动'],['Energetic','充满活力'],['Sentimental','感性'],['Hopeful','希望'],['Lonely','孤独'],['Anthemic','圣歌感'],['Intense','紧张'],['Atmospheric','氛围感'],['Catchy','洗脑'],['Wistful','惆怅'],['Fierce','凶猛'],['Serene','宁静'],['Euphoric','狂喜'],['Rebellious','叛逆'],['Empowering','力量感'],['Cinematic','电影感'],['Whimsical','奇幻'],['Haunting','萦绕'],['Melancholic','忧伤'],['Warm','温暖']],
  instrument: [['Piano','钢琴'],['Electric piano','电钢琴'],['Rhodes','Rhodes'],['Wurlitzer','Wurlitzer'],['Harpsichord','羽管键琴'],['Celesta','钢片琴'],['Clavinet','Clavinet'],['Acoustic guitar','原声吉他'],['Classical guitar','古典吉他'],['Nylon guitar','尼龙吉他'],['Twelve-string guitar','十二弦吉他'],['Resonator guitar','共鸣吉他'],['Pedal steel guitar','踏板钢吉他'],['Electric guitar','电吉他'],['Bass guitar','贝斯'],['Ukulele','尤克里里'],['Violin','小提琴'],['Viola','中提琴'],['Cello','大提琴'],['Double bass','低音提琴'],['String quartet','弦乐四重奏'],['Harp','竖琴'],['Flute','长笛'],['Piccolo','短笛'],['Recorder','竖笛'],['Pan flute','排箫'],['Bansuri','班苏里笛'],['Shakuhachi','尺八'],['Clarinet','单簧管'],['Bass clarinet','低音单簧管'],['Saxophone','萨克斯'],['Trumpet','小号'],['Trombone','长号'],['Tuba','大号'],['Euphonium','上低音号'],['Flugelhorn','富鲁格号'],['Harmonica','口琴'],['Accordion','手风琴'],['Synth','合成器'],['Analog synth','模拟合成器'],['FM synth','FM合成器'],['Synth pad','合成铺底'],['Synth lead','合成主音'],['Arpeggiator','琶音器'],['Pluck synth','拨奏合成器'],['Synth bass','合成贝斯'],['Sub bass','低频贝斯'],['Sampler','采样器'],['Drum machine','鼓机'],['808','808鼓机'],['Drums','鼓'],['Percussion','打击乐'],['Cajon','卡宏鼓'],['Congas','康加鼓'],['Bongos','邦戈鼓'],['Timbales','天巴鼓'],['Tambourine','铃鼓'],['Shaker','沙锤'],['Claps','拍手'],['Finger snaps','响指'],['Cowbell','牛铃'],['Triangle','三角铁'],['Handpan','手碟'],['Taiko','太鼓'],['Strings','弦乐'],['Brass','铜管'],['Organ','管风琴'],['Guzheng (Chinese zither)','古筝'],['Erhu (Chinese fiddle)','二胡'],['Pipa (Chinese lute)','琵琶'],['Guqin (seven-string zither)','古琴'],['Ruan (Chinese moon lute)','阮'],['Sanxian (three-string lute)','三弦'],['Dizi (Chinese bamboo flute)','笛子'],['Xiao (Chinese vertical flute)','箫'],['Suona (Chinese shawm)','唢呐'],['Sheng (Chinese mouth organ)','笙'],['Hulusi (gourd flute)','葫芦丝'],['Mongolian morin khuur horsehead fiddle','马头琴'],['Sitar','西塔琴'],['Banjo','班卓琴'],['Mandolin','曼陀林'],['Lute','鲁特琴'],['Oud','乌德琴'],['Bouzouki','布祖基'],['Koto','日本筝'],['Shamisen','三味线'],['Duduk','杜杜克'],['Kora','科拉琴'],['Music box','八音盒'],['Kalimba','拇指琴'],['Mbira','姆比拉'],['Marimba','马林巴'],['Vibraphone','颤音琴'],['Xylophone','木琴'],['Glockenspiel','钟琴'],['Church bells','教堂钟'],['Oboe','双簧管'],['English horn','英国管'],['Bassoon','大管'],['French horn','圆号'],['Timpani','定音鼓'],['Theremin','特雷门琴'],['Dulcimer','扬琴'],['Santoor','桑图尔'],['Gong','锣'],['Tabla','塔布拉鼓'],['Djembe','非洲鼓'],['Steel drum','钢鼓'],['Bagpipe','风笛'],['Didgeridoo','迪吉里杜管'],['Ocarina','陶笛'],['Turntable','打碟']],
  vocal: [['Male vocal','男声'],['Female vocal','女声'],['Soft vocal','温柔人声'],['Powerful vocal','有力人声'],['Breathy vocal','气声'],['Raspy vocal','沙哑人声'],['High-pitched vocal','高音'],['Deep vocal','低音'],['Falsetto','假声'],['Whisper','耳语'],['Rap','说唱'],['Chorus','合唱'],['Duet','对唱'],['Male and female duet','男女对唱'],['Child vocal','童声'],['Operatic vocal','美声'],['Vocal chops','人声采样'],['Autotune','Auto-Tune'],['Spoken word','朗诵'],['Humming','哼唱'],['Growl vocal','吼叫'],['Scream vocal','嘶吼'],['Yodel','约德尔'],['Beatbox','Beatbox'],['Vocal harmony','和声'],['Chanting','吟唱'],['Nasal vocal','鼻音'],['Smooth vocal','丝滑人声'],['Soulful vocal','灵魂人声']],
  tempo: [['Slow','慢速'],['Medium tempo','中速'],['Fast','快速'],['Very Fast','极速'],['Steady','稳定节奏'],['Changing Tempo','变速'],['Accelerating','渐快'],['Decelerating','渐慢'],['Rubato','自由节奏'],['Syncopated','切分节奏']],
};
const GROUP_LABEL = { genre: '🎼 流派', mood: '💭 情绪', instrument: '🎹 乐器', vocal: '🎤 人声', tempo: '⏱️ 速度' };

// 傻瓜模式简单风格预设 chips（数据源 = 主站 services.get_style_suggestion_presets；ai6api 无独立列表端点，
// 这里内嵌一份与主站口径一致的标签，点击后真正配风格仍走 AI Music 代理的 style-suggestion）。
const STYLE_PRESETS = [
  ['pop', '流行'], ['ballad', '抒情'], ['rock', '摇滚'], ['folk', '民谣'], ['electronic', '电子'],
  ['rnb', 'R&B'], ['hiphop', '嘻哈'], ['ancient', '古风'], ['chinese', '中国风'], ['city_pop', 'City Pop'],
  ['acoustic', '原声'], ['piano', '钢琴抒情'], ['cinematic', '电影感'], ['lofi', 'Lo-fi'], ['jazz', '爵士'],
  ['rap', '说唱'], ['edm', 'EDM'], ['country', '乡村'], ['metal', '摇滚金属'], ['kpop', 'K-Pop'],
  ['dreamy', '梦幻空灵'], ['epic', '史诗大气'], ['warm', '温暖治愈'], ['sad', '伤感'], ['upbeat', '欢快'],
  ['romantic', '浪漫'], ['nostalgic', '怀旧'], ['guzheng', '古筝中国风'], ['orchestral', '管弦乐'], ['synthwave', '合成波'],
];
const PRESET_VISIBLE = 20;

const RANDOM_THEMES = [
  '失恋后深夜一个人走在街上，想起再也回不去的人',
  '写给十年后的自己，温暖、有力量',
  '夏天海边，清爽又有点想念',
  '深夜加班回家，城市的霓虹与孤独',
  '母亲的白发，温柔的回忆',
  '毕业那天，青春散场的不舍',
  '雨夜咖啡馆，慵懒治愈的午后',
  '异乡打拼，想家又不肯认输',
];

// 运行时数据：进页先从 AI Music 代理 create-options 拉风格预设
// 和随机主题(约200，且带 style)。拉失败则用上面内嵌的小列表兜底。
let presets = STYLE_PRESETS.map(([key, label]) => ({ key, label, style: '' }));
let themes = RANDOM_THEMES.map((prompt) => ({ prompt, style: '', label: '', style_key: '' }));

function presetChipHtml(p, i) {
  const hide = i >= PRESET_VISIBLE;
  return `<button type="button" class="style-preset-chip${hide ? ' style-preset-extra' : ''}" data-style-key="${esc(p.key)}" data-style-label="${esc(p.label)}"
      style="${hide ? 'display:none;' : 'display:inline-flex;'}align-items:center;justify-content:center;padding:5px 11px;border-radius:999px;border:1px solid #fecdd3;background:#fff1f2;color:#be123c;font-size:12px;font-weight:800;cursor:pointer;">${esc(p.label)}</button>`;
}

const LANG_OPTIONS = [
  ['', '中文'], ['English', 'English'], ['日本語', '日本語'], ['한국어', '한국어'],
  ['Español', 'Español'], ['Русский', 'Русский'], ['粤语', '粤语'],
];

const LYRIC_TAGS = [['[Intro]','前奏'],['[Verse]','主歌'],['[Pre-Chorus]','预副歌'],['[Chorus]','副歌'],['[Bridge]','桥段'],['[Outro]','尾奏'],['[Interlude]','间奏']];

const DESC_PH_DEFAULT = '写这首歌想表达什么：写给谁、什么故事、什么情绪。\n例如：失恋后深夜一个人走在街上，想起再也回不去的人。';
const DESC_PH_INSTRUMENTAL = '想要什么氛围 / 场景 / 乐器（纯音乐无歌词）。\n例如：雨夜咖啡馆，慵懒的钢琴和萨克斯，舒缓治愈。';

// 专业模式「✨ 示例」一键填入的完整分段编曲示例（逐字搬自主站 PRO_REQ_EXAMPLE）
const PRO_REQ_EXAMPLE = [
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

const STORAGE_KEY = 'gm_music_draft';
const STUDIO_STYLE_DELIM = '===风格===';

// 模块级状态（每次 render 重置）
let state;

export function renderGenerate(root) {
  clear(root);
  state = {
    mode: 'description',
    styleControlMode: 'ai',   // 傻瓜=ai / 专业=manual
    styleModeUserSet: false,
    simpleSelectedStyleLabel: '',
    aiStyleSuggestion: null,
    polling: false,
    proArrangeBusy: false,
  };
  root.innerHTML = formHTML();
  wire(root);
  switchMode(root, 'description');
  loadDraft(root);
  refreshCredits(root);
  bindCreditsChangedListener(root);
  applyRemakeHandoff(root);
  bindRemakeHandoffListener();
  bindStudioHandoffListener();
  applyStudioHandoff(root);
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function formHTML() {
  const tagGroups = Object.keys(STYLE_GROUPS).map((g) => `
      <button type="button" class="tag-group-toggle" data-group="${g}" style="padding:4px 12px;font-size:12px;font-weight:700;border-radius:999px;border:1px solid #e5e7eb;background:#fff;color:#6b7280;cursor:pointer;">${GROUP_LABEL[g]}</button>`).join('');
  const tagPanels = Object.keys(STYLE_GROUPS).map((g) => `
    <div class="tag-group" data-group-panel="${g}" style="display:none;margin-top:8px;padding:10px;background:#f9fafb;border-radius:12px;">
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${STYLE_GROUPS[g].map(([t, zh]) => `<button type="button" data-tag="${esc(t)}" class="tag-btn px-2.5 py-1 text-xs border border-gray-200 rounded-full transition" style="background:#fff;">${esc(zh)}</button>`).join('')}
      </div>
    </div>`).join('');
  const presetChips = presets.map(presetChipHtml).join('');

  return `<div class="gm-head"><h2>生成音乐</h2><div class="gm-head-actions"><span class="gm-free-credit-note">每个用户免费赠送1次</span><span class="gm-credits" id="cf-credits">剩余次数 …</span><button type="button" class="gm-btn-ghost sm" id="cf-recharge">充值</button></div></div>
  <div class="cf-scope">
   <div class="cf-card">
    <div class="mode-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <div class="mode-switch">
        <button type="button" data-mode="description" class="mode-tab px-5 py-2 rounded-lg font-bold text-sm text-white" style="background:linear-gradient(135deg,#f43f5e 0%,#ec4899 50%,#f97316 100%);box-shadow:0 4px 12px -2px rgba(236,72,153,0.4);">傻瓜模式</button>
        <button type="button" data-mode="free" class="mode-tab px-5 py-2 rounded-lg font-bold text-sm text-gray-500">🎲 自由模式</button>
        <button type="button" data-mode="lyrics" class="mode-tab px-5 py-2 rounded-lg font-bold text-sm text-gray-500">专业模式</button>
      </div>
    </div>

    <div data-panel="description">
      <div class="rounded-xl border border-gray-200 overflow-hidden relative" style="position:relative;">
        <button type="button" id="randomThemeBtn" style="position:absolute;right:10px;top:8px;z-index:2;display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 10px;border-radius:999px;border:1px solid #fecdd3;background:#fff;color:#be123c;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 6px 16px -12px rgba(190,18,60,0.6);">随机主题</button>
        <textarea id="descBox" rows="5" maxlength="500" class="w-full px-4 pt-3 pb-3 outline-none font-mono text-sm leading-relaxed resize-none" style="border:none;padding-right:92px;" placeholder="${esc(DESC_PH_DEFAULT)}"></textarea>
        <button type="button" class="hh-clear-btn" data-clear="descBox" title="清空">✕ 清空</button>
      </div>
    </div>

    <div data-panel="lyrics" class="hidden" style="display:none;">
      <div id="proArrangeBlock" style="display:none;margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 6px 2px;">
          <span style="font-size:15px;font-weight:900;color:#111827;">歌曲要求<span style="font-weight:600;color:#9ca3af;">（选填）</span></span>
          <button type="button" id="proDocsBtn" style="display:inline-flex;align-items:center;gap:3px;border:0;background:transparent;padding:0;font-size:12px;font-weight:800;color:#6d28d9;text-decoration:none;cursor:pointer;">📖 文档</button>
        </div>
        <div style="position:relative;">
          <textarea id="proReqBox" rows="5" class="w-full px-4 pt-3 pb-3 rounded-xl border border-gray-200 outline-none font-mono text-sm leading-relaxed resize-none" style="overflow:hidden;padding-right:84px;" placeholder="想要什么风格、什么感觉？比如：古风、治愈、副歌更带劲。可不填。"></textarea>
          <button type="button" class="hh-clear-btn" data-clear="proReqBox" title="清空">✕ 清空</button>
          <button type="button" id="proReqExampleBtn" title="填入一段完整的分段编曲示例" style="position:absolute;left:10px;bottom:8px;z-index:3;display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:999px;border:1px solid #fecdd3;background:rgba(255,255,255,0.92);color:#be123c;font-size:11px;font-weight:800;cursor:pointer;">✨ 示例</button>
        </div>
        <div id="proArrangeNotice" style="display:none;margin-top:10px;padding:9px 11px;border-radius:12px;font-size:12px;font-weight:700;"></div>
      </div>
      <div id="proSubRow" style="display:none;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:15px;font-weight:900;color:#111827;">歌词</span>
          <button type="button" class="hh-help-btn" aria-label="什么是专业模式" data-help="专业模式：自己写歌词，或让 Yapie 写；再用风格标签精确控制曲风。点「✨ 最优风格推荐」可生成逐句结构化歌词 + 最优风格。" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;border:1px solid #fde68a;background:#fffbeb;color:#b45309;font-size:11px;font-weight:900;line-height:1;cursor:pointer;flex-shrink:0;">?</button>
        </div>
      </div>
      <div class="relative" style="position:relative;">
        <button type="button" id="openAiLyricsBtn" style="position:absolute;right:10px;top:10px;z-index:2;display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 11px;border-radius:999px;border:1px solid #fecdd3;background:#fff;color:#be123c;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 6px 16px -12px rgba(190,18,60,0.6);">✨ AI 写歌词</button>
        <textarea id="lyricsBox" rows="6" maxlength="4500" class="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none font-mono text-sm leading-relaxed" style="padding-right:112px;padding-bottom:44px;" placeholder="在这里写下你的歌词，一句一行就行。"></textarea>
        <button type="button" class="hh-clear-btn" data-clear="lyricsBox" title="清空">✕ 清空</button>
        <div id="lyricTagRow" style="position:absolute;left:10px;right:74px;bottom:8px;z-index:3;display:flex;align-items:center;gap:5px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;">
          ${LYRIC_TAGS.map(([tag, zh]) => `<button type="button" class="hh-lyric-tag" data-tag="${esc(tag)}">${esc(zh)}</button>`).join('')}
        </div>
      </div>
    </div>

    <div data-panel="free" class="hidden" style="display:none;">
      <div style="position:relative;">
        <textarea id="freeBox" rows="5" maxlength="500" class="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none font-mono text-sm leading-relaxed" style="padding-right:84px;" placeholder="写出你想要的歌，语言、风格、乐器、节奏全凭你写。例如：&#10;一首忧伤的钢琴慢歌，关于失去童年，女声，70拍"></textarea>
        <button type="button" class="hh-clear-btn" data-clear="freeBox" title="清空">✕ 清空</button>
      </div>
    </div>

    <div id="moreSettings" style="margin-top:10px;display:flex;flex-direction:column;">
      <div id="langInstrRow" style="display:flex;align-items:center;gap:8px;margin:8px 0 4px;flex-wrap:wrap;">
        <button type="button" id="advSettingsBtn" style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;font-size:12px;font-weight:600;border-radius:999px;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;">⚙ 高级设置</button>
        <label style="font-size:12px;color:#6b7280;font-weight:600;">语言</label>
        <select id="singLangSelect" style="padding:4px 28px 4px 12px;font-size:12px;font-weight:600;border-radius:999px;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;outline:none;">
          ${LANG_OPTIONS.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}
        </select>
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#4b5563;cursor:pointer;padding:4px 10px;border-radius:999px;background:#f9fafb;border:1px solid #e5e7eb;">
          <input type="checkbox" id="cf-instrumental"><span>纯音乐</span>
        </label>
      </div>

      <button type="button" id="styleToggleBtn" style="display:none;align-self:flex-start;align-items:center;gap:5px;margin-top:8px;padding:6px 14px;border-radius:999px;border:1px solid #fecdd3;background:#fff1f2;color:#be123c;font-size:12.5px;font-weight:800;cursor:pointer;">
        🎨 风格 · <span id="styleToggleName">AI 已配好（可改）</span>
        <svg id="styleToggleArrow" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="transition:transform .2s;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </button>

      <div id="styleSettingBlock" style="margin-top:6px;">
        <label class="block text-sm font-semibold text-gray-700 mb-2" style="display:block;font-weight:600;color:#374151;margin-bottom:8px;">风格</label>
        <div id="proBestStyleRow" style="display:none;margin-bottom:10px;">
          <button type="button" id="proBestStyleBtn" style="display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:9px 16px;border-radius:999px;border:0;color:#fff;background:linear-gradient(135deg,#7c3aed,#ec4899,#f97316);font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 10px 22px -14px rgba(236,72,153,.8);">✨ 最优风格推荐</button>
          <span style="margin-left:10px;font-size:12px;color:#9ca3af;font-weight:600;vertical-align:middle;">或自己下面挑</span>
        </div>

        <div id="styleAiPanel" style="box-sizing:border-box;padding:11px 12px;border:1px solid #fecdd3;background:linear-gradient(135deg,#fff1f2,#fff7ed);border-radius:14px;margin-bottom:10px;">
          <div id="simpleStylePresets" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            ${presetChips}
            <button type="button" id="stylePresetMoreBtn" style="display:inline-flex;align-items:center;justify-content:center;padding:5px 11px;border-radius:999px;border:1px dashed #c4b5fd;background:#f5f3ff;color:#6d28d9;font-size:12px;font-weight:900;cursor:pointer;">更多 ↓</button>
          </div>
        </div>

        <div id="styleManualPanel" style="display:none;box-sizing:border-box;">
          <div style="display:flex;flex-wrap:wrap;gap:6px;">${tagGroups}</div>
          ${tagPanels}
        </div>

        <div style="position:relative;margin-top:12px;">
          <textarea name="style" id="styleInput" rows="2" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm" style="resize:none;line-height:1.5;min-height:62px;padding-right:60px;" placeholder="点上方标签也可以输入你想要的风格，越简单越好，每个要求用逗号,隔开。"></textarea>
          <button type="button" class="hh-clear-btn" data-clear="styleInput" title="清空">✕ 清空</button>
        </div>
      </div>

      <div id="titleSettingBlock" style="margin-top:12px;">
        <label for="titleInput" class="block text-sm font-semibold text-gray-700 mb-2" style="display:block;font-weight:600;color:#374151;margin-bottom:8px;">🎵 歌曲标题（可选）</label>
        <input type="text" id="titleInput" maxlength="80" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm" placeholder="留空则由 AI 自动起名">
      </div>
    </div>

    <div id="submitSection" class="pt-3 border-t border-gray-100" style="margin-top:14px;padding-top:14px;border-top:1px solid #f3f4f6;">
      <button type="button" id="submitBtn" class="w-full py-4 rounded-xl font-bold text-base text-white transition-all bg-gradient-to-r from-rose-500 via-pink-500 to-orange-500 hover:from-rose-600" style="background-image:linear-gradient(to right,#f43f5e 0%,#ec4899 50%,#f97316 100%);box-shadow:0 10px 15px -3px rgba(0,0,0,.1);cursor:pointer;border:0;">🎵 生成音乐（消耗 1 次，产出 2 首）</button>
    </div>
   </div>
   <div id="gm-gen-result"></div>
  </div>

  <div id="advSettingsModal" style="display:none;position:fixed;inset:0;z-index:1300;background:rgba(17,24,39,.45);align-items:center;justify-content:center;padding:16px;">
    <div style="background:#fff;border-radius:14px;width:min(380px,92vw);padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.25);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><span style="font-size:15px;font-weight:700;color:#111827;">高级设置</span><button type="button" id="advSettingsClose" style="border:none;background:none;font-size:18px;color:#9ca3af;cursor:pointer;">✕</button></div>
      <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;cursor:pointer;"><input type="checkbox" id="advShortenIntro" style="margin-top:3px;"><span><span style="font-size:14px;font-weight:600;color:#1f2937;">缩短前奏</span><br><span style="font-size:12px;color:#9ca3af;">去掉歌词开头的前奏/器乐段，更快进入人声</span></span></label>
      <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;cursor:pointer;border-top:1px solid #f1f2f5;"><input type="checkbox" id="advBoostVocal" style="margin-top:3px;"><span><span style="font-size:14px;font-weight:600;color:#1f2937;">调大人声</span><br><span style="font-size:12px;color:#9ca3af;">让人声更突出、更靠前</span></span></label>
      <button type="button" id="advSettingsDone" style="margin-top:14px;width:100%;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#f43f5e,#ec4899);color:#fff;font-size:14px;font-weight:700;cursor:pointer;">完成</button>
    </div>
  </div>

  <div id="proDocsModal" style="display:none;position:fixed;inset:0;z-index:10000;background:rgba(17,24,39,.5);align-items:center;justify-content:center;padding:16px;">
    <div class="gm-pro-docs-card" style="background:#fff;border-radius:16px;width:min(560px,94vw);max-height:88vh;overflow:auto;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.25);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
        <div>
          <div style="font-size:16px;font-weight:950;color:#111827;">AI音乐提示词文档</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px;">专业模式常用写法，直接在本页参考，不会跳转离开。</div>
        </div>
        <button type="button" id="proDocsModalClose" aria-label="关闭" style="border:none;background:none;font-size:20px;color:#9ca3af;cursor:pointer;line-height:1;">✕</button>
      </div>
      <div class="gm-pro-docs-body">
        <section>
          <h3>字段怎么填</h3>
          <p><strong>歌曲要求</strong>写整体方向：曲风、情绪、主乐器、人声、速度、制作质感。这里不要写整首歌词。</p>
          <p><strong>歌词框</strong>只放歌词、结构标签和段落控制。结构越清楚，副歌和段落越稳定。</p>
          <p><strong>风格</strong>用英文标签并用逗号隔开，例如：<code>Mandarin pop ballad, female vocal, piano, strings, slow tempo</code></p>
        </section>
        <section>
          <h3>常用结构标签</h3>
          <div class="gm-pro-docs-tags">
            <code>[Intro]</code><code>[Verse]</code><code>[Pre-Chorus]</code><code>[Chorus]</code><code>[Bridge]</code><code>[Interlude]</code><code>[Outro]</code><code>[End]</code>
          </div>
          <p>结构标签单独一行。段落唱法或乐器提示可以写在下一行括号里，例如：<code>(soft female vocal, piano only)</code></p>
        </section>
        <section>
          <h3>人声控制</h3>
          <p>整首歌的人声放到风格里：<code>male vocal</code>、<code>female vocal</code>、<code>male and female duet</code>。</p>
          <p>某一段切换人声，可以在歌词里写：<code>[Male Vocal]</code>、<code>[Female Vocal]</code>、<code>[Duet]</code>。</p>
        </section>
        <section>
          <h3>可复制示例</h3>
          <pre>[Verse 1]
(soft male vocal, close-mic)
我把没寄出的信
放回旧抽屉

[Chorus]
[Duet]
(male and female duet, warm vocal harmony)
如果风会替我们说晚安
别让爱散在天亮以前</pre>
        </section>
        <section>
          <h3>提交前检查</h3>
          <p>先确定整体风格，再写歌词结构。不要只写“高级、爆款、好听”，尽量给出具体音乐细节：曲风、人声、情绪、乐器、速度。</p>
        </section>
      </div>
    </div>
  </div>

  <div id="aiLyricsModal" style="display:none;position:fixed;inset:0;z-index:10000;background:rgba(17,24,39,.5);align-items:center;justify-content:center;padding:16px;">
    <div style="background:#fff;border-radius:16px;width:min(480px,94vw);max-height:88vh;overflow:auto;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.25);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><span style="font-size:16px;font-weight:900;color:#111827;">✨ 让 AI 帮你写歌词</span><button type="button" id="aiLyricsModalClose" aria-label="关闭" style="border:none;background:none;font-size:20px;color:#9ca3af;cursor:pointer;line-height:1;">✕</button></div>
      <div style="font-size:12px;color:#9ca3af;margin-bottom:10px;line-height:1.5;">告诉 Yapie 你想写一首什么样的歌，生成后点「用这份歌词」会填进歌词框，你还能接着改。</div>
      <textarea id="proAiLyricsInput" rows="4" maxlength="500" class="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none font-mono text-sm leading-relaxed" style="resize:vertical;" placeholder="例如：写给十年好友的婚礼，温暖、有画面感，副歌能合唱。"></textarea>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;">
        <button type="button" id="proAiLyricsSendBtn" style="display:inline-flex;align-items:center;justify-content:center;padding:9px 15px;border-radius:999px;border:0;color:#fff;background:linear-gradient(135deg,#f43f5e,#ec4899,#f97316);font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 10px 22px -14px rgba(236,72,153,.8);">让 Yapie 写歌词</button>
        <span style="font-size:11px;color:#9ca3af;font-weight:600;">每次约 10-30 秒 · 生成后可继续编辑</span>
      </div>
      <div id="proAiLyricsNotice" style="display:none;margin-top:10px;padding:9px 11px;border-radius:12px;font-size:12px;font-weight:700;"></div>
      <div id="proAiLyricsResults" style="margin-top:10px;"></div>
    </div>
  </div>`;
}

function $(root, sel) { return root.querySelector(sel); }
const _langName = (v) => (LANG_OPTIONS.find(([val]) => val === v) || [])[1] || '中文';

function wire(root) {
  $(root, '#cf-recharge')?.addEventListener('click', () => openBuyCreditsModal());
  // 模式切换
  root.querySelectorAll('.mode-tab').forEach((b) => b.addEventListener('click', () => {
    switchMode(root, b.dataset.mode); saveDraft(root);
    setTimeout(() => getModeFocusBox(root).focus(), 50);
  }));

  // 清空按钮（有内容才显示）
  root.querySelectorAll('.hh-clear-btn').forEach((b) => {
    const t = $(root, '#' + b.dataset.clear);
    if (!t) return;
    t.addEventListener('input', () => b.classList.toggle('is-visible', !!t.value.trim()));
    b.addEventListener('click', () => { t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); b.classList.remove('is-visible'); });
  });
  syncAllClearBtns(root);

  // 随机主题（避重 + 撑高 + 存草稿）
  $(root, '#randomThemeBtn').addEventListener('click', () => fillRandomTheme(root));

  // 歌词段落标签插入
  root.querySelectorAll('.hh-lyric-tag').forEach((b) => b.addEventListener('click', () => { insertAtCursor($(root, '#lyricsBox'), b.dataset.tag); }));

  // 风格标签组手风琴（点一组关其余 + 高亮）
  root.querySelectorAll('.tag-group-toggle').forEach((b) => b.addEventListener('click', () => toggleTagGroup(root, b.dataset.group)));
  // 风格标签选择
  root.querySelectorAll('.tag-btn').forEach((b) => b.addEventListener('click', () => toggleStyleTag(root, b)));
  // 风格文本框 ↔ 标签反向同步
  $(root, '#styleInput').addEventListener('input', () => { syncTagButtons(root); autoGrowStyle(root); saveDraft(root); });

  // 傻瓜模式简单风格预设 chip（先用内嵌兜底渲染，再异步拉全量同源列表替换）
  root.querySelectorAll('.style-preset-chip').forEach((b) => b.addEventListener('click', () => pickStylePreset(root, b)));
  $(root, '#stylePresetMoreBtn').addEventListener('click', () => expandPresets(root));
  loadCreateOptions(root);

  // 傻瓜模式「🎨 风格 ▾」折叠按钮
  $(root, '#styleToggleBtn').addEventListener('click', () => {
    const blk = $(root, '#styleSettingBlock'), arrow = $(root, '#styleToggleArrow');
    const open = blk.style.display !== 'none';
    blk.style.display = open ? 'none' : '';
    arrow.style.transform = open ? '' : 'rotate(180deg)';
  });

  // 纯音乐勾选联动 placeholder
  const instr = $(root, '#cf-instrumental');
  instr.addEventListener('change', () => syncDescPlaceholder(root));

  // 语言切换 → 专业模式翻译确认
  $(root, '#singLangSelect').addEventListener('change', (e) => onLangChange(root, e.target.value));

  // 高级设置弹窗
  const modal = $(root, '#advSettingsModal');
  $(root, '#advSettingsBtn').addEventListener('click', () => { modal.style.display = 'flex'; });
  $(root, '#advSettingsClose').addEventListener('click', () => { modal.style.display = 'none'; });
  $(root, '#advSettingsDone').addEventListener('click', () => { syncAdvBtn(root); modal.style.display = 'none'; });
  modal.addEventListener('click', (e) => { if (e.target === modal) { syncAdvBtn(root); modal.style.display = 'none'; } });
  $(root, '#advShortenIntro').addEventListener('change', () => syncAdvBtn(root));
  $(root, '#advBoostVocal').addEventListener('change', () => syncAdvBtn(root));

  // 专业模式文档：站内弹窗展示，避免跳转到上游页面。
  const docsModal = $(root, '#proDocsModal');
  $(root, '#proDocsBtn').addEventListener('click', () => { docsModal.style.display = 'flex'; });
  $(root, '#proDocsModalClose').addEventListener('click', () => { docsModal.style.display = 'none'; });
  docsModal.addEventListener('click', (e) => { if (e.target === docsModal) docsModal.style.display = 'none'; });

  // 专业模式「✨ 示例」
  $(root, '#proReqExampleBtn').addEventListener('click', () => {
    const box = $(root, '#proReqBox');
    if (box.value.trim() && !confirm('当前歌曲要求框已有内容，用示例替换吗？')) return;
    box.value = PRO_REQ_EXAMPLE; box.focus(); box.setSelectionRange(0, 0); box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // proReqBox auto-grow
  $(root, '#proReqBox').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; });

  // 专业模式「最优风格推荐」
  $(root, '#proBestStyleBtn').addEventListener('click', () => runProArrange(root));

  // AI 写歌词弹窗
  $(root, '#openAiLyricsBtn').addEventListener('click', () => openAiLyricsModal(root));
  $(root, '#aiLyricsModalClose').addEventListener('click', () => { $(root, '#aiLyricsModal').style.display = 'none'; });
  const aiModal = $(root, '#aiLyricsModal');
  aiModal.addEventListener('click', (e) => { if (e.target === aiModal) aiModal.style.display = 'none'; });
  $(root, '#proAiLyricsSendBtn').addEventListener('click', () => sendAiLyrics(root));
  $(root, '#proAiLyricsInput').addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); sendAiLyrics(root); } });

  // descBox auto-grow + ≥480 toast
  const descBox = $(root, '#descBox');
  let descWarn = false;
  descBox.addEventListener('input', function () {
    this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px';
    if (this.value.length >= 480 && !descWarn) { descWarn = true; toast('描述快到 500 字上限了（当前 ' + this.value.length + ' 字）', 'warn'); setTimeout(() => { descWarn = false; }, 5000); }
  });

  // 草稿持久化：输入即存
  ['#titleInput', '#descBox', '#lyricsBox', '#proReqBox', '#freeBox', '#styleInput', '#cf-instrumental'].forEach((sel) => {
    const e = $(root, sel); if (!e) return;
    e.addEventListener('input', () => queueSaveDraft(root));
    e.addEventListener('change', () => saveDraft(root));
  });

  // 通用 ? 帮助气泡
  wireHelpBubbles(root);

  // 提交
  $(root, '#submitBtn').addEventListener('click', () => submitGenerate(root));
}

// ---------- 帮助气泡 ----------
function wireHelpBubbles(root) {
  let pop = null;
  const close = () => { if (pop) { pop.remove(); pop = null; } };
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.hh-help-btn');
    if (btn) {
      e.preventDefault();
      if (pop && pop._owner === btn) { close(); return; }
      close();
      pop = document.createElement('div');
      pop._owner = btn;
      pop.textContent = btn.getAttribute('data-help') || '';
      pop.style.cssText = 'position:absolute;z-index:1400;max-width:min(280px,86vw);padding:10px 12px;background:#312e81;color:#fff;border-radius:10px;font-size:12px;line-height:1.65;box-shadow:0 10px 30px -8px rgba(0,0,0,.45);';
      document.body.appendChild(pop);
      const r = btn.getBoundingClientRect();
      let left = window.scrollX + r.left;
      const maxLeft = window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 10;
      if (left > maxLeft) left = maxLeft;
      if (left < 8) left = 8;
      pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
      pop.style.left = left + 'px';
      return;
    }
    if (pop && !pop.contains(e.target)) close();
  });
}

// ---------- 模式切换 ----------
function switchMode(root, mode) {
  state.mode = mode;
  const simpleMode = mode === 'description';
  // tab 高亮（自由模式高亮自己；傻瓜/专业各自）
  root.querySelectorAll('.mode-tab').forEach((b) => {
    const active = b.dataset.mode === mode;
    if (active) { b.style.background = 'linear-gradient(135deg,#f43f5e 0%,#ec4899 50%,#f97316 100%)'; b.style.boxShadow = '0 4px 12px -2px rgba(236,72,153,0.4)'; b.classList.add('text-white'); b.classList.remove('text-gray-500'); }
    else { b.style.background = ''; b.style.boxShadow = ''; b.classList.remove('text-white'); b.classList.add('text-gray-500'); }
  });
  // panel 显隐
  root.querySelectorAll('[data-panel]').forEach((p) => { p.style.display = p.dataset.panel === mode ? 'block' : 'none'; });

  // 专业模式才显示「歌词」子行 + 「歌曲要求 + 最优风格推荐」
  $(root, '#proSubRow').style.display = mode === 'lyrics' ? 'flex' : 'none';
  // 自由模式：风格区/标题/语言行整体隐藏（语言/风格/标题写进正文）
  $(root, '#moreSettings').style.display = mode === 'free' ? 'none' : 'flex';

  // 傻瓜模式：露出折叠按钮 + 默认收起风格块；专业模式：无折叠按钮、风格块常展开
  const styleToggle = $(root, '#styleToggleBtn'), styleBlk = $(root, '#styleSettingBlock'), styleArrow = $(root, '#styleToggleArrow');
  if (simpleMode) { styleToggle.style.display = 'inline-flex'; styleBlk.style.display = 'none'; styleArrow.style.transform = ''; }
  else { styleToggle.style.display = 'none'; styleBlk.style.display = ''; }

  // 标题：傻瓜模式隐藏（走 AI 自动起名）
  $(root, '#titleSettingBlock').style.display = simpleMode ? 'none' : '';
  // 高级设置：傻瓜模式隐藏入口（提交也不带 shorten/boost）
  $(root, '#advSettingsBtn').style.display = simpleMode ? 'none' : 'inline-flex';

  // 风格档：傻瓜恒 AI 选（presets + AI 配风格）；专业恒 自己选（标签 + 文本框）
  if (mode === 'description') setStyleControlMode(root, 'ai');
  else if (mode === 'lyrics') setStyleControlMode(root, 'manual');

  // 专业模式才显示「歌曲要求 + 最优风格推荐」，并改 style 框 placeholder
  updateProArrangeVisibility(root);
}

function getModeBox(root) {
  if (state.mode === 'lyrics') return $(root, '#lyricsBox');
  if (state.mode === 'free') return $(root, '#freeBox');
  return $(root, '#descBox');
}
function getModeFocusBox(root) { return getModeBox(root); }

function setStyleControlMode(root, mode) {
  state.styleControlMode = mode === 'manual' ? 'manual' : 'ai';
  $(root, '#styleAiPanel').style.display = state.styleControlMode === 'ai' ? '' : 'none';
  $(root, '#styleManualPanel').style.display = state.styleControlMode === 'manual' ? '' : 'none';
  if (state.styleControlMode === 'manual') { syncTagButtons(root); autoGrowStyle(root); }
}

function updateProArrangeVisibility(root) {
  const show = state.mode === 'lyrics';
  $(root, '#proArrangeBlock').style.display = show ? '' : 'none';
  $(root, '#proBestStyleRow').style.display = show ? '' : 'none';
  $(root, '#styleInput').placeholder = show
    ? '从上方选择风格或点击最优风格推荐'
    : '点上方标签也可以输入你想要的风格，越简单越好，每个要求用逗号,隔开。';
}

// ---------- 风格预设 chip（傻瓜模式 AI 配风格）----------
function pickStylePreset(root, btn) {
  state.simpleSelectedStyleLabel = btn.dataset.styleLabel || '';
  // 高亮被点 chip，复位其余
  root.querySelectorAll('.style-preset-chip').forEach((x) => { x.style.background = '#fff1f2'; x.style.color = '#be123c'; x.style.borderColor = '#fecdd3'; });
  btn.style.background = 'linear-gradient(135deg,#f43f5e,#ec4899,#f97316)'; btn.style.color = '#fff'; btn.style.borderColor = '#f43f5e';
  requestStyleSuggestion(root, btn.dataset.styleLabel || '', btn.dataset.styleKey || '');
}

async function requestStyleSuggestion(root, label, key) {
  const prompt = ($(root, '#descBox')?.value || '').trim();
  try {
    const data = await api.styleSuggestion({ prompt, label, key });
    if (data && data.ok && data.style) applyStyleSuggestion(root, data);
  } catch { /* 静默：配风格失败不阻塞，提交时后端会兜底 */ }
}

function applyStyleSuggestion(root, sug) {
  state.aiStyleSuggestion = { key: sug.key || '', label: sug.label || '', style: sug.style || '' };
  const toggleName = $(root, '#styleToggleName');
  if (toggleName) toggleName.textContent = sug.label || 'AI 已配好（可改）';
  saveDraft(root);
}

function expandPresets(root) {
  const btn = $(root, '#stylePresetMoreBtn');
  const extras = [].slice.call(root.querySelectorAll('.style-preset-extra'));
  if (!extras.length) return;
  const hidden = extras.filter((e) => e.style.display === 'none');
  if (!hidden.length) { extras.forEach((e) => { e.style.display = 'none'; }); btn.textContent = '更多 ↓'; return; }
  const BATCH = 20;
  hidden.slice(0, BATCH).forEach((e) => { e.style.display = 'inline-flex'; });
  const remain = hidden.length - Math.min(BATCH, hidden.length);
  btn.textContent = remain > 0 ? ('继续展开（还剩 ' + remain + '）↓') : '收起 ↑';
}

// 进页拉取与主站同源的风格预设/随机主题, 替换内嵌兜底并重渲染 chip。
async function loadCreateOptions(root) {
  try {
    const o = await api.createOptions();
    if (Array.isArray(o.style_suggestion_presets) && o.style_suggestion_presets.length) {
      presets = o.style_suggestion_presets.map((p) => ({ key: p.key || '', label: p.label || '', style: p.style || '' }));
      rebuildPresetChips(root);
    }
    if (Array.isArray(o.random_theme_prompts) && o.random_theme_prompts.length) {
      themes = o.random_theme_prompts.map((t) => ({ prompt: t.prompt || '', style: t.style || '', label: t.label || '', style_key: t.style_key || '' }));
    }
  } catch (e) { /* 离线/失败 → 用内嵌兜底 */ }
}

function rebuildPresetChips(root) {
  const box = $(root, '#simpleStylePresets');
  const moreBtn = $(root, '#stylePresetMoreBtn');
  if (!box || !moreBtn) return;
  box.querySelectorAll('.style-preset-chip').forEach((c) => c.remove());
  moreBtn.insertAdjacentHTML('beforebegin', presets.map(presetChipHtml).join(''));
  box.querySelectorAll('.style-preset-chip').forEach((b) => b.addEventListener('click', () => pickStylePreset(root, b)));
  moreBtn.style.display = presets.length > PRESET_VISIBLE ? 'inline-flex' : 'none';
  moreBtn.textContent = '更多 ↓';
}

// ---------- 风格标签手风琴 ----------
function toggleTagGroup(root, name) {
  const panel = root.querySelector(`[data-group-panel="${name}"]`);
  if (!panel) return;
  const wasOpen = panel.style.display !== 'none';
  root.querySelectorAll('.tag-group').forEach((g) => { g.style.display = 'none'; });
  root.querySelectorAll('.tag-group-toggle').forEach((b) => { b.style.background = '#fff'; b.style.color = '#6b7280'; b.style.borderColor = '#e5e7eb'; });
  if (!wasOpen) {
    panel.style.display = 'block';
    const btn = root.querySelector(`.tag-group-toggle[data-group="${name}"]`);
    if (btn) { btn.style.background = '#fff1f2'; btn.style.color = '#be123c'; btn.style.borderColor = '#fda4af'; }
  }
}

function parseStyleParts(raw) { return (raw || '').split(',').map((x) => x.trim()).filter(Boolean); }

function toggleStyleTag(root, btn) {
  const input = $(root, '#styleInput');
  const tag = btn.dataset.tag, key = tag.toLowerCase();
  let parts = parseStyleParts(input.value);
  if (parts.some((x) => x.toLowerCase() === key)) parts = parts.filter((x) => x.toLowerCase() !== key);
  else parts.push(tag);
  input.value = parts.join(', ');
  syncTagButtons(root); autoGrowStyle(root); saveDraft(root);
}

function syncTagButtons(root) {
  const selected = {};
  parseStyleParts($(root, '#styleInput').value).forEach((x) => { selected[x.toLowerCase()] = true; });
  root.querySelectorAll('.tag-btn').forEach((b) => { b.classList.toggle('tag-selected', !!selected[(b.dataset.tag || '').toLowerCase()]); });
}

function autoGrowStyle(root) {
  const ta = $(root, '#styleInput');
  ta.style.height = 'auto';
  ta.style.height = Math.max(62, ta.scrollHeight) + 'px';
}

// ---------- 高级设置按钮状态 ----------
function syncAdvBtn(root) {
  const btn = $(root, '#advSettingsBtn');
  const on = $(root, '#advShortenIntro').checked || $(root, '#advBoostVocal').checked;
  btn.style.borderColor = on ? '#f43f5e' : '#e5e7eb';
  btn.style.color = on ? '#be123c' : '#374151';
}

// ---------- 清空按钮显隐 ----------
function syncAllClearBtns(root) {
  root.querySelectorAll('.hh-clear-btn').forEach((btn) => {
    const t = $(root, '#' + btn.dataset.clear);
    if (t) btn.classList.toggle('is-visible', !!t.value.trim());
  });
}

// ---------- 纯音乐 placeholder 联动 ----------
function syncDescPlaceholder(root) {
  const descBox = $(root, '#descBox'), instr = $(root, '#cf-instrumental');
  descBox.placeholder = instr.checked ? DESC_PH_INSTRUMENTAL : DESC_PH_DEFAULT;
}

// ---------- 随机主题（避重）----------
function fillRandomTheme(root) {
  const descBox = $(root, '#descBox');
  const cur = descBox.value.trim();
  let t = themes[Math.floor(Math.random() * themes.length)], guard = 0;
  while ((t.prompt || '') === cur && guard < 6) { t = themes[Math.floor(Math.random() * themes.length)]; guard++; }
  descBox.value = t.prompt || '';
  descBox.dispatchEvent(new Event('input', { bubbles: true }));
  // 主站: 主题自带 style 且傻瓜模式(风格档=AI) → 顺手把 AI 风格也配上
  if (t.style && state.mode === 'description') applyStyleSuggestion(root, { key: t.style_key, label: t.label, style: t.style });
  descBox.focus();
  descBox.setSelectionRange(descBox.value.length, descBox.value.length);
  saveDraft(root);
}

// ---------- 歌词段落标签插入 ----------
function insertAtCursor(ta, tag) {
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd, before = ta.value.slice(0, s), after = ta.value.slice(e);
  const prefix = (before.length === 0 || before.endsWith('\n')) ? '' : '\n';
  const suffix = (after.length === 0 || after.startsWith('\n')) ? '\n' : '\n';
  const ins = prefix + tag + suffix;
  ta.value = before + ins + after;
  const caret = s + ins.length;
  ta.focus(); ta.setSelectionRange(caret, caret);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

// ---------- 语言切换翻译（专业模式）----------
async function onLangChange(root, val) {
  saveDraft(root);
  if (state.mode !== 'lyrics' || !val) return;
  const lyricsBox = $(root, '#lyricsBox');
  const lyrics = lyricsBox.value.trim();
  if (lyrics.length <= 10) return;
  const langName = _langName(val);
  if (langName === '粤语') { toast('已切换粤语 · 中文歌词将用粤语发音演唱，无需翻译', 'info'); return; }
  if (!confirm('是否将歌词翻译成' + langName + '？\n翻译后你仍可编辑。')) return;
  await translateLyrics(root, lyrics, langName);
}

async function translateLyrics(root, lyrics, langName) {
  const lyricsBox = $(root, '#lyricsBox');
  lyricsBox.disabled = true;
  const old = lyricsBox.value;
  const oldPh = lyricsBox.placeholder;
  lyricsBox.placeholder = '翻译生成中...';
  lyricsBox.value = '';
  if (!getApiKey() && !(await ensureKey())) { lyricsBox.disabled = false; lyricsBox.value = old; lyricsBox.placeholder = oldPh; return; }
  try {
    const { task_id } = await api.translateLyrics({ lyrics: old, lang: langName });
    const r = await poll(() => api.translateLyricsStatus(task_id), {
      interval: 1000, done: (d) => d.done || !!d.error,
      onTick: (d) => { if (d.text) lyricsBox.value = d.text; },
    });
    if (r.error) { toast('翻译出错: ' + r.error, 'error'); if (!lyricsBox.value) lyricsBox.value = old; }
    else lyricsBox.value = r.text || lyricsBox.value || old;
  } catch (e) { toast(e instanceof ApiError ? e.message : '翻译失败', 'error'); lyricsBox.value = old; }
  finally { lyricsBox.disabled = false; lyricsBox.placeholder = oldPh; lyricsBox.dispatchEvent(new Event('input', { bubbles: true })); }
}

// ---------- 最优风格推荐（编曲房）----------
function showProArrangeNotice(root, msg, kind) {
  const n = $(root, '#proArrangeNotice');
  if (!msg) { n.style.display = 'none'; n.textContent = ''; return; }
  n.style.display = ''; n.textContent = msg;
  if (kind === 'error') { n.style.background = '#fef2f2'; n.style.color = '#b91c1c'; }
  else { n.style.background = '#f5f3ff'; n.style.color = '#6d28d9'; }
}
function stripFinalVocalMix(text) {
  let t = String(text || '');
  t = t.split('\n').filter((line) => !/^\s*\[\s*final\s+vocal\s+mix\s*\]\s*$/i.test(line)).join('\n');
  t = t.replace(/\[\s*final\s+vocal\s+mix\s*\]/gi, ' ');
  t = t.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
  return t.replace(/^\s+|\s+$/g, '');
}
function parseStudioRaw(raw) {
  let t = String(raw || '').trim();
  t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '');
  const idx = t.indexOf(STUDIO_STYLE_DELIM);
  if (idx === -1) return { lyrics: t.trim(), style: '' };
  return { lyrics: t.slice(0, idx).trim(), style: t.slice(idx + STUDIO_STYLE_DELIM.length).trim() };
}
function resetProArrangeBtn(root) {
  state.proArrangeBusy = false;
  const b = $(root, '#proBestStyleBtn');
  b.disabled = false; b.style.opacity = ''; b.textContent = '✨ 最优风格推荐';
}
function applyProArrange(root, lyrics, style) {
  resetProArrangeBtn(root);
  const cleaned = stripFinalVocalMix(lyrics);
  const lyricsBox = $(root, '#lyricsBox'), styleInput = $(root, '#styleInput'), instr = $(root, '#cf-instrumental');
  lyricsBox.value = cleaned;
  lyricsBox.dispatchEvent(new Event('input', { bubbles: true }));
  lyricsBox.style.boxShadow = '0 0 0 2px rgba(251,113,133,.6)';
  setTimeout(() => { lyricsBox.style.boxShadow = ''; }, 1600);
  const styleTrim = (style || '').trim();
  if (styleTrim) {
    state.styleModeUserSet = true;
    setStyleControlMode(root, 'manual');
    styleInput.value = style;
    styleInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const isInstrumental = /^instrumental\b/i.test(styleTrim) || /\bno\s+vocals?\b/i.test(styleTrim);
  instr.checked = isInstrumental;
  instr.dispatchEvent(new Event('change', { bubbles: true }));
  saveDraft(root);
  showProArrangeNotice(root, isInstrumental
    ? '已编排好：纯音乐编排已填入，已自动勾选「纯音乐」、风格已配好（都可继续改）。'
    : '已编排好：结构化歌词已填入歌词框，风格已配好（都可继续改）。');
}

async function runProArrange(root) {
  if (state.proArrangeBusy) return;
  const lyricsBox = $(root, '#lyricsBox'), proReqBox = $(root, '#proReqBox');
  const lyrics = lyricsBox.value.trim(), req = proReqBox.value.trim();
  if (!lyrics && !req) { showProArrangeNotice(root, '先写点歌词，或在「要求」里描述你想要的风格 / 编排。', 'error'); lyricsBox.focus(); return; }
  if (!getApiKey() && !(await ensureKey())) return;
  const parts = [];
  if (lyrics) parts.push('歌词：\n' + lyrics);
  if (req) parts.push('要求：\n' + req);
  const content = parts.join('\n\n');

  state.proArrangeBusy = true;
  const btn = $(root, '#proBestStyleBtn');
  btn.disabled = true; btn.style.opacity = '.75'; btn.textContent = '编排中…';
  showProArrangeNotice(root, 'AI 正在编排（结构化 + 配风格），约 10-30 秒…');
  try {
    const { task_id } = await api.studioArrange({ messages: [{ role: 'user', content }], lang: _langName($(root, '#singLangSelect').value) });
    const r = await poll(() => api.studioArrangePoll(task_id), {
      interval: 600, timeout: 200000, done: (d) => d.done || !!d.error,
    });
    if (r.error) { resetProArrangeBtn(root); showProArrangeNotice(root, r.error, 'error'); return; }
    const parsed = parseStudioRaw(r.text || '');
    if (!parsed.lyrics) { resetProArrangeBtn(root); showProArrangeNotice(root, '编排返回为空，请重试', 'error'); return; }
    applyProArrange(root, parsed.lyrics, parsed.style);
  } catch (e) { resetProArrangeBtn(root); showProArrangeNotice(root, e instanceof ApiError ? e.message : '编排失败，请重试', 'error'); }
}

// ---------- AI 写歌词弹窗 ----------
function openAiLyricsModal(root) {
  $(root, '#aiLyricsModal').style.display = 'flex';
  setTimeout(() => $(root, '#proAiLyricsInput').focus(), 50);
}
function showAiNotice(root, msg, kind) {
  const n = $(root, '#proAiLyricsNotice');
  n.textContent = msg || ''; n.style.display = msg ? '' : 'none';
  if (kind === 'error') { n.style.background = '#fef2f2'; n.style.color = '#b91c1c'; n.style.border = '1px solid #fecaca'; }
  else { n.style.background = '#fff1f2'; n.style.color = '#be123c'; n.style.border = '1px solid #fecdd3'; }
}
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); ok ? resolve() : reject(); }
    catch (e) { reject(e); }
  });
}
function applyAiLyrics(root, lyrics) {
  const text = (lyrics || '').trim();
  if (!text) return;
  const lyricsBox = $(root, '#lyricsBox');
  if (lyricsBox.value.trim() && !window.confirm('用这份歌词替换歌词框里现有的内容？')) return;
  lyricsBox.value = text;
  lyricsBox.dispatchEvent(new Event('input', { bubbles: true }));
  switchMode(root, 'lyrics');
  $(root, '#aiLyricsModal').style.display = 'none';
  saveDraft(root);
  lyricsBox.style.boxShadow = '0 0 0 2px rgba(251,113,133,.6)';
  setTimeout(() => { lyricsBox.style.boxShadow = ''; }, 1600);
  lyricsBox.focus(); lyricsBox.setSelectionRange(lyricsBox.value.length, lyricsBox.value.length);
}
function addAiResultCard(root, theme) {
  const wrap = $(root, '#proAiLyricsResults');
  const card = el('div', { class: 'pro-ai-result' });
  card.innerHTML =
    '<div style="padding:10px 12px;border-bottom:1px solid #fecdd3;background:#fff1f2;font-size:12px;font-weight:900;color:#be123c;">' + esc(theme) + '</div>'
    + '<textarea data-role="body" rows="10" readonly placeholder="歌词生成后可直接修改"></textarea>'
    + '<div class="pro-ai-result-actions" style="display:none;">'
    + '<button type="button" data-action="copy" style="padding:7px 11px;border-radius:999px;border:1px solid #fecdd3;background:#fff;color:#be123c;font-size:12px;font-weight:800;cursor:pointer;">复制歌词</button>'
    + '<button type="button" data-action="use" style="padding:7px 11px;border-radius:999px;border:0;background:linear-gradient(135deg,#f43f5e,#ec4899,#f97316);color:#fff;font-size:12px;font-weight:900;cursor:pointer;">用这份歌词</button>'
    + '</div>';
  wrap.insertBefore(card, wrap.firstChild);
  return card;
}
function finishAiResult(root, card, lyrics) {
  if (!card || !lyrics) return;
  const body = card.querySelector('[data-role="body"]');
  body.value = lyrics; body.readOnly = false; body.removeAttribute('readonly');
  body.style.height = 'auto'; body.style.height = Math.max(220, body.scrollHeight) + 'px';
  card.querySelector('.pro-ai-result-actions').style.display = 'flex';
  card.querySelector('[data-action="copy"]').addEventListener('click', () => {
    const t = (body.value || '').trim(); if (!t) return;
    copyText(t).then(() => toast('歌词已复制', 'success')).catch(() => alert('复制失败，请手动选中复制'));
  });
  card.querySelector('[data-action="use"]').addEventListener('click', () => { const t = (body.value || '').trim(); if (t) applyAiLyrics(root, t); });
}
async function sendAiLyrics(root) {
  const input = $(root, '#proAiLyricsInput'), btn = $(root, '#proAiLyricsSendBtn');
  const theme = input.value.trim();
  if (!theme) { showAiNotice(root, '请输入你想要的歌曲的描述。', 'error'); input.focus(); return; }
  if (theme.length > 500) { showAiNotice(root, '主题太长，最多 500 字', 'error'); return; }
  if (!getApiKey() && !(await ensureKey())) return;
  btn.disabled = true; btn.style.opacity = '.75';
  const old = btn.textContent; btn.textContent = '生成中...';
  showAiNotice(root, 'Yapie 正在写歌词...');
  const card = addAiResultCard(root, theme);
  try {
    const { task_id } = await api.generateLyrics({ theme, style: getActiveStyleValue(root), lang: _langName($(root, '#singLangSelect').value) });
    const r = await poll(() => api.lyricsStatus(task_id), { interval: 1500, done: (x) => ['done', 'failed'].includes(x.status) });
    showAiNotice(root, '');
    if (r.status === 'done') finishAiResult(root, card, r.lyrics || '');
    else { card.remove(); showAiNotice(root, r.error || '生成失败，请重试', 'error'); }
  } catch (e) { card.remove(); showAiNotice(root, e instanceof ApiError ? e.message : '网络异常，请稍后重试', 'error'); }
  finally { btn.disabled = false; btn.style.opacity = ''; btn.textContent = old; }
}

// ---------- 风格取值 ----------
function getActiveStyleValue(root) {
  if (state.styleControlMode === 'ai') return (state.aiStyleSuggestion && state.aiStyleSuggestion.style) || '';
  return ($(root, '#styleInput')?.value || '').trim();
}

// ---------- 草稿 ----------
let _saveTimer = null;
function queueSaveDraft(root) { clearTimeout(_saveTimer); _saveTimer = setTimeout(() => saveDraft(root), 300); }
function saveDraft(root) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: state.mode,
      style_mode: state.styleControlMode,
      title: $(root, '#titleInput').value,
      desc: $(root, '#descBox').value,
      lyrics: $(root, '#lyricsBox').value,
      pro_req: $(root, '#proReqBox').value,
      free: $(root, '#freeBox').value,
      style: $(root, '#styleInput').value,
      ai_style: getActiveStyleValue(root),
      ai_style_key: state.aiStyleSuggestion ? state.aiStyleSuggestion.key : '',
      ai_style_label: state.aiStyleSuggestion ? state.aiStyleSuggestion.label : '',
      style_hint: state.simpleSelectedStyleLabel,
      lang: $(root, '#singLangSelect').value,
      instrumental: $(root, '#cf-instrumental').checked,
      ts: Date.now(),
    }));
  } catch (e) { /* quota / disabled */ }
}
function loadDraft(root) {
  let d;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    d = JSON.parse(raw);
    if (Date.now() - (d.ts || 0) > 24 * 3600 * 1000) { localStorage.removeItem(STORAGE_KEY); return; }
  } catch { return; }
  if (d.title) $(root, '#titleInput').value = d.title;
  if (d.desc) $(root, '#descBox').value = d.desc;
  if (d.lyrics) $(root, '#lyricsBox').value = d.lyrics;
  if (d.pro_req) $(root, '#proReqBox').value = d.pro_req;
  if (d.free) $(root, '#freeBox').value = d.free;
  if (d.style) $(root, '#styleInput').value = d.style;
  if (d.lang) $(root, '#singLangSelect').value = d.lang;
  if (d.instrumental) $(root, '#cf-instrumental').checked = true;
  if (d.style_hint) state.simpleSelectedStyleLabel = d.style_hint;
  if (d.ai_style) state.aiStyleSuggestion = { key: d.ai_style_key || '', label: d.ai_style_label || '已选风格', style: d.ai_style };
  if (d.mode && d.mode !== 'description' && (d.lyrics || d.free)) switchMode(root, d.mode);
  syncDescPlaceholder(root);
  syncTagButtons(root);
  autoGrowStyle(root);
  syncAdvBtn(root);
  syncAllClearBtns(root);
  if (state.aiStyleSuggestion) applyStyleSuggestion(root, state.aiStyleSuggestion);
}

// ---------- 次数 ----------
async function refreshCredits(root) {
  const badge = $(root, '#cf-credits');
  if (!getApiKey()) { badge.textContent = '登录后可生成'; return; }
  try { const r = await api.credits(); badge.textContent = `剩余次数 ${r.credits}`; } catch { badge.textContent = '剩余次数 —'; }
}

function bindCreditsChangedListener(root) {
  if (root.__gmCreditsChangedHandler) {
    window.removeEventListener('gm-credits-changed', root.__gmCreditsChangedHandler);
  }
  root.__gmCreditsChangedHandler = (event) => {
    const badge = $(root, '#cf-credits');
    if (!badge) return;
    const credits = event.detail?.credits?.availableCredits;
    if (credits !== undefined) badge.textContent = `剩余次数 ${credits}`;
    else refreshCredits(root);
  };
  window.addEventListener('gm-credits-changed', root.__gmCreditsChangedHandler);
}

// ---------- 提交 ----------
function buildPayload(root) {
  const v = (sel) => ($(root, sel)?.value || '').trim();
  const c = (sel) => !!$(root, sel)?.checked;
  const langName = _langName(v('#singLangSelect'));
  if (state.mode === 'free') {
    const payload = { prompt: v('#freeBox'), is_free_mode: true, lang: langName, instrumental: c('#cf-instrumental') };
    payload.shorten_intro = c('#advShortenIntro'); payload.boost_vocal = c('#advBoostVocal');
    return payload;
  }
  const instrumental = c('#cf-instrumental');
  const inPro = state.mode === 'lyrics';
  // 专业模式纯音乐：没有歌词 → custom_mode=false，prompt 取要求/风格
  const isCustom = inPro && !instrumental;
  let prompt;
  if (inPro && instrumental) prompt = v('#proReqBox') || getActiveStyleValue(root);
  else prompt = getModeBox(root).value.trim();
  const payload = {
    // 傻瓜模式标题强制 ''（防上一首标题泄漏）；专业模式才带 title
    title: inPro ? v('#titleInput') : '',
    prompt,
    style: getActiveStyleValue(root),
    custom_mode: isCustom,
    instrumental,
    lang: langName,
  };
  // 傻瓜模式点过风格 chip → 带 style_hint（后端编曲房按此风格倾向配）
  if (state.mode === 'description' && state.simpleSelectedStyleLabel) payload.style_hint = state.simpleSelectedStyleLabel;
  // 高级设置：傻瓜模式不带（防隐藏勾选残留泄漏），专业模式带
  if (state.mode !== 'description') { payload.shorten_intro = c('#advShortenIntro'); payload.boost_vocal = c('#advBoostVocal'); }
  return payload;
}

const SUBMIT_LABEL = '🎵 生成音乐（消耗 1 次，产出 2 首）';

function readPendingGens() {
  let arr = [];
  try { arr = JSON.parse(sessionStorage.getItem('gm_pending_gens') || '[]'); } catch { arr = []; }
  return Array.isArray(arr) ? arr : [];
}

function writePendingGens(arr) {
  if (arr.length > 6) arr = arr.slice(-6);   // 防堆积, 只留最近几条
  try { sessionStorage.setItem('gm_pending_gens', JSON.stringify(arr)); } catch (e) {}
  window.dispatchEvent(new CustomEvent('gm-pending-gens-changed'));
}

function pendingTitleFromPayload(payload) {
  return String(payload?.title || payload?.prompt || '生成中的歌曲').trim().slice(0, 40) || '生成中的歌曲';
}

// 把刚提交的生成任务记进 sessionStorage 队列, 跳「我的音乐」后那边轮询显示进度。
function pushPendingGen(item) {
  const now = Date.now();
  const gen = typeof item === 'string' ? { id: item } : { ...(item || {}) };
  const id = String(gen.id || '').trim();
  if (!id) return '';
  const arr = readPendingGens().filter((x) => String(x.id || '') !== id);
  arr.push({ ...gen, id, ts: gen.ts || now });
  writePendingGens(arr);
  return id;
}

function replacePendingGen(oldId, nextItem) {
  const next = typeof nextItem === 'string' ? { id: nextItem } : { ...(nextItem || {}) };
  const nextId = String(next.id || '').trim();
  if (!nextId) return;
  let replaced = false;
  const arr = readPendingGens().map((item) => {
    if (String(item.id || '') !== String(oldId || '')) return item;
    replaced = true;
    return { ...item, ...next, id: nextId, local: false };
  });
  if (!replaced) arr.push({ ...next, id: nextId, ts: Date.now(), local: false });
  writePendingGens(arr.filter((item, index, list) => list.findIndex((x) => String(x.id || '') === String(item.id || '')) === index));
}

function removePendingGen(id) {
  writePendingGens(readPendingGens().filter((item) => String(item.id || '') !== String(id || '')));
}

function extractGenerationId(result = {}) {
  const candidates = [
    result.generation_id,
    result.generationId,
    result.task_id,
    result.taskId,
    result.id,
    result.data?.generation_id,
    result.data?.generationId,
    result.data?.task_id,
    result.data?.taskId,
    result.data?.id,
    result.generation?.id,
    result.task?.id,
    Array.isArray(result.generations) ? result.generations[0]?.id : '',
    Array.isArray(result.tasks) ? result.tasks[0]?.id : ''
  ];
  return String(candidates.find((value) => String(value || '').trim()) || '').trim();
}

function jumpLibraryNow() {
  if (location.hash === '#library') {
    window.dispatchEvent(new Event('hashchange'));
  } else {
    location.hash = 'library';
  }
}

async function submitGenerate(root) {
  if (state.polling) return;
  const payload = buildPayload(root);
  if (!payload.prompt) {
    const hint = payload.instrumental ? '纯音乐：先选个风格，或写一句歌曲要求'
      : state.mode === 'lyrics' ? '请输入歌词，或切回「傻瓜模式」'
      : state.mode === 'free' ? '请写下你的想法' : '请填写描述';
    toast(hint, 'warn');
    return;
  }
  if (!payload.is_free_mode && payload.prompt.length > 500 && !payload.custom_mode) { toast('描述不能超过 500 字，请精简', 'warn'); return; }
  if (!getApiKey() && !(await ensureKey())) return;

  // 傻瓜模式提交前若未配好 AI 风格，先补一次
  if (state.mode === 'description' && state.styleControlMode === 'ai' && !getActiveStyleValue(root)) {
    const submit0 = $(root, '#submitBtn');
    submit0.disabled = true; submit0.textContent = 'AI正在选择风格…';
    await requestStyleSuggestion(root, state.simpleSelectedStyleLabel || '', '');
    payload.style = getActiveStyleValue(root);
    submit0.disabled = false; submit0.textContent = '🎵 生成音乐（消耗 1 次，产出 2 首）';
  }

  const submit = $(root, '#submitBtn');
  submit.disabled = true; submit.style.opacity = '.6'; submit.textContent = '正在提交…';
  state.polling = true;
  const pendingId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  pushPendingGen({ id: pendingId, title: pendingTitleFromPayload(payload), local: true, status: 'submitting' });
  jumpLibraryNow();
  try {
    const result = await api.generate(payload);
    const generationId = extractGenerationId(result);
    if (generationId) replacePendingGen(pendingId, { id: generationId, title: pendingTitleFromPayload(payload) });
    else removePendingGen(pendingId);
    if (result.credits) {
      window.dispatchEvent(new CustomEvent('gm-credits-changed', { detail: result }));
    }
    toast('已提交，正在「我的音乐」生成', 'success');
  } catch (e) {
    removePendingGen(pendingId);
    // Nexa 额度不足时由后端拦截，前端提示用户购买生成次数。
    toast(e instanceof ApiError ? e.message : '生成出错', 'error');
  } finally {
    // 提交完立刻复位创作按钮, 用户可继续生成下一首
    submit.disabled = false; submit.style.opacity = '1'; submit.textContent = SUBMIT_LABEL;
    state.polling = false; refreshCredits(root);
  }
}

function renderProgress(container) {
  clear(container);
  const bar = el('div', { class: 'gm-bar-fill' });
  const label = el('div', { class: 'gm-bar-label', text: '准备中…' });
  container.appendChild(el('div', { class: 'gm-card', style: 'margin-top:16px' }, [label, el('div', { class: 'gm-bar' }, [bar])]));
  return {
    set(p, t) { bar.style.width = Math.max(2, Math.min(100, p)) + '%'; if (t) label.textContent = t; },
    fail(t) { bar.style.width = '100%'; bar.classList.add('fail'); label.textContent = '❌ ' + t; },
  };
}

function renderSongs(container, songs) {
  clear(container);
  if (!songs.length) { container.appendChild(el('p', { class: 'gm-note', text: '没有返回歌曲。' })); return; }
  container.appendChild(el('h3', { class: 'gm-subh', text: `成品（${songs.length} 首）` }));
  const wrap = el('div', { class: 'gm-song-grid' });
  songs.forEach((s) => wrap.appendChild(songCard(s)));
  container.appendChild(wrap);
}
function songCard(s) {
  const cover = el('div', { class: 'gm-cover', style: s.image_url ? `background-image:url('${mediaUrl(s.image_url)}')` : '' });
  const playBtn = el('button', { class: 'gm-btn-play', text: '▶ 播放', onclick: () => toggleGlobalSong(s) });
  const lyricsBox = el('pre', { class: 'gm-lyrics', text: s.lyrics || '（无歌词）', style: 'display:none' });
  const lyricsBtn = el('button', { class: 'gm-btn-ghost', text: '歌词', onclick: () => { lyricsBox.style.display = lyricsBox.style.display === 'none' ? 'block' : 'none'; } });
  return el('div', { class: 'gm-song-card' }, [cover, el('div', { class: 'gm-song-body' }, [
    el('div', { class: 'gm-song-title', text: s.title || '未命名' }),
    el('div', { class: 'gm-song-meta', text: [s.tags, fmtDuration(s.duration)].filter(Boolean).join(' · ') }),
    el('div', { class: 'gm-row', style: 'gap:8px;margin-top:8px' }, [playBtn, lyricsBtn]), lyricsBox,
  ])]);
}

// ---------- 做同款预填 ----------
function applyRemakeHandoff(root) {
  let preset;
  try { preset = JSON.parse(sessionStorage.getItem('gm_remake') || 'null'); } catch { preset = null; }
  if (!preset) return;
  sessionStorage.removeItem('gm_remake');
  switchMode(root, 'lyrics');
  const lyricsBox = $(root, '#lyricsBox');
  lyricsBox.value = preset.lyrics || preset.desc || preset.prompt || '';
  lyricsBox.dispatchEvent(new Event('input', { bubbles: true }));
  if (preset.title) $(root, '#titleInput').value = preset.title;
  if (preset.pro_req) $(root, '#proReqBox').value = preset.pro_req;
  if (preset.style) {
    setStyleControlMode(root, 'manual');
    const styleInput = $(root, '#styleInput');
    styleInput.value = preset.style;
    styleInput.dispatchEvent(new Event('input', { bubbles: true }));
    syncTagButtons(root);
  }
  if (preset.lang) $(root, '#singLangSelect').value = preset.lang;
  if (preset.instrumental) {
    const instr = $(root, '#cf-instrumental');
    instr.checked = true;
    instr.dispatchEvent(new Event('change', { bubbles: true }));
  }
  syncAllClearBtns(root);
  saveDraft(root);
  toast('已带入专业模式，可修改后重新生成', 'info');
}

let remakeHandoffBound = false;
function bindRemakeHandoffListener() {
  if (remakeHandoffBound) return;
  remakeHandoffBound = true;
  window.addEventListener('gm-remake-handoff', () => {
    const root = document.getElementById('screen-generate');
    if (root) applyRemakeHandoff(root);
  });
}

// ---------- 编曲房「🎵 带去创作」预填 ----------
// 生成页不在 ALWAYS_RERENDER, 已挂载就不会重渲 → 从编曲房切回来时 render 不重跑、
// applyStudioHandoff 读不到。靠自定义事件让生成页即时消费 handoff(无论是否重渲)。
let studioHandoffBound = false;
function bindStudioHandoffListener() {
  if (studioHandoffBound) return;
  studioHandoffBound = true;
  window.addEventListener('gm-studio-handoff', () => {
    const root = document.getElementById('screen-generate');
    if (root) applyStudioHandoff(root);
  });
}

function applyStudioHandoff(root) {
  let h;
  try { h = JSON.parse(sessionStorage.getItem('gm_studio_handoff') || 'null'); } catch { h = null; }
  if (!h) return;
  sessionStorage.removeItem('gm_studio_handoff');
  // 切到专业模式，把编排好的结构化歌词 + 风格填进去（复用 switchMode / 标签同步）
  switchMode(root, 'lyrics');
  if (h.lyrics) {
    const lyricsBox = $(root, '#lyricsBox');
    lyricsBox.value = h.lyrics;
    lyricsBox.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (h.style) {
    setStyleControlMode(root, 'manual');
    const styleInput = $(root, '#styleInput');
    styleInput.value = h.style;
    styleInput.dispatchEvent(new Event('input', { bubbles: true }));
    syncTagButtons(root);
  }
  if (h.instrumental) {
    const instr = $(root, '#cf-instrumental');
    instr.checked = true;
    instr.dispatchEvent(new Event('change', { bubbles: true }));
  }
  syncAllClearBtns(root);
  saveDraft(root);
  toast('已带入编曲房编排', 'info');
}
