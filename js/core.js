'use strict';
/* ══════════════════ 底层数据与提示词组装 ══════════════════ */

const NS = 'purewhite.v1';
const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function blobToDataURL(b) {
  return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
}

/* ── IndexedDB 图片仓库 ── */
const ImgStore = {
  mode: 'idb', db: null, urls: new Map(),

  async init() {
    try {
      this.db = await new Promise((res, rej) => {
        const rq = indexedDB.open('purewhite-img', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('img');
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error || new Error('open failed'));
        rq.onblocked = () => rej(new Error('blocked'));
        setTimeout(() => rej(new Error('timeout')), 4000);
      });
    } catch (err) {
      this.mode = 'ls';
      console.warn('IndexedDB 不可用，图片改存 localStorage：', err);
    }
  },

  tx(mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction('img', mode);
      const rq = fn(t.objectStore('img'));
      t.onerror = () => rej(t.error);
      if (rq) { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }
      else t.oncomplete = () => res();
    });
  },

  async put(id, blob) {
    if (this.mode === 'idb') return this.tx('readwrite', s => s.put(blob, id));
    localStorage.setItem('pwimg.' + id, await blobToDataURL(blob));
  },

  async resolve(id) {
    if (!id) return '';
    if (this.urls.has(id)) return this.urls.get(id);
    let url = '';
    if (this.mode === 'idb') {
      const blob = await this.tx('readonly', s => s.get(id)).catch(() => null);
      if (blob) url = URL.createObjectURL(blob);
    } else {
      url = localStorage.getItem('pwimg.' + id) || '';
    }
    if (url) this.urls.set(id, url);
    return url;
  },

  url(id) { return this.urls.get(id) || ''; },

  async del(id) {
    const u = this.urls.get(id);
    if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
    this.urls.delete(id);
    if (this.mode === 'idb') return this.tx('readwrite', s => s.delete(id));
    localStorage.removeItem('pwimg.' + id);
  },

  async ingest(file) {
    const id = uid('img');
    if (file.size <= 2 * 1024 * 1024) { await this.put(id, file); return id; }
    const blob = await this.downscale(file, 1600);
    await this.put(id, blob || file);
    return id;
  },

  downscale(file, max) {
    return new Promise(res => {
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(src);
        cv.toBlob(b => res(b), 'image/jpeg', .88);
      };
      img.onerror = () => { URL.revokeObjectURL(src); res(null); };
      img.src = src;
    });
  }
};

/* ── 预设模板 ── */
function defaultPreset() {
  return {
    id: 'preset-default', name: '純白·默認',
    params: { temperature: .9, max_tokens: 600, top_p: 1, frequency_penalty: .2, presence_penalty: .2, context_tokens: 8000 },
    prompts: [
      { id: 'main', name: '主提示詞', role: 'system', enabled: true, content:
`你正在通过手机聊天软件与 {{user}} 聊天。以 {{char}} 的身份回复。
- 口语化、短句，像真人发即时消息。
- 一次回复 1~3 条，用换行分隔，每行是独立的一条消息。
- 不写旁白、动作描写、括号说明或引号。
- 禁止使用现代 emoji；可以用古早颜文字，例如 (・ω・) (´；ω；｀) (>_<)。
- 保持人设一致，不复述已经说过的话。` },
      { id: 'wiBefore', name: '世界書（角色前）', marker: true, enabled: true },
      { id: 'charDesc', name: '角色描述', marker: true, enabled: true },
      { id: 'charPers', name: '角色性格', marker: true, enabled: true },
      { id: 'scenario', name: '場景', marker: true, enabled: true },
      { id: 'persona',  name: '用戶人設', marker: true, enabled: true },
      { id: 'examples', name: '對話示例', marker: true, enabled: true },
      { id: 'wiAfter',  name: '世界書（角色後）', marker: true, enabled: true },
      { id: 'history',  name: '聊天記錄', marker: true, enabled: true },
      { id: 'jailbreak', name: '後置指令', role: 'system', enabled: true, content:
`[以 {{char}} 的身份继续这段手机聊天。只输出消息正文，每行一条，不要输出任何格式标记。]` }
    ]
  };
}

const blankChar = (o = {}) => Object.assign({
  id: uid('char'), name: '新角色', sign: '', avatar: '', description: '', personality: '',
  scenario: '', first_mes: '', mes_example: '', system_prompt: '', post_history_instructions: '', bookIds: []
}, o);

const blankEntry = (o = {}) => Object.assign({
  id: uid('e'), comment: '新條目', keys: [], keys2: [], content: '', constant: false, enabled: true,
  position: 'before_char', depth: 4, order: 100, probability: 100, caseSensitive: false
}, o);

const blankBook = (o = {}) => Object.assign({ id: uid('book'), name: '新世界書', enabled: true, scanDepth: 4, entries: [] }, o);

/* ── 本地存储 ── */
const Store = {
  data: null,
  seed() {
    const c = blankChar({
      id: 'char-hfl', name: '海風鈴', sign: 'ouo 純白の日記',
      description: '{{char}}，19 岁，住在临海小城旧居民楼六层。白天在市图书馆做整理员，晚上守着一台老式电脑上网。说话轻、句子短，习惯用颜文字收尾。怕吵、怕生，但对熟人非常黏。',
      personality: '慢热、细心、偶尔犯迷糊；被夸会不好意思地转移话题。',
      scenario: '{{user}} 是 {{char}} 在网上认识两年多的朋友，几乎每天在聊天软件上说话。',
      first_mes: '你今天怎么这么晚才上线呀\n我等了好久 (´；ω；｀)',
      mes_example: '{{user}}: 在干嘛\n{{char}}: 在整理书架第三层\n{{char}}: 灰好大 (>_<)',
      bookIds: ['book-town']
    });
    const b = blankBook({
      id: 'book-town', name: '臨海小城',
      entries: [
        blankEntry({ comment: '小城設定', keys: ['小城', '海边', '临海'], content: '这座小城常年潮湿，冬天海风很大。主街只有一条，尽头是废弃的灯塔。', order: 10 }),
        blankEntry({ comment: '圖書館', keys: ['图书馆', '上班', '工作'], content: '市图书馆是三层老楼，{{char}} 负责二层文学区。馆里下午三点会放旧钢琴曲。', order: 20 }),
        blankEntry({ comment: '常駐·語氣', constant: true, content: '{{char}} 从不使用现代 emoji，只用颜文字。', order: 0, position: 'after_char' })
      ]
    });
    return {
      cfg: { provider: 'openai', base: 'https://api.openai.com/v1', key: '', model: '', stream: true },
      chars: [c], books: [b], preset: defaultPreset(),
      persona: { name: '我', description: '' },
      chats: {}, assets: [], icons: {}, iconNames: {},
      theme: {
        carrier: '中国电信 | 中国移动', battery: 72, gs: 1, ct: 1.02, br: 1.02, tex: .5,
        lockWall: '', homeWall: '', bandWall: '', avatar: '',
        nick: '純白', sign: '☾ ouo オタク日記 ☽', energy: 72,
        title: 'Theme Park', blue: '24/7 營業中',
        lines: '告別煩惱、醜陋、痛苦？#@%\n於此處、你將獲得一切快樂與幸福',
        ask: 'Will you stay or leave?', sub: '六月廿九',
        optStay: '滯在', optLeave: '離れる', slide: 'slide to stay'
      },
      ui: {}
    };
  },
  load() {
    try {
      const raw = localStorage.getItem(NS);
      this.data = raw ? JSON.parse(raw) : this.seed();
    } catch (err) { console.warn('读取失败，已重置：', err); this.data = this.seed(); }
    const s = this.seed(), d = this.data;
    d.cfg ||= s.cfg; d.chars ||= []; d.books ||= []; d.preset ||= defaultPreset();
    d.persona ||= s.persona; d.chats ||= {}; d.assets ||= {}; d.ui ||= {};
    if (!Array.isArray(d.assets)) d.assets = [];
    d.icons ||= {}; d.iconNames ||= {};
    d.theme = Object.assign({}, s.theme, d.theme || {});
    return d;
  },
  save() {
    try { localStorage.setItem(NS, JSON.stringify(this.data)); }
    catch (err) { console.error(err); toast('保存失败：本地存储已满，请到「數據」清理'); }
  },
  char(id) { return this.data.chars.find(c => c.id === id) || null; },
  book(id) { return this.data.books.find(b => b.id === id) || null; },
  history(id) { return (this.data.chats[id] ||= []); },
  greet(c) { const h = this.history(c.id); if (!h.length && c.first_mes) h.push({ role: 'assistant', content: c.first_mes, ts: Date.now() }); return h; }
};

/* ── 宏与 Token 估算 ── */
function macro(text, ctx) {
  if (!text) return '';
  const now = new Date();
  return String(text)
    .replace(/\{\{char\}\}/gi, ctx.charName || '')
    .replace(/\{\{user\}\}/gi, ctx.userName || '')
    .replace(/\{\{time\}\}/gi, now.toTimeString().slice(0, 5))
    .replace(/\{\{date\}\}/gi, now.toLocaleDateString('zh-CN'))
    .replace(/\{\{random:([^}]+)\}\}/gi, (_, l) => {
      const a = l.split(',').map(s => s.trim()).filter(Boolean);
      return a.length ? pick(a) : '';
    })
    .replace(/\{\{roll:\s*d?(\d+)\s*\}\}/gi, (_, n) => 1 + ((Math.random() * (+n || 6)) | 0));
}

function estTokens(t) {
  if (!t) return 0;
  const s = String(t), cjk = (s.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length;
  return Math.ceil(cjk + (s.length - cjk) / 3.6);
}

/* ── 世界书触发器 ── */
const WorldInfo = {
  activate(books, history, ctx) {
    const pool = []; let scan = 4;
    for (const b of books) {
      if (b.enabled === false) continue;
      scan = Math.max(scan, b.scanDepth || 4);
      for (const e of (b.entries || [])) if (e.enabled !== false) pool.push(e);
    }
    const out = { before: [], after: [], depth: [], hits: [] };
    if (!pool.length) return out;

    const base = history.slice(-scan).map(m => m.content).join('\n');
    const chosen = new Map();
    const roll = e => (e.probability ?? 100) >= 100 || Math.random() * 100 < (e.probability ?? 100);
    for (const e of pool) if (e.constant && roll(e)) chosen.set(e.id, e);

    const hit = (e, text) => {
      const keys = (e.keys || []).filter(Boolean);
      if (!keys.length) return false;
      const hay = e.caseSensitive ? text : text.toLowerCase();
      const has = k => hay.includes(e.caseSensitive ? k : k.toLowerCase());
      if (!keys.some(has)) return false;
      const sec = (e.keys2 || []).filter(Boolean);
      return !(sec.length && !sec.some(has));
    };

    let text = base, grew = true, pass = 0;
    while (grew && pass++ < 3) {
      grew = false;
      for (const e of pool) {
        if (chosen.has(e.id)) continue;
        if (hit(e, text) && roll(e)) { chosen.set(e.id, e); grew = true; }
      }
      if (grew) text = base + '\n' + [...chosen.values()].map(e => e.content).join('\n');
    }

    const budget = Math.floor((ctx.contextTokens || 8000) * .3);
    let used = 0;
    for (const e of [...chosen.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100))) {
      const content = macro(e.content, ctx).trim();
      if (!content) continue;
      const cost = estTokens(content);
      if (used + cost > budget) continue;
      used += cost;
      out.hits.push(e.comment || (e.keys || []).join('/'));
      if (e.position === 'at_depth') out.depth.push({ depth: Math.max(0, e.depth ?? 4), content });
      else if (e.position === 'after_char') out.after.push(content);
      else out.before.push(content);
    }
    return out;
  }
};

/* ── 提示词装配 ── */
function buildPrompt(char, history, opts) {
  const preset = opts.preset, persona = opts.persona;
  const ctx = { charName: char.name, userName: persona.name || '我', contextTokens: preset.params.context_tokens };
  const wi = WorldInfo.activate((char.bookIds || []).map(id => Store.book(id)).filter(Boolean), history, ctx);
  const pre = [], post = [];
  let seen = false;
  const push = (role, c) => { c = (c || '').trim(); if (c) (seen ? post : pre).push({ role, content: c }); };

  for (const p of preset.prompts) {
    if (p.enabled === false) continue;
    switch (p.id) {
      case 'history': seen = true; break;
      case 'wiBefore': if (wi.before.length) push('system', '[世界設定]\n' + wi.before.join('\n\n')); break;
      case 'wiAfter': if (wi.after.length) push('system', '[補充設定]\n' + wi.after.join('\n\n')); break;
      case 'charDesc': push('system', macro(char.system_prompt || '', ctx));
                       push('system', `[${char.name} 的人設]\n` + macro(char.description, ctx)); break;
      case 'charPers': push('system', char.personality ? `[${char.name} 的性格]\n` + macro(char.personality, ctx) : ''); break;
      case 'scenario': push('system', char.scenario ? '[場景]\n' + macro(char.scenario, ctx) : ''); break;
      case 'persona': push('system', persona.description ? `[${ctx.userName} 的人設]\n` + macro(persona.description, ctx) : ''); break;
      case 'examples': push('system', char.mes_example ? '[對話風格示例]\n' + macro(char.mes_example, ctx) : ''); break;
      case 'jailbreak': push('system', macro(char.post_history_instructions || p.content, ctx)); break;
      default: if (!p.marker) push(p.role || 'system', macro(p.content, ctx));
    }
  }

  const fixed = [...pre, ...post].reduce((n, b) => n + estTokens(b.content) + 4, 0);
  let budget = preset.params.context_tokens - fixed - preset.params.max_tokens - 64;
  const kept = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const cost = estTokens(history[i].content) + 4;
    if (budget - cost < 0) break;
    budget -= cost;
    kept.unshift({ role: history[i].role, content: macro(history[i].content, ctx) });
  }
  for (const d of wi.depth.sort((a, b) => b.depth - a.depth))
    kept.splice(Math.max(0, kept.length - d.depth), 0, { role: 'system', content: d.content });

  return { blocks: pre, history: kept, tail: post, wiHits: wi.hits };
}
