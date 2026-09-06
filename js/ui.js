'use strict';
/* ══════════════════ 界面与交互控制 ══════════════════ */

const $ = id => document.getElementById(id);
const KAO = ['(・ω・)','( ˘ω˘ )','(´；ω；｀)','(>_<)','( ᐛ )','(ㆆ_ㆆ)','(*ˊᵕˋ*)','(¯﹃¯)','ヽ(・∀・)ﻭ','( ｰ̀εｰ́ )'];

const APPS = [
  { k: 'messages', label: '信息',   dock: true,  act: () => Nav.open('msgPage') },
  { k: 'photos',   label: '相册',   dock: true,  act: () => Nav.open('phPage') },
  { k: 'net',      label: '純白NET', dock: true, act: () => { Net.paint(); Nav.open('netPage'); } },
  { k: 'settings', label: '設定',   dock: true,  act: () => Nav.open('setPage') },
  { k: 'memo',     label: '备忘录', tip: '( ˘ω˘ ) 今日无待办事项。' },
  { k: 'music',    label: '音乐',   tip: '曲库为空，插入耳机作天线。' },
  { k: 'weather',  label: '天气',   tip: '晴朗 21°C ／ 湿度 68%' },
  { k: 'calc',     label: '计算器', tip: '(＝ω＝) 算不过来了。' },
  { k: 'diary',    label: '日記',   tip: 'Vol.2023 · 尚未开始书写。' },
  { k: 'radio',    label: 'FM',     tip: 'MOON RADIO FM 13.14' },
  { k: 'draw',     label: '爱笔思画', tip: '画布加载失败 ?#@%' },
  { k: 'verify',   label: '验证',   tip: 'HumanVerification · 1777 a' }
];

let D;
let toastT = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2000);
}
function sheet(items) {
  const box = $('sheetBox');
  box.textContent = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'bt' + (it.danger ? ' dg' : it.hi ? ' hi' : '');
    b.textContent = it.label;
    b.onclick = () => { $('sheet').classList.remove('on'); it.run && it.run(); };
    box.appendChild(b);
  }
  const c = document.createElement('button');
  c.className = 'bt'; c.textContent = '取消';
  c.onclick = () => $('sheet').classList.remove('on');
  box.appendChild(c);
  $('sheet').classList.add('on');
}
$('sheet').addEventListener('click', e => { if (e.target.id === 'sheet') $('sheet').classList.remove('on'); });

function imgEl(url) { const i = new Image(); i.src = url; i.alt = ''; return i; }

const Nav = {
  page: null, stack: [],
  open(id) {
    if (this.page === id) return;
    if (id === 'setPage') paintSetRoot();
    if (id === 'phPage') Photos.paintGrid();
    if (id === 'msgPage') Chat.paintContacts();
    const el = $(id);
    el.classList.add('on');
    this.page = id; this.stack = [];
    $('statusBar').classList.add('dark');
    el.addEventListener('transitionend', e => {
      if (e.propertyName === 'transform') $('home').classList.add('suspended');
    }, { once: true });
  },
  home() {
    if (!this.page) return;
    Gen.abort();
    while (this.stack.length) $(this.stack.pop()).classList.remove('on');
    $('home').classList.remove('suspended');
    $(this.page).classList.remove('on');
    this.page = null;
    $('statusBar').classList.add('dark');
  },
  push(id) { this.stack.push(id); $(id).classList.add('on'); },
  back() { const id = this.stack.pop(); if (id) $(id).classList.remove('on'); }
};

document.addEventListener('click', e => {
  const t = e.target.closest('[data-home],[data-back],[data-sub]');
  if (!t) return;
  if (t.dataset.home !== undefined) return Nav.home();
  if (t.dataset.back !== undefined) return Nav.back();
  if (t.dataset.sub) {
    if (Nav.page !== 'setPage') { Nav.home(); Nav.open('setPage'); }
    openSub(t.dataset.sub);
  }
});

/* ── 主题管理器 ── */
const Theme = {
  apply() {
    const t = D.theme, r = document.documentElement.style;
    r.setProperty('--gs', t.gs); r.setProperty('--ct', t.ct);
    r.setProperty('--br', t.br); r.setProperty('--tex', t.tex);

    const setWall = (el, id) => {
      const u = ImgStore.url(id);
      el.style.backgroundImage = u ? `url("${u}")` : '';
      el.classList.toggle('empty', !u);
    };
    setWall($('lockWall'), t.lockWall);
    setWall($('homeWall'), t.homeWall);

    const bg = $('wBand').querySelector('.bg'), bu = ImgStore.url(t.bandWall);
    bg.style.backgroundImage = bu ? `url("${bu}")` : '';
    bg.classList.toggle('none', !bu);

    for (const box of [$('wAv'), $('tAvPrev'), $('netAv')]) {
      if (!box) continue;
      box.textContent = '';
      const u = ImgStore.url(t.avatar);
      if (u) box.appendChild(imgEl(u));
      else box.textContent = box.id === 'wAv' ? '(・ω・)' : '無';
    }

    $('sbBat').style.width = clamp(t.battery, 1, 100) * .19 + 'px';
    $('wNick').textContent = t.nick; $('wSign').textContent = t.sign;
    $('wEn').textContent = t.energy + '%'; $('wEnBar').style.width = clamp(t.energy, 0, 100) + '%';
    $('wTitle').textContent = t.title; $('wBlue').textContent = t.blue;
    $('wLines').textContent = t.lines; $('wAsk').textContent = t.ask;
    $('lkTitle').textContent = t.title; $('lkBlue').textContent = t.blue;
    $('lkLines').textContent = t.lines; $('lkAsk').textContent = t.ask;
    $('optStayT').textContent = t.optStay; $('optLeaveT').textContent = t.optLeave;
    $('slideTxt').textContent = t.slide;
    $('netNick').textContent = t.nick; $('netNick2').textContent = t.nick;
    $('netSign').textContent = t.sign; $('netBar').style.width = clamp(t.energy, 0, 100) + '%';
    this.clock();
  },
  clock() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const hm = p(d.getHours()) + ':' + p(d.getMinutes());
    if ($('lkTime').textContent !== hm) {
      $('lkTime').textContent = hm;
      const wd = '日一二三四五六'[d.getDay()];
      const dt = `${d.getMonth() + 1}月${d.getDate()}日 周${wd}`;
      $('lkDate').textContent = dt + (D.theme.sub ? '  ' + D.theme.sub : '');
      $('wDate').textContent = `${p(d.getMonth() + 1)}月${p(d.getDate())}日 周${wd}`;
    }
    $('sbLeft').textContent = Lock.locked ? D.theme.carrier : hm;
  }
};
let clockT = null;
const startClock = () => { Theme.clock(); clockT = setInterval(() => Theme.clock(), 10000); };
const stopClock = () => { clearInterval(clockT); clockT = null; };
document.addEventListener('visibilitychange', () => document.hidden ? stopClock() : startClock());

/* ── 锁屏逻辑 ── */
const Lock = {
  locked: true, x: 0, max: 0, drag: null,

  init() {
    const track = $('slide'), knob = $('knob');
    const onDown = e => {
      if (!this.locked) return;
      this.max = track.clientWidth - knob.offsetWidth - 10;
      this.drag = e.clientX - this.x;
      knob.style.transition = 'none';
      knob.setPointerCapture(e.pointerId);
    };
    const onMove = e => {
      if (this.drag === null) return;
      this.x = clamp(e.clientX - this.drag, 0, this.max);
      knob.style.transform = `translateX(${this.x}px)`;
      $('slideTxt').style.opacity = String(1 - this.x / this.max * 1.3);
    };
    const onUp = () => {
      if (this.drag === null) return;
      this.drag = null;
      if (this.x > this.max * .68) return this.unlock();
      this.x = 0;
      knob.style.transition = 'transform .26s cubic-bezier(.3,1.3,.5,1)';
      knob.style.transform = 'translateX(0)';
      $('slideTxt').style.opacity = '1';
    };
    knob.addEventListener('pointerdown', onDown);
    knob.addEventListener('pointermove', onMove);
    knob.addEventListener('pointerup', onUp);
    knob.addEventListener('pointercancel', onUp);

    $('optStay').onclick = () => this.unlock();
    $('optLeave').onclick = () => toast('（ ˘ω˘ ）門是關著的。你只能留下。');
  },

  unlock() {
    if (!this.locked) return;
    this.locked = false;
    $('lock').classList.add('gone');
    $('statusBar').classList.add('dark');
    setTimeout(() => { $('lock').style.display = 'none'; }, 460);
    requestAnimationFrame(() => $('home').classList.add('live'));
    Theme.clock();
  }
};

/* ── 桌面网格与滑动 ── */
const Home = {
  paint() {
    const mk = (app, box) => {
      const w = document.createElement('div');
      w.className = 'ic-box';
      const ic = document.createElement('div');
      ic.className = 'ic';
      const u = ImgStore.url(D.icons[app.k]);
      if (u) ic.appendChild(imgEl(u));
      else ic.textContent = '◇';
      const lb = document.createElement('div');
      lb.className = 'ic-lb';
      lb.textContent = D.iconNames[app.k] || app.label;
      w.append(ic, lb);
      w.onclick = () => app.act ? app.act() : toast(app.tip || '（ ˘ω˘ ）');
      box.appendChild(w);
    };
    const p1 = $('iconsP1'), p2 = $('iconsP2'), dk = $('dockIcons');
    p1.textContent = ''; p2.textContent = ''; dk.textContent = '';
    APPS.slice(0, 8).forEach(a => mk(a, p1));
    APPS.slice(8).forEach(a => mk(a, p2));
    APPS.filter(a => a.dock).forEach(a => mk(a, dk));

    const slot = $('gridSlotA');
    slot.textContent = '';
    const card = document.createElement('div');
    card.className = 'card w-band';
    const bg = document.createElement('div');
    bg.className = 'bg';
    const latest = D.assets[D.assets.length - 1];
    const u = latest ? ImgStore.url(latest.id) : '';
    if (u) bg.style.backgroundImage = `url("${u}")`; else bg.classList.add('none');
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = latest ? (latest.caption || latest.name || '') : '相册为空 · 去上传素材';
    card.append(bg, cap);
    card.onclick = () => Nav.open('phPage');
    slot.appendChild(card);
  }
};

const Pager = {
  i: 0, n: 2, w: 0, sx: 0, sy: 0, dragging: false, decided: false,
  init() {
    const wrap = $('pager'), el = $('pages');
    this.el = el; this.wrap = wrap;
    const ro = () => { this.w = wrap.clientWidth; this.set(this.i, false); };
    window.addEventListener('resize', ro);
    ro();
    wrap.addEventListener('pointerdown', e => {
      if (e.target.closest('.page-col') && e.pointerType === 'mouse' && e.button !== 0) return;
      this.dragging = true; this.decided = false;
      this.sx = e.clientX; this.sy = e.clientY;
      el.style.transition = 'none';
    });
    wrap.addEventListener('pointermove', e => {
      if (!this.dragging) return;
      const dx = e.clientX - this.sx, dy = e.clientY - this.sy;
      if (!this.decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        this.decided = true;
        if (Math.abs(dy) > Math.abs(dx)) { this.dragging = false; return; }
      }
      el.style.transform = `translate3d(${-this.i * this.w + dx}px,0,0)`;
    });
    const end = e => {
      if (!this.dragging) return;
      this.dragging = false;
      const dx = (e.clientX ?? this.sx) - this.sx;
      if (Math.abs(dx) > this.w * .22) this.set(this.i - Math.sign(dx));
      else this.set(this.i);
    };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);
    wrap.addEventListener('pointerleave', end);
  },
  set(i, anim = true) {
    this.i = clamp(i, 0, this.n - 1);
    this.el.style.transition = anim ? 'transform .32s cubic-bezier(.2,.9,.3,1)' : 'none';
    this.el.style.transform = `translate3d(${-this.i * this.w}px,0,0)`;
    [...$('dots').children].forEach((d, k) => d.classList.toggle('on', k === this.i));
  }
};

/* ── 素材选择面板 ── */
const Picker = {
  cb: null,
  open(title, cb) {
    this.cb = cb;
    $('pkTitle').textContent = title;
    this.paint();
    $('picker').classList.add('on');
  },
  close() { $('picker').classList.remove('on'); this.cb = null; },
  paint() {
    const g = $('pkGrid');
    g.textContent = '';
    for (const a of [...D.assets].reverse()) {
      const c = document.createElement('div');
      c.className = 'ph-cell';
      const u = ImgStore.url(a.id);
      if (u) c.appendChild(imgEl(u));
      c.onclick = () => { const f = this.cb; this.close(); f && f(a.id); };
      g.appendChild(c);
    }
    $('pkNote').textContent = D.assets.length
      ? `共 ${D.assets.length} 张素材。点右上「上傳」可继续添加。`
      : '素材库是空的。点右上「上傳」选择你的壁纸／图标／颜文字 PNG。';
  }
};
$('pkClose').onclick = () => Picker.close();
$('pkUp').onclick = () => $('pkFile').click();
$('pkFile').onchange = async e => {
  const n = await Photos.ingest(e.target.files);
  e.target.value = '';
  if (n) { Picker.paint(); toast(`已添加 ${n} 张素材`); }
};

/* ── 相册查看器 ── */
const Photos = {
  idx: 0,
  async ingest(files) {
    let n = 0;
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const id = await ImgStore.ingest(f);
        await ImgStore.resolve(id);
        D.assets.push({ id, name: f.name.replace(/\.[^.]+$/, ''), caption: '', ts: Date.now() });
        n++;
      } catch (err) { console.error(err); toast('导入失败：' + f.name); }
    }
    if (n) { Store.save(); this.paintGrid(); Home.paint(); Theme.apply(); }
    return n;
  },
  paintGrid() {
    const g = $('phGrid');
    g.textContent = '';
    const list = [...D.assets].reverse();
    list.forEach(a => {
      const c = document.createElement('div');
      c.className = 'ph-cell';
      const u = ImgStore.url(a.id);
      if (u) c.appendChild(imgEl(u));
      c.onclick = () => this.view(D.assets.indexOf(a));
      g.appendChild(c);
    });
    $('phNote').textContent = D.assets.length
      ? `${D.assets.length} 张素材 · 点右上相机图标继续添加`
      : '空相册。点右上相机图标上传你的壁纸与素材，之后可一键设为锁屏／桌面壁纸或 APP 图标。';
  },
  view(i) {
    if (!D.assets.length) return;
    this.idx = clamp(i, 0, D.assets.length - 1);
    this.paintView();
    Nav.push('viewer');
  },
  paintView() {
    const a = D.assets[this.idx];
    if (!a) return Nav.back();
    $('vwImg').src = ImgStore.url(a.id);
    $('vwIdx').textContent = `${this.idx + 1} of ${D.assets.length}`;
    $('vwC1').textContent = a.caption || 'this wonderful {moment}';
    $('vwC2').textContent = a.name || 'simply wonderful moment';
  },
  step(d) {
    if (!D.assets.length) return;
    this.idx = (this.idx + d + D.assets.length) % D.assets.length;
    this.paintView();
  },
  async remove() {
    const a = D.assets[this.idx];
    if (!a) return;
    await ImgStore.del(a.id);
    D.assets.splice(this.idx, 1);
    const t = D.theme;
    for (const k of ['lockWall', 'homeWall', 'bandWall', 'avatar']) if (t[k] === a.id) t[k] = '';
    for (const k in D.icons) if (D.icons[k] === a.id) D.icons[k] = '';
    Store.save(); Theme.apply(); Home.paint(); this.paintGrid();
    if (!D.assets.length) Nav.back(); else { this.idx = clamp(this.idx, 0, D.assets.length - 1); this.paintView(); }
  }
};
$('phAddBtn').onclick = () => $('pkFile').click();
$('vwPrev').onclick = () => Photos.step(-1);
$('vwNext').onclick = () => Photos.step(1);
$('vwDel').onclick = () => sheet([{ label: '刪除這張素材', danger: true, run: () => Photos.remove() }]);
$('vwWall').onclick = () => {
  const a = D.assets[Photos.idx]; if (!a) return;
  sheet([
    { label: '設為鎖屏壁紙', hi: true, run: () => { D.theme.lockWall = a.id; Store.save(); Theme.apply(); toast('已设为锁屏壁纸'); } },
    { label: '設為桌面壁紙', run: () => { D.theme.homeWall = a.id; Store.save(); Theme.apply(); toast('已设为桌面壁纸'); } },
    { label: '設為橫幅組件圖', run: () => { D.theme.bandWall = a.id; Store.save(); Theme.apply(); toast('已设为横幅组件'); } },
    { label: '設為頭像', run: () => { D.theme.avatar = a.id; Store.save(); Theme.apply(); toast('已设为头像'); } },
    { label: '設為 APP 圖標…', run: () => sheet(APPS.map(app => ({
        label: D.iconNames[app.k] || app.label,
        run: () => { D.icons[app.k] = a.id; Store.save(); Home.paint(); Net.paint(); toast('图标已更换'); }
      }))) }
  ]);
};
$('vwEdit').onclick = () => {
  const a = D.assets[Photos.idx]; if (!a) return;
  const v = prompt('这张图的说明文字（显示在照片下方）', a.caption || '');
  if (v === null) return;
  a.caption = v.trim(); Store.save(); Photos.paintView(); Home.paint();
};
(() => {
  const st = $('vwStage');
  let sx = null, sy = 0;
  st.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
  st.addEventListener('pointerup', e => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) Photos.step(dx < 0 ? 1 : -1);
  });
})();

/* ── 古早NET ── */
const Net = {
  paint() {
    const mg = $('netMiniGrid');
    mg.textContent = '';
    APPS.slice(0, 8).forEach(a => {
      const d = document.createElement('div');
      d.className = 'mi';
      const u = ImgStore.url(D.icons[a.k]);
      if (u) d.appendChild(imgEl(u));
      mg.appendChild(d);
    });
    const g = $('netGal');
    g.textContent = '';
    for (const a of [...D.assets].reverse()) {
      const c = document.createElement('div');
      c.className = 'gal-i';
      const u = ImgStore.url(a.id);
      if (u) c.appendChild(imgEl(u));
      c.onclick = () => { Photos.idx = D.assets.indexOf(a); $('vwWall').onclick(); };
      g.appendChild(c);
    }
    if (!D.assets.length) {
      const n = document.createElement('div');
      n.style.cssText = 'font-size:10px;color:#9aa1ab;padding:14px;text-align:center;line-height:2';
      n.textContent = '*尚無素材\n去「相册」上傳圖標包';
      n.style.whiteSpace = 'pre-line';
      g.appendChild(n);
    }
  }
};

/* ── 聊天模块 ── */
const scrollQ = new Set();
function schedScroll(el) {
  const first = scrollQ.size === 0;
  scrollQ.add(el);
  if (first) requestAnimationFrame(() => { for (const c of scrollQ) c.scrollTop = c.scrollHeight; scrollQ.clear(); });
}

const Chat = {
  charId: null,

  paintContacts() {
    const box = $('msgContacts');
    box.textContent = '';
    if (!D.chars.length) {
      const n = document.createElement('div');
      n.className = 'note';
      n.textContent = '还没有角色。到「設定 → 角色卡」新建或导入一张角色卡。';
      return box.appendChild(n);
    }
    for (const c of D.chars) {
      const h = D.chats[c.id] || [], last = h[h.length - 1];
      const row = document.createElement('div');
      row.className = 'ct-row';
      const av = document.createElement('div');
      av.className = 'ct-av';
      if (c.avatar) av.appendChild(imgEl(c.avatar)); else av.textContent = c.name.slice(0, 2);
      const mid = document.createElement('div');
      mid.className = 'ct-mid';
      const nm = document.createElement('div');
      nm.className = 'ct-nm'; nm.textContent = c.name;
      const pv = document.createElement('div');
      pv.className = 'ct-pv';
      pv.textContent = last ? (last.role === 'user' ? '我：' : '') + last.content.split('\n')[0] : (c.sign || '还没有聊过');
      mid.append(nm, pv);
      row.append(av, mid);
      row.onclick = () => this.open(c.id);
      box.appendChild(row);
    }
  },

  open(id) {
    const c = Store.char(id);
    if (!c) return toast('角色不存在');
    this.charId = id;
    $('chatName').textContent = c.name;
    Store.greet(c);
    this.render();
    Nav.push('msgChat');
  },

  render() {
    const flow = $('flow');
    flow.textContent = '';
    const d = document.createElement('div');
    d.className = 'dv';
    d.textContent = 'Today ' + new Date().toTimeString().slice(0, 5);
    flow.appendChild(d);
    for (const m of Store.history(this.charId)) this.paint(m.role, m.content, false);
    schedScroll(flow);
  },

  paint(role, content, anim = true) {
    const flow = $('flow');
    const lines = String(content).split('\n').map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
      const b = document.createElement('div');
      b.className = 'bb ' + (role === 'user' ? 'out' : 'in') + (anim ? ' pop' : '');
      b.textContent = line;
      if (anim) b.addEventListener('animationend', () => b.classList.remove('pop'), { once: true });
      flow.appendChild(b);
    }
    schedScroll(flow);
  },

  async send() {
    if (!this.charId) return;
    const ipt = $('msgInput'), text = ipt.value.trim();
    if (!text) return;
    if (Gen.busy) return toast('还在等对方回复...');
    ipt.value = '';
    Store.history(this.charId).push({ role: 'user', content: text, ts: Date.now() });
    this.paint('user', text);
    Store.save(); this.paintContacts();
    await Gen.run();
  },

  menu() {
    sheet([
      { label: Gen.busy ? '停止生成' : '重新生成上一條', run: () => Gen.busy ? Gen.abort() : Gen.regen() },
      { label: '刪除最後一條', run: () => {
          const h = Store.history(this.charId);
          if (!h.length) return toast('没有可删的消息');
          h.pop(); Store.save(); this.render(); this.paintContacts();
        } },
      { label: '查看本次注入的世界書', run: () => {
          const b = buildPrompt(Store.char(this.charId), Store.history(this.charId), { preset: D.preset, persona: D.persona });
          toast(b.wiHits.length ? '命中：' + b.wiHits.join('、') : '本轮没有世界书被触发');
        } },
      { label: '清空這個會話', danger: true, run: () => {
          D.chats[this.charId] = [];
          Store.greet(Store.char(this.charId));
          Store.save(); this.render(); this.paintContacts();
        } }
    ]);
  }
};
$('sendBtn').onclick = () => Chat.send();
$('msgInput').addEventListener('keydown', e => { if (e.key === 'Enter') Chat.send(); });
$('chatMenu').onclick = () => Chat.menu();
$('kaoBtn').onclick = () => { const i = $('msgInput'); i.value += (i.value ? ' ' : '') + pick(KAO); i.focus(); };

const Gen = {
  busy: false, ctrl: null,
  abort() { if (this.ctrl) { this.ctrl.abort(); this.ctrl = null; } },
  async regen() {
    const h = Store.history(Chat.charId);
    while (h.length && h[h.length - 1].role === 'assistant') h.pop();
    Store.save(); Chat.render();
    await this.run();
  },
  async run() {
    const c = Store.char(Chat.charId);
    if (!c) return;
    if (!D.cfg.key || !D.cfg.model) return toast('请先到「設定 → 接口與模型」填好 Key 和模型');

    this.busy = true;
    this.ctrl = new AbortController();
    const flow = $('flow');
    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.textContent = '對方正在輸入…';
    flow.appendChild(tip);
    schedScroll(flow);

    let live = null, acc = '', pending = false;
    const flush = () => {
      pending = false;
      if (!live) { live = document.createElement('div'); live.className = 'bb in'; flow.insertBefore(live, tip); }
      live.textContent = acc;
      schedScroll(flow);
    };

    try {
      const built = buildPrompt(c, Store.history(Chat.charId), { preset: D.preset, persona: D.persona });
      const full = await API.stream(built, D.cfg, D.preset.params, {
        signal: this.ctrl.signal,
        onDelta: d => { acc += d; if (!pending) { pending = true; requestAnimationFrame(flush); } }
      });
      const text = (full || acc).trim();
      tip.remove(); if (live) live.remove();
      if (!text) return toast('模型返回了空内容');
      Store.history(Chat.charId).push({ role: 'assistant', content: text, ts: Date.now() });
      Store.save();
      Chat.paint('assistant', text);
      Chat.paintContacts();
    } catch (err) {
      tip.remove();
      if (live && !acc.trim()) live.remove();
      if (err.name === 'AbortError') {
        if (acc.trim()) {
          Store.history(Chat.charId).push({ role: 'assistant', content: acc.trim(), ts: Date.now() });
          Store.save(); Chat.render();
        }
        toast('已停止');
      } else { console.error(err); toast('请求失败：' + String(err.message || err).slice(0, 110)); }
    } finally { this.busy = false; this.ctrl = null; }
  }
};

/* ── 设置页面表单与事件 ── */
function openSub(id) {
  ({ setTheme: paintTheme, setIcons: paintIcons, setApi: paintApi, setPreset: paintPreset,
     setChars: paintCharList, setBooks: paintBookList, setPersona: paintPersona, setData: paintData }[id] || (() => {}))();
  Nav.push(id);
}
function paintSetRoot() {
  $('cellTheme').textContent = D.theme.nick;
  $('cellApi').textContent = D.cfg.key ? `${D.cfg.provider} / ${D.cfg.model || '未選模型'}` : '未配置';
  $('cellPreset').textContent = D.preset.name;
  $('cellChars').textContent = D.chars.length + ' 張';
  $('cellBooks').textContent = D.books.length + ' 本';
  $('cellPersona').textContent = D.persona.name || '-';
  $('storeMode').textContent = ImgStore.mode === 'idb'
    ? '◈ 图片存于 IndexedDB，容量充足。'
    : '◈ 当前环境不支持 IndexedDB，图片改存 localStorage（约 5MB 上限），建议少放大图。';
}

function paintTheme() {
  const t = D.theme;
  const rv = (id, vid, val) => { $(id).value = val; $(vid).textContent = (+val).toFixed(2); };
  rv('tGs', 'vGs', t.gs); rv('tCt', 'vCt', t.ct); rv('tBr', 'vBr', t.br); rv('tTex', 'vTex', t.tex);
  $('tNick').value = t.nick; $('tSign').value = t.sign; $('tEn').value = t.energy;
  $('tCarrier').value = t.carrier; $('tBat').value = t.battery;
  $('tTitle').value = t.title; $('tBlue').value = t.blue; $('tAsk').value = t.ask;
  $('tSub').value = t.sub; $('tSlide').value = t.slide;
  $('tLines').value = t.lines; $('tOpts').value = t.optStay + '\n' + t.optLeave;
  Theme.apply();
}
for (const [id, vid, key] of [['tGs','vGs','gs'],['tCt','vCt','ct'],['tBr','vBr','br'],['tTex','vTex','tex']]) {
  $(id).addEventListener('input', () => {
    D.theme[key] = +$(id).value;
    $(vid).textContent = (+$(id).value).toFixed(2);
    document.documentElement.style.setProperty('--' + key, D.theme[key]);
  });
  $(id).addEventListener('change', () => Store.save());
}
$('btnThemeSave').onclick = () => {
  const t = D.theme;
  t.nick = $('tNick').value.trim() || '純白';
  t.sign = $('tSign').value; t.energy = clamp(+$('tEn').value || 0, 0, 100);
  t.carrier = $('tCarrier').value; t.battery = clamp(+$('tBat').value || 1, 1, 100);
  t.title = $('tTitle').value; t.blue = $('tBlue').value; t.ask = $('tAsk').value;
  t.sub = $('tSub').value; t.slide = $('tSlide').value || 'slide to stay';
  t.lines = $('tLines').value;
  const o = $('tOpts').value.split('\n');
  t.optStay = (o[0] || '滯在').trim(); t.optLeave = (o[1] || '離れる').trim();
  Store.save(); Theme.apply(); paintSetRoot(); toast('主题已保存');
};
const wallPick = (key, title) => () => Picker.open(title, id => {
  D.theme[key] = id; Store.save(); Theme.apply(); Home.paint(); toast('已应用');
});
$('btnLockWall').onclick = wallPick('lockWall', '選擇鎖屏壁紙');
$('btnHomeWall').onclick = wallPick('homeWall', '選擇桌面壁紙');
$('btnBandWall').onclick = wallPick('bandWall', '選擇橫幅組件圖');
$('btnAvatar').onclick = wallPick('avatar', '選擇頭像');

function paintIcons() {
  const box = $('iconRows');
  box.textContent = '';
  for (const app of APPS) {
    const row = document.createElement('div');
    row.className = 'item';
    const th = document.createElement('div');
    th.className = 'ith';
    const u = ImgStore.url(D.icons[app.k]);
    if (u) th.appendChild(imgEl(u));
    const t = document.createElement('span');
    t.className = 'it';
    t.textContent = D.iconNames[app.k] || app.label;
    const s = document.createElement('span');
    s.className = 'is';
    s.textContent = D.icons[app.k] ? '已自定義' : '默認';
    row.append(th, t, s);
    row.onclick = () => sheet([
      { label: '選擇圖標素材', hi: true, run: () => Picker.open('選擇 ' + app.label + ' 圖標', id => {
          D.icons[app.k] = id; Store.save(); Home.paint(); Net.paint(); paintIcons(); toast('图标已更换');
        }) },
      { label: '重命名', run: () => {
          const v = prompt('图标名称', D.iconNames[app.k] || app.label);
          if (v === null) return;
          D.iconNames[app.k] = v.trim() || app.label;
          Store.save(); Home.paint(); paintIcons();
        } },
      { label: '恢復默認', run: () => {
          delete D.icons[app.k]; delete D.iconNames[app.k];
          Store.save(); Home.paint(); Net.paint(); paintIcons();
        } }
    ]);
    box.appendChild(row);
  }
}

function paintApi() {
  $('apiProvider').value = D.cfg.provider; $('apiBase').value = D.cfg.base;
  $('apiKey').value = D.cfg.key; $('apiModel').value = D.cfg.model;
  $('apiStream').checked = !!D.cfg.stream;
  $('apiNote').textContent = {
    openai: 'OpenAI 官方及绝大多数中转（One API / New API 等）。Base URL 填到 /v1 为止。',
    claude: 'Base URL 填 https://api.anthropic.com。浏览器直连已自动带上 anthropic-dangerous-direct-browser-access 头。',
    gemini: 'Base URL 填 https://generativelanguage.googleapis.com/v1beta。'
  }[D.cfg.provider];
}
function readApi() {
  D.cfg.provider = $('apiProvider').value; D.cfg.base = $('apiBase').value.trim();
  D.cfg.key = $('apiKey').value.trim(); D.cfg.model = $('apiModel').value.trim();
  D.cfg.stream = $('apiStream').checked;
  Store.save(); paintSetRoot();
}
['apiProvider','apiBase','apiKey','apiModel','apiStream'].forEach(id =>
  $(id).addEventListener('change', () => { readApi(); if (id === 'apiProvider') paintApi(); }));
$('btnModels').onclick = async () => {
  readApi(); toast('正在拉取…');
  try {
    const list = await API.models(D.cfg);
    const sel = $('modelList');
    sel.textContent = '';
    for (const m of list) { const o = document.createElement('option'); o.value = o.textContent = m; sel.appendChild(o); }
    sel.hidden = false;
    sel.onchange = () => { $('apiModel').value = sel.value; readApi(); };
    toast(`共 ${list.length} 个模型，点选即填入`);
  } catch (err) { toast('拉取失败：' + String(err.message || err).slice(0, 100)); }
};
$('btnTest').onclick = async () => {
  readApi(); toast('测试中…');
  const built = { blocks: [{ role: 'system', content: '你是测试助手。' }],
                  history: [{ role: 'user', content: '回复两个字：收到' }], tail: [] };
  try {
    let got = '';
    await API.stream(built, D.cfg, { ...D.preset.params, max_tokens: 32 }, { onDelta: d => got += d });
    toast('连通成功：' + (got.trim().slice(0, 40) || '(空回复)'));
  } catch (err) { toast('失败：' + String(err.message || err).slice(0, 130)); }
};

function paintPreset() {
  const p = D.preset.params;
  $('pTemp').value = p.temperature; $('pMax').value = p.max_tokens; $('pTopP').value = p.top_p;
  $('pFreq').value = p.frequency_penalty; $('pPres').value = p.presence_penalty; $('pCtx').value = p.context_tokens;
  const box = $('promptBlocks');
  box.textContent = '';
  D.preset.prompts.forEach((blk, i) => {
    const row = document.createElement('div');
    row.className = 'pb';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = blk.enabled !== false;
    cb.onchange = () => { blk.enabled = cb.checked; Store.save(); };
    const nm = document.createElement('span');
    nm.className = 'pn'; nm.textContent = blk.name + (blk.marker ? '（佔位）' : '');
    const up = document.createElement('span');
    up.className = 'mv'; up.textContent = '↑';
    up.onclick = () => { if (i > 0) { const a = D.preset.prompts; [a[i-1], a[i]] = [a[i], a[i-1]]; Store.save(); paintPreset(); } };
    const dn = document.createElement('span');
    dn.className = 'mv'; dn.textContent = '↓';
    dn.onclick = () => { const a = D.preset.prompts; if (i < a.length - 1) { [a[i+1], a[i]] = [a[i], a[i+1]]; Store.save(); paintPreset(); } };
    row.append(cb, nm, up, dn);
    box.appendChild(row);
    if (!blk.marker) {
      const w = document.createElement('div');
      w.className = 'pbe';
      const ta = document.createElement('textarea');
      ta.value = blk.content || '';
      ta.oninput = () => { blk.content = ta.value; };
      ta.onblur = () => Store.save();
      w.appendChild(ta);
      box.appendChild(w);
    }
  });
}
$('btnPresetSave').onclick = () => {
  const p = D.preset.params;
  p.temperature = +$('pTemp').value; p.max_tokens = +$('pMax').value; p.top_p = +$('pTopP').value;
  p.frequency_penalty = +$('pFreq').value; p.presence_penalty = +$('pPres').value; p.context_tokens = +$('pCtx').value;
  Store.save(); toast('预设已保存');
};

let editChar = null;
function paintCharList() {
  const box = $('charList');
  box.textContent = '';
  for (const c of D.chars) {
    const row = document.createElement('div');
    row.className = 'item';
    const th = document.createElement('div');
    th.className = 'ith';
    if (c.avatar) th.appendChild(imgEl(c.avatar));
    const t = document.createElement('span');
    t.className = 'it'; t.textContent = c.name;
    const s = document.createElement('span');
    s.className = 'is'; s.textContent = (D.chats[c.id]?.length || 0) + ' 條';
    row.append(th, t, s);
    row.onclick = () => openCharEdit(c.id);
    box.appendChild(row);
  }
  if (!D.chars.length) {
    const n = document.createElement('div');
    n.className = 'note'; n.textContent = '还没有角色卡。点右上「新建」，或导入 PNG / JSON。';
    box.appendChild(n);
  }
}
function openCharEdit(id) {
  const c = id ? Store.char(id) : blankChar();
  if (!id) { D.chars.push(c); Store.save(); }
  editChar = c;
  $('cName').value = c.name; $('cSign').value = c.sign || '';
  $('cDesc').value = c.description; $('cPers').value = c.personality;
  $('cScen').value = c.scenario; $('cFirst').value = c.first_mes;
  $('cExam').value = c.mes_example; $('cSys').value = c.system_prompt || '';
  $('cPost').value = c.post_history_instructions || '';
  const p = $('cAvPrev');
  p.textContent = '';
  if (c.avatar) p.appendChild(imgEl(c.avatar)); else p.textContent = '無';
  const sel = $('cBooks');
  sel.textContent = '';
  for (const b of D.books) {
    const o = document.createElement('option');
    o.value = b.id; o.textContent = b.name;
    o.selected = (c.bookIds || []).includes(b.id);
    sel.appendChild(o);
  }
  Nav.push('setCharEdit');
}
$('btnCharNew').onclick = () => openCharEdit(null);
$('btnCharSave').onclick = () => {
  const c = editChar;
  if (!c) return;
  c.name = $('cName').value.trim() || '未命名';
  c.sign = $('cSign').value; c.description = $('cDesc').value;
  c.personality = $('cPers').value; c.scenario = $('cScen').value;
  c.first_mes = $('cFirst').value; c.mes_example = $('cExam').value;
  c.system_prompt = $('cSys').value; c.post_history_instructions = $('cPost').value;
  c.bookIds = [...$('cBooks').selectedOptions].map(o => o.value);
  Store.save(); paintCharList(); paintSetRoot(); Chat.paintContacts();
  toast('已保存');
};
$('btnCAv').onclick = () => $('cAvFile').click();
$('cAvFile').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || !editChar) return;
  editChar.avatar = await CardIO.thumb(f);
  Store.save();
  const p = $('cAvPrev');
  p.textContent = '';
  if (editChar.avatar) p.appendChild(imgEl(editChar.avatar));
  Chat.paintContacts(); paintCharList();
};
$('btnCharDel').onclick = () => {
  if (!editChar) return;
  sheet([{ label: '確認刪除「' + editChar.name + '」', danger: true, run: () => {
    D.chars = D.chars.filter(x => x.id !== editChar.id);
    delete D.chats[editChar.id];
    if (Chat.charId === editChar.id) Chat.charId = null;
    editChar = null;
    Store.save(); Nav.back(); paintCharList(); paintSetRoot(); Chat.paintContacts();
  } }]);
};
$('btnCharExp').onclick = () => {
  if (!editChar) return;
  const c = editChar;
  download(c.name + '.json', JSON.stringify({
    spec: 'chara_card_v2', spec_version: '2.0',
    data: {
      name: c.name, description: c.description, personality: c.personality, scenario: c.scenario,
      first_mes: c.first_mes, mes_example: c.mes_example, system_prompt: c.system_prompt,
      post_history_instructions: c.post_history_instructions, creator_notes: c.sign,
      alternate_greetings: [], tags: [], character_book: bookToV2(c.bookIds?.[0])
    }
  }, null, 2));
};
$('btnCharImp').onclick = () => $('charImport').click();
$('charImport').onchange = async e => {
  const files = [...e.target.files];
  e.target.value = '';
  for (const f of files) {
    try {
      const r = await CardIO.fromFile(f);
      if (r.bookOnly) { D.books.push(r.bookOnly); toast('導入世界書：' + r.bookOnly.name); continue; }
      if (r.book) D.books.push(r.book);
      D.chars.push(r.char);
      toast('導入角色：' + r.char.name);
    } catch (err) { toast(f.name + ' 導入失敗：' + String(err.message || err).slice(0, 70)); }
  }
  Store.save(); paintCharList(); paintSetRoot(); Chat.paintContacts();
};

let editBook = null, editEntry = null;
function paintBookList() {
  const box = $('bookList');
  box.textContent = '';
  for (const b of D.books) {
    const row = document.createElement('div');
    row.className = 'item';
    const tg = document.createElement('span');
    tg.className = 'tg ' + (b.enabled === false ? 'c' : 'a');
    tg.textContent = b.enabled === false ? '停用' : '啟用';
    const t = document.createElement('span');
    t.className = 'it'; t.textContent = b.name;
    const s = document.createElement('span');
    s.className = 'is'; s.textContent = (b.entries || []).length + ' 條';
    row.append(tg, t, s);
    row.onclick = () => openBookEdit(b.id);
    box.appendChild(row);
  }
  if (!D.books.length) {
    const n = document.createElement('div');
    n.className = 'note'; n.textContent = '还没有世界书。点右上「新建」，或导入 ST 导出的 JSON。';
    box.appendChild(n);
  }
}
function openBookEdit(id) {
  const b = id ? Store.book(id) : blankBook();
  if (!id) { D.books.push(b); Store.save(); }
  editBook = b;
  $('bName').value = b.name;
  $('bScan').value = b.scanDepth || 4;
  $('bEnabled').checked = b.enabled !== false;
  paintEntryList();
  Nav.push('setBookEdit');
}
function paintEntryList() {
  const box = $('entryList');
  box.textContent = '';
  for (const e of (editBook.entries || [])) {
    const row = document.createElement('div');
    row.className = 'item';
    const tg = document.createElement('span');
    tg.className = 'tg ' + (e.enabled === false ? 'c' : e.constant ? 'b' : 'a');
    tg.textContent = e.enabled === false ? '停用' : e.constant ? '常駐' : '關鍵詞';
    const t = document.createElement('span');
    t.className = 'it'; t.textContent = e.comment || (e.keys || []).join('/') || '(無名)';
    const s = document.createElement('span');
    s.className = 'is'; s.textContent = 'order ' + (e.order ?? 100);
    row.append(tg, t, s);
    row.onclick = () => openEntryEdit(e.id);
    box.appendChild(row);
  }
  if (!(editBook.entries || []).length) {
    const n = document.createElement('div');
    n.className = 'note'; n.textContent = '这本世界书还没有条目。点右上「加條目」。';
    box.appendChild(n);
  }
}
function openEntryEdit(id) {
  let e = (editBook.entries || []).find(x => x.id === id);
  if (!e) { e = blankEntry(); (editBook.entries ||= []).push(e); Store.save(); }
  editEntry = e;
  $('eComment').value = e.comment;
  $('eConst').checked = !!e.constant;
  $('eEnabled').checked = e.enabled !== false;
  $('eKeys').value = (e.keys || []).join(', ');
  $('eKeys2').value = (e.keys2 || []).join(', ');
  $('eContent').value = e.content;
  $('ePos').value = e.position || 'before_char';
  $('eDepth').value = e.depth ?? 4;
  $('eOrder').value = e.order ?? 100;
  $('eProb').value = clamp(+$('eProb').value, 0, 100);
  $('eCase').checked = !!e.caseSensitive;
  Nav.push('setEntryEdit');
}
const splitKeys = s => s.split(/[,，]/).map(x => x.trim()).filter(Boolean);
$('btnBookNew').onclick = () => openBookEdit(null);
$('btnBookSave').onclick = () => {
  const b = editBook;
  if (!b) return;
  b.name = $('bName').value.trim() || '未命名';
  b.scanDepth = Math.max(1, +$('bScan').value || 4);
  b.enabled = $('bEnabled').checked;
  Store.save(); paintBookList(); paintSetRoot(); toast('已保存');
};
$('btnBookDel').onclick = () => {
  if (!editBook) return;
  sheet([{ label: '確認刪除「' + editBook.name + '」', danger: true, run: () => {
    const id = editBook.id;
    D.books = D.books.filter(x => x.id !== id);
    D.chars.forEach(c => c.bookIds = (c.bookIds || []).filter(x => x !== id));
    editBook = null;
    Store.save(); Nav.back(); paintBookList(); paintSetRoot();
  } }]);
};
$('btnBookExp').onclick = () => {
  if (!editBook) return;
  download(editBook.name + '.json', JSON.stringify(bookToV2ById(editBook), null, 2));
};
$('btnEntryNew').onclick = () => openEntryEdit(null);
$('btnEntrySave').onclick = () => {
  const e = editEntry;
  if (!e) return;
  e.comment = $('eComment').value.trim() || '條目';
  e.constant = $('eConst').checked;
  e.enabled = $('eEnabled').checked;
  e.keys = splitKeys($('eKeys').value);
  e.keys2 = splitKeys($('eKeys2').value);
  e.content = $('eContent').value;
  e.position = $('ePos').value;
  e.depth = +$('eDepth').value || 0;
  e.order = +$('eOrder').value || 0;
  e.probability = clamp(+$('eProb').value, 0, 100);
  e.caseSensitive = $('eCase').checked;
  Store.save(); paintEntryList(); Nav.back(); toast('條目已保存');
};
$('btnEntryDel').onclick = () => {
  if (!editEntry) return;
  editBook.entries = editBook.entries.filter(x => x.id !== editEntry.id);
  editEntry = null;
  Store.save(); Nav.back(); paintEntryList();
};
$('btnBookImp').onclick = () => $('bookImport').click();
$('bookImport').onchange = async e => {
  const files = [...e.target.files];
  e.target.value = '';
  for (const f of files) {
    try {
      D.books.push(CardIO.bookFromJson(JSON.parse(await f.text()), f.name));
      toast('已導入 ' + f.name);
    } catch (err) { toast(f.name + ' 解析失敗'); }
  }
  Store.save(); paintBookList(); paintSetRoot();
};
function bookToV2ById(b) {
  return {
    name: b.name, scan_depth: b.scanDepth,
    entries: (b.entries || []).map((e, i) => ({
      id: i, comment: e.comment, keys: e.keys, secondary_keys: e.keys2, content: e.content,
      constant: e.constant, enabled: e.enabled !== false, insertion_order: e.order,
      position: e.position, depth: e.depth, probability: e.probability, case_sensitive: e.caseSensitive
    }))
  };
}
function bookToV2(id) { const b = Store.book(id); return b ? bookToV2ById(b) : undefined; }

function paintPersona() {
  $('uName').value = D.persona.name || '';
  $('uDesc').value = D.persona.description || '';
}
$('btnPersonaSave').onclick = () => {
  D.persona.name = $('uName').value.trim() || '我';
  D.persona.description = $('uDesc').value;
  Store.save(); paintSetRoot(); toast('已保存');
};

function paintData() {
  const size = new Blob([localStorage.getItem(NS) || '']).size;
  const msgs = Object.values(D.chats).reduce((n, a) => n + a.length, 0);
  $('dataStat').textContent =
    `角色 ${D.chars.length} 張 · 世界書 ${D.books.length} 本 · 消息 ${msgs} 條 · 素材 ${D.assets.length} 張\n`
    + `設定占用約 ${(size / 1024).toFixed(1)} KB · 圖片存於 ${ImgStore.mode === 'idb' ? 'IndexedDB' : 'localStorage'}`;
  $('dataStat').style.whiteSpace = 'pre-line';
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$(
'btnExp').onclick = () =>
 {
  const out = JSON.parse(JSON.stringify
(D));
  download('purewhite-backup.json', JSON.stringify(out, null, 2
));
};

$(
'btnImpBtn').onclick = () => $('impAll').click
();
$(
'impAll').onchange = async
 e => {
  const f = e.target.files[0
];
  e.
target.value = ''
;
  if (!f) return
;
  try
 {
    const raw = JSON.parse(await f.text
());
    if (!raw.chars) throw new Error('不是本應用的備份文件'
);
    Store.data = raw; Store.save
();
    toast('導入成功，即將刷新'
);
    setTimeout(() => location.reload(), 800
);
  } 
catch (err) { toast('導入失敗：' + String(err.message || err).slice(0, 70
)); }
};

$(
'btnWipe').onclick = () => sheet([{ label: '確認清空全部數據（不可恢復）', danger: true, run: async
 () => {
  for (const a of D.assets) await ImgStore.del(a.id).catch(() =>
 {});
  localStorage.removeItem(NS
);
  location.
reload
();
} }]);

/* ══════════════════ 启动入口 ══════════════════ */
(
async function boot(
) {
  await ImgStore.init
();
  D = 
Store.load
();
  // 预解析全部素材 URL，之后所有渲染直接同步取用
  for (const a of D.assets) await ImgStore.resolve(a.id
);
  Lock.init
();
  Pager.init
();
  Home.paint
();
  Theme.apply
();
  Chat.paintContacts
();
  startClock
();
  if (!D.cfg.key) setTimeout(() => toast('解鎖後到「設定 → 接口與模型」填 Key'), 1200
);
})();
