'use strict'
;
/* ══════════════════ LLM 接口与卡片导入 ══════════════════ */

const API
 = {
  toOpenAI(b) { return [...b.blocks, ...b.history, ...b.tail].map(m => ({ role: m.role, content: m.content
 })); },
  toClaude(b
) {
    const system = b.blocks.filter(m => m.role === 'system').map(m => m.content).join('\n\n'
);
    const
 t = [];
    const add = (role, c) => { const l = t[t.length - 1]; if (l && l.role === role) l.content += '\n\n' + c; else t.push({ role, content
: c }); };
    for (const m of b.history) add(m.role === 'assistant' ? 'assistant' : 'user', m.content
);
    for (const m of b.tail) add('user', m.content
);
    if (!t.length) t.push({ role: 'user', content: '（開始對話）'
 });
    if (t[0].role !== 'user') t.unshift({ role: 'user', content: '（繼續）'
 });
    if (t[t.length - 1].role !== 'user') t.push({ role: 'user', content: '（繼續）'
 });
    return { system, messages
: t };
  },
  toGemini(b
) {
    const sys = b.blocks.filter(m => m.role === 'system').map(m => m.content).join('\n\n'
);
    const
 c = [];
    const add = (role, text) => { const l = c[c.length - 1]; if (l && l.role === role) l.parts[0].text += '\n\n' + text; else c.push({ role, parts
: [{ text }] }); };
    for (const m of b.history) add(m.role === 'assistant' ? 'model' : 'user', m.content
);
    for (const m of b.tail) add('user', m.content
);
    if (!c.length) c.push({ role: 'user', parts: [{ text: '（開始對話）'
 }] });
    return { sys, contents
: c };
  },
  trim(b) { return String(b || '').trim().replace(/\/+$/, ''
); },

  async stream(built, cfg, params, hooks
) {
    const onDelta = hooks.onDelta || (() =>
 {});
    const base = this.trim(cfg.base
);
    if (!base) throw new Error('未填写 Base URL'
);
    if (!cfg.model) throw new Error('未填写模型名'
);
    let
 url, headers, body;

    if (cfg.provider === 'claude'
) {
      const { system, messages } = this.toClaude
(built);
      url = base + (
/\/v1$/.test(base) ? '' : '/v1') + '/messages'
;
      headers = { 
'content-type': 'application/json', 'x-api-key': cfg.key
,
        'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'
 };
      body = { 
model: cfg.model, system, messages, max_tokens: params.max_tokens
,
        temperature: params.temperature, top_p: params.top_p, stream: !!cfg.stream
 };
    } 
else if (cfg.provider === 'gemini'
) {
      const { sys, contents } = this.toGemini
(built);
      url = 
`${base}/models/${encodeURIComponent(cfg.model)}:${cfg.stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`
;
      headers = { 
'content-type': 'application/json', 'x-goog-api-key': cfg.key
 };
      body = { contents, 
systemInstruction: sys ? { parts: [{ text: sys }] } : undefined
,
        generationConfig: { temperature: params.temperature, topP: params.top_p, maxOutputTokens: params.max_tokens
 } };
    } 
else
 {
      url = base + 
'/chat/completions'
;
      headers = { 
'content-type': 'application/json', authorization: 'Bearer ' + cfg.key
 };
      body = { 
model: cfg.model, messages: this.toOpenAI(built), temperature: params.temperature
,
        max_tokens: params.max_tokens, top_p: params.top_p, frequency_penalty: params.frequency_penalty
,
        presence_penalty: params.presence_penalty, stream: !!cfg.stream
 };
    }

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: hooks.signal
 });
    if (!res.ok
) {
      const t = await res.text().catch(() => ''
);
      throw new Error(`HTTP ${res.status} ${res.statusText}\n${t.slice(0, 300)}`
);
    }
    if (!cfg.stream
) {
      const j = await res.json
();
      const text = this.nonStream(cfg.provider
, j);
      if (text) onDelta
(text);
      return
 text;
    }
    return this.sse(res, cfg.provider
, onDelta);
  },

  nonStream(p, j
) {
    if (p === 'claude') return (j.content || []).map(c => c.text || '').join(''
);
    if (p === 'gemini') return (j.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join(''
);
    return j.choices?.[0]?.message?.content || ''
;
  },
  delta(p, o
) {
    if (p === 'claude'
) {
      if (o.type === 'content_block_delta') return o.delta?.text || ''
;
      if (o.type === 'error') throw new Error(o.error?.message || 'Claude error'
);
      return ''
;
    }
    if (p === 'gemini') return (o.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join(''
);
    return o.choices?.[0]?.delta?.content || ''
;
  },
  async sse(res, provider, onDelta
) {
    const rd = res.body.getReader(), dec = new TextDecoder
();
    let buf = '', full = ''
;
    for
 (;;) {
      const { done, value } = await rd.read
();
      if (done) break
;
      buf += dec.
decode(value, { stream: true
 });
      let
 i;
      while ((i = buf.search(/\r?\n\r?\n/)) !== -1
) {
        const chunk = buf.slice(0
, i);
        buf = buf.
slice(i + (buf[i] === '\r' ? 4 : 2
));
        for (const line of chunk.split(/\r?\n/
)) {
          if (!line.startsWith('data:')) continue
;
          const p = line.slice(5).trim
();
          if (!p || p === '[DONE]') continue
;
          let o; try { o = JSON.parse(p); } catch { continue
; }
          const piece = this.delta
(provider, o);
          if (piece) { full += piece; onDelta
(piece); }
        }
      }
    }
    return
 full;
  },
  async models(cfg
) {
    const base = this.trim(cfg.base
);
    if (cfg.provider === 'gemini'
) {
      const r = await fetch(base + '/models', { headers: { 'x-goog-api-key': cfg.key
 } });
      if (!r.ok) throw new Error('HTTP ' + r.status
);
      return ((await r.json()).models || []).map(m => String(m.name).replace(/^models\//, '')).sort
();
    }
    if (cfg.provider === 'claude'
) {
      const r = await fetch(base + (/\/v1$/.test(base) ? '' : '/v1') + '/models'
, {
        headers: { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01'
,
                   'anthropic-dangerous-direct-browser-access': 'true'
 } });
      if (!r.ok) throw new Error('HTTP ' + r.status
);
      return ((await r.json()).data || []).map(m => m.id).sort
();
    }
    const r = await fetch(base + '/models', { headers: { authorization: 'Bearer ' + cfg.key
 } });
    if (!r.ok) throw new Error('HTTP ' + r.status
);
    return ((await r.json()).data || []).map(m => m.id).sort
();
  }
};

/* ── 角色卡规范解析 ── */
const CardIO
 = {
  chunks(buf
) {
    const dv = new DataView(buf), by = new Uint8Array
(buf);
    if (dv.getUint32(0) !== 0x89504e47) throw new Error('不是有效的 PNG'
);
    const out = {}; let off = 8
;
    while (off + 8 <= by.length
) {
      const len = dv.getUint32
(off);
      let type = ''
;
      for (let i = 0; i < 4; i++) type += String.fromCharCode(by[off + 4
 + i]);
      const st = off + 8
;
      if (type === 'tEXt'
) {
        let z = st; while (z < st + len && by[z] !== 0
) z++;
        let kw = '', val = ''
;
        for (let i = st; i < z; i++) kw += String.fromCharCode
(by[i]);
        for (let i = z + 1; i < st + len; i++) val += String.fromCharCode
(by[i]);
        out[kw] = val;
      }
      if (type === 'IEND') break
;
      off = st + len + 
4
;
    }
    return
 out;
  },
  b64(s
) {
    const bin = atob(s.replace(/\s/g, ''
));
    const by = new Uint8Array(bin.length
);
    for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt
(i);
    return new TextDecoder('utf-8').decode
(by);
  },
  normalize(raw, avatar
) {
    const d = raw.data && typeof raw.data === 'object' ? raw.data
 : raw;
    const c = blankChar
({
      name: d.name || d.char_name || '導入的角色', avatar: avatar || ''
,
      description: d.description || d.char_persona || ''
,
      personality: d.personality || '', scenario: d.scenario || d.world_scenario || ''
,
      first_mes: d.first_mes || d.char_greeting || ''
,
      mes_example: d.mes_example || d.example_dialogue || ''
,
      system_prompt: d.system_prompt || '', post_history_instructions: d.post_history_instructions || ''
    });
    c.
sign = (d.creator_notes || '').split('\n')[0].slice(0, 40
);
    let book = null
;
    const cb = d.character_book
;
    if (cb && Array.isArray(cb.entries
)) {
      book = 
blankBook({ name: cb.name || (c.name + ' 的世界書'), scanDepth: cb.scan_depth || 4
 });
      book.
entries = cb.entries.map(e => blankEntry
({
        comment: e.comment || e.name || '條目', keys: e.keys || e.key
 || [],
        keys2: e.secondary_keys || e.keysecondary || [], content: e.content || ''
,
        constant: !!e.constant, enabled: e.enabled !== false
,
        order: e.insertion_order ?? e.order ?? 100, depth: e.extensions?.depth ?? e.depth ?? 4
,
        probability: e.probability ?? 100, caseSensitive: !!e.case_sensitive
,
        position: e.position === 'after_char' || e.extensions?.position === 1 ? 'after_char'
                : e.
position === 'at_depth' ? 'at_depth' : 'before_char'
      }));
      c.
bookIds = [book.id
];
    }
    return { char
: c, book };
  },
  async fromFile(file
) {
    if (/\.json$/i.test(file.name
)) {
      const raw = JSON.parse(await file.text
());
      if (raw.entries && !raw.description) return { bookOnly: this.bookFromJson(raw, file.name
) };
      return this.normalize(raw, ''
);
    }
    const chunks = this.chunks(await file.arrayBuffer
());
    const b64 = chunks.ccv3 || chunks.chara
;
    if (!b64) throw new Error('这张 PNG 里没有角色卡数据'
);
    return this.normalize(JSON.parse(this.b64(b64)), await this.thumb
(file));
  },
  bookFromJson(raw, fname
) {
    const b = blankBook({ name: raw.name || fname.replace(/\.json$/i, ''), scanDepth: raw.scan_depth || 4
 });
    const arr = Array.isArray(raw.entries) ? raw.entries : Object.values(raw.entries
 || {});
    b.
entries = arr.map(e => blankEntry
({
      comment: e.comment || e.name || '條目', keys: e.key || e.keys
 || [],
      keys2: e.keysecondary || e.secondary_keys || [], content: e.content || ''
,
      constant: !!e.constant, enabled: !(e.disable ?? false) && e.enabled !== false
,
      order: e.insertion_order ?? e.order ?? 100, depth: e.depth ?? 4
,
      probability: e.probability ?? 100, caseSensitive: !!e.caseSensitive
,
      position: e.position === 1 || e.position === 'after_char' ? 'after_char'
              : e.
position === 4 || e.position === 'at_depth' ? 'at_depth' : 'before_char'
    }));
    return
 b;
  },
  thumb(file
) {
    return new Promise(res =>
 {
      const src = URL.createObjectURL(file), img = new Image
();
      img.
onload = () =>
 {
        const s = Math.min(1, 160 / Math.max(img.width, img.height
));
        const cv = document.createElement('canvas'
);
        cv.
width = Math.round(img.width * s); cv.height = Math.round(img.height
 * s);
        cv.
getContext('2d').drawImage(img, 0, 0, cv.width, cv.height
);
        URL.revokeObjectURL
(src);
        res(cv.toDataURL('image/jpeg', .82
));
      };
      img.
onerror = () => { URL.revokeObjectURL(src); res(''
); };
      img.
src
 = src;
    });
  }
};
