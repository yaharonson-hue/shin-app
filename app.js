/* שעשועון השין: daily ש practice for an 8-year-old.
   No server. Progress lives in localStorage; drawings and recordings in IndexedDB. */
(() => {
  'use strict';

  const D = window.SHIN_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---------------- dates ---------------- */
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return dayKey(d); };
  const today = () => dayKey();
  const shortDate = (k) => { const d = keyToDate(k); return `${d.getDate()}.${d.getMonth() + 1}`; };
  const mmss = (sec) => { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${pad(sec % 60)}`; };
  const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  /* ---------------- text: finding the ש ---------------- */
  // Numbers hide sounds too: 500 is read "חמש מאות". Words starting with * are שׂ (sounds like ס).
  const HEB_U = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
  const HEB_T = ['', '*עשר', '*עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
  const HEB_H = ['', 'מאה', 'מאתיים', 'שלוש מאות', 'ארבע מאות', 'חמש מאות', 'שש מאות', 'שבע מאות', 'שמונה מאות', 'תשע מאות'];
  function numberInfo(n) {
    if (!(n > 0 && n < 1000)) return null;
    const parts = [];
    const h = Math.floor(n / 100), rest = n % 100, t = Math.floor(rest / 10), u = rest % 10;
    if (h) parts.push(HEB_H[h]);
    if (rest >= 11 && rest <= 19) parts.push(`${HEB_U[u]} *עשרה`);
    else { if (t) parts.push(HEB_T[t]); if (u) parts.push(HEB_U[u]); }
    const words = parts.join(' ').split(' ');
    return {
      hasShin: words.some((w) => !w.startsWith('*') && w.includes('ש')),
      words: parts.map((p) => p.replace(/\*/g, '')).join(' ו'),
    };
  }
  function tokenize(text) {
    return text.trim().split(/\s+/).map((raw) => {
      const sin = raw.startsWith('*');
      const t = sin ? raw.slice(1) : raw;
      const digits = t.match(/\d+/);
      const num = digits ? numberInfo(Number(digits[0])) : null;
      const letters = !sin && /ש/.test(t);
      const numShin = !sin && !!(num && num.hasShin);
      return { t, sin, letters, num: numShin ? num.words : null, shin: letters || numShin };
    });
  }
  const plainText = (text) => text.replace(/(^|\s)\*/g, '$1');
  function wordHTML(tok, lit) {
    let h = esc(tok.t);
    if (!lit || !tok.shin) return h;
    if (tok.letters) h = h.replace(/ש[֑-ׇ]*/g, (m) => `<span class="sh">${m}</span>`);
    if (tok.num) h = h.replace(/\d+/, (m) => `<span class="sh">${m}</span>`);
    return h;
  }
  const litSentence = (text) => tokenize(text).map((t) => wordHTML(t, true)).join(' ');
  const shinMark = (text) => esc(text).replace(/ש[֑-ׇ]*/g, (m) => `<span class="sh">${m}</span>`);
  const autoLevel = (tokens) => { const n = tokens.length, sh = tokens.filter((t) => t.shin).length; return n <= 6 ? 1 : (sh >= 7 || n >= 12) ? 3 : 2; };
  const hasMix = (text, tokens) => /[סצץ]/.test(plainText(text)) || tokens.some((t) => t.sin);
  function chunkify(tokens) {
    const out = []; let cur = [];
    tokens.forEach((t, i) => { cur.push(i); if (cur.length >= 3 || /[.?!,]$/.test(t.t)) { out.push(cur); cur = []; } });
    if (cur.length) { if (cur.length === 1 && out.length) out[out.length - 1].push(...cur); else out.push(cur); }
    return out;
  }
  const hashId = (s) => { let h = 5381; for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return 's' + h.toString(36); };

  const LEVEL_NAMES = { 1: 'קל', 2: 'בינוני', 3: '👑 שלב בוס' };
  const STATUS = ['חדש', 'מתאמנת', 'כמעט שם', '⭐ שולטת'];
  const BOX_GAP = [0, 1, 2, 5]; // days until a sentence comes back, by box

  /* ---------------- state ---------------- */
  const KEY = 'shin-app.v1';
  const defaultSentences = () => D.sentences.map((s) => ({ id: hashId(s.t), t: s.t, e: s.e, l: s.l }));
  const defaults = () => ({
    v: 1, name: '', minutes: 20, perSession: 4, cue: 'שפתיים קדימה כמו נשיקה 😗',
    sentences: defaultSentences(), stats: {}, days: {}, bones: 0, listen: { ok: 0, all: 0 },
  });
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); if (s && Array.isArray(s.sentences) && s.sentences.length) return Object.assign(defaults(), s); }
    } catch (e) { /* storage blocked: run with defaults */ }
    return defaults();
  }
  let state = load();
  let saveTimer = 0;
  function save(now = false) {
    clearTimeout(saveTimer);
    const write = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* full or blocked */ } };
    if (now) write(); else saveTimer = setTimeout(write, 300);
  }
  const stat = (id) => (state.stats[id] ||= { box: 0, g: 0, y: 0, r: 0, seen: null, due: null, hist: [] });
  const dayRec = (k = today()) => (state.days[k] ||= { sec: 0, g: 0, y: 0, r: 0, ids: [] });
  const sentenceById = (id) => state.sentences.find((s) => s.id === id);
  const practiced = (k) => { const d = state.days[k]; return !!d && (d.sec >= 60 || d.g + d.y + d.r > 0); };
  function streak() { let k = today(); if (!practiced(k)) k = addDays(k, -1); let n = 0; while (practiced(k)) { n++; k = addDays(k, -1); } return n; }

  /* ---------------- blob store (IndexedDB, ArrayBuffers for Safari) ---------------- */
  const blobs = (() => {
    const mem = new Map();
    let dbp = null;
    const open = () => (dbp ||= new Promise((res) => {
      try {
        const r = indexedDB.open('shin-app', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('blobs');
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    }));
    const req = async (mode, fn) => {
      const db = await open();
      if (!db) return undefined;
      return new Promise((res) => {
        try {
          const r = fn(db.transaction('blobs', mode).objectStore('blobs'));
          r.onsuccess = () => res(r.result);
          r.onerror = () => res(undefined);
        } catch (e) { res(undefined); }
      });
    };
    return {
      async get(k) {
        const v = await req('readonly', (st) => st.get(k));
        if (v && v.buf) return new Blob([v.buf], { type: v.type });
        return mem.get(k) || null;
      },
      async put(k, blob) {
        mem.set(k, blob);
        const buf = await blob.arrayBuffer();
        await req('readwrite', (st) => st.put({ type: blob.type, buf }, k));
        if (await open()) mem.delete(k);
      },
      async del(k) { mem.delete(k); await req('readwrite', (st) => st.delete(k)); },
      async keys(prefix = '') {
        const ks = await req('readonly', (st) => (prefix ? st.getAllKeys(IDBKeyRange.bound(prefix, prefix + '￿')) : st.getAllKeys()));
        const all = new Set([...(ks || []), ...[...mem.keys()].filter((k) => k.startsWith(prefix))]);
        return [...all].sort();
      },
    };
  })();

  /* ---------------- sound ---------------- */
  let actx = null;
  function audioCtx() {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); }
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  function ding(kind) {
    const ctx = audioCtx(); if (!ctx) return;
    const notes = { good: [660, 880], win: [523, 659, 784, 1046], oops: [330, 262], tap: [600] }[kind] || [600];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const t = ctx.currentTime + i * 0.11;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.25);
    });
  }

  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  const MIME = (() => {
    if (!window.MediaRecorder) return '';
    for (const m of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac']) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* ignore */ } }
    return '';
  })();

  // The mic is released after every recording so playback is at full volume on iPad.
  const recorder = {
    rec: null, stream: null, chunks: [], raf: 0, src: null,
    get active() { return !!this.rec; },
    async start(meterEl) {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
      this.chunks = [];
      this.rec = new MediaRecorder(this.stream, MIME ? { mimeType: MIME } : undefined);
      this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.rec.start();
      const ctx = audioCtx();
      if (ctx && meterEl) {
        try {
          this.src = ctx.createMediaStreamSource(this.stream);
          const an = ctx.createAnalyser(); an.fftSize = 512; this.src.connect(an);
          const data = new Uint8Array(an.fftSize);
          const tick = () => {
            an.getByteTimeDomainData(data);
            let m = 0; for (let i = 0; i < data.length; i++) m = Math.max(m, Math.abs(data[i] - 128));
            meterEl.style.width = Math.min(100, (m / 128) * 220) + '%';
            this.raf = requestAnimationFrame(tick);
          };
          tick();
        } catch (e) { /* meter is optional */ }
      }
    },
    stop() {
      return new Promise((resolve) => {
        const r = this.rec;
        if (!r) return resolve(null);
        r.onstop = () => { const blob = new Blob(this.chunks, { type: r.mimeType || MIME || 'audio/mp4' }); this.cleanup(); resolve(blob.size ? blob : null); };
        try { r.stop(); } catch (e) { this.cleanup(); resolve(null); }
      });
    },
    cleanup() {
      cancelAnimationFrame(this.raf);
      try { if (this.src) this.src.disconnect(); } catch (e) { /* ignore */ }
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      this.src = null; this.stream = null; this.rec = null;
    },
  };

  let curEl = null, curSrc = null;
  function stopAudio() {
    if (curEl) { try { curEl.pause(); } catch (e) { /* ignore */ } curEl = null; }
    if (curSrc) { try { curSrc.stop(); } catch (e) { /* ignore */ } curSrc = null; }
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  }
  async function playViaContext(blob) {
    const ctx = audioCtx(); if (!ctx) return;
    try {
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      await new Promise((res) => { const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); curSrc = s; s.onended = () => { if (curSrc === s) curSrc = null; res(); }; s.start(); });
    } catch (e) { /* undecodable */ }
  }
  function playBlob(blob) {
    stopAudio();
    return new Promise((res) => {
      const url = URL.createObjectURL(blob);
      const a = new Audio(url); curEl = a;
      const done = () => { URL.revokeObjectURL(url); if (curEl === a) curEl = null; res(); };
      a.onended = done; a.onerror = () => { URL.revokeObjectURL(url); playViaContext(blob).then(res); };
      a.play().catch(() => { URL.revokeObjectURL(url); curEl = null; playViaContext(blob).then(res); });
    });
  }

  let heVoice = null;
  function pickVoice() { try { heVoice = speechSynthesis.getVoices().find((v) => /^he/i.test(v.lang)) || null; } catch (e) { heVoice = null; } }
  if ('speechSynthesis' in window) { pickVoice(); try { speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { /* ignore */ } }
  function speak(text, rate = 0.85) {
    return new Promise((res) => {
      if (!heVoice) return res(false);
      stopAudio();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = heVoice; u.lang = heVoice.lang; u.rate = rate;
      u.onend = () => res(true); u.onerror = () => res(false);
      speechSynthesis.speak(u);
    });
  }

  /* ---------------- small UI helpers ---------------- */
  const app = $('#app');
  const modalEl = $('#modal');
  function modal(html) { modalEl.innerHTML = html; modalEl.hidden = false; }
  function closeModal() { modalEl.hidden = true; modalEl.innerHTML = ''; }
  function confirmBox(title, text, ok = 'כן', cancel = 'ביטול') {
    return new Promise((res) => {
      modal(`<div class="modal-box" role="dialog" aria-modal="true"><h2>${esc(title)}</h2>${text ? `<p class="lead">${esc(text)}</p>` : ''}<div class="row center"><button class="btn go" id="m-ok" type="button">${esc(ok)}</button><button class="btn" id="m-cancel" type="button">${esc(cancel)}</button></div></div>`);
      $('#m-ok').onclick = () => { closeModal(); res(true); };
      $('#m-cancel').onclick = () => { closeModal(); res(false); };
    });
  }
  let toastT = 0;
  function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms); }
  function confetti(symbols = ['🦴', '🐾', '⭐', '🎉']) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = $('#confetti'); const ctx = c.getContext('2d'); const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const ps = Array.from({ length: 40 }, () => ({ x: Math.random() * innerWidth, y: -30 - Math.random() * innerHeight * 0.5, vy: 2 + Math.random() * 3, vx: -1 + Math.random() * 2, r: Math.random() * 6, vr: -0.06 + Math.random() * 0.12, s: symbols[rand(symbols.length)], size: 22 + rand(18) }));
    const t0 = performance.now();
    const frame = (t) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.font = `${p.size}px serif`; ctx.fillText(p.s, 0, 0); ctx.restore(); }
      if (t - t0 < 2800) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    requestAnimationFrame(frame);
  }
  function holdButton(el, fn, ms = 1400) {
    let t = 0;
    const end = () => { clearTimeout(t); el.classList.remove('holding'); };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('holding'); t = setTimeout(() => { end(); fn(); }, ms); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, end));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(b); });
  async function blobToImage(b) {
    if (window.createImageBitmap) { try { return await createImageBitmap(b); } catch (e) { /* fall back */ } }
    return new Promise((res) => { const u = URL.createObjectURL(b); const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = u; });
  }

  /* ---------------- mascot: Shoko the dog (or her own drawing) ---------------- */
  function dogSVG(mouth = 'happy') {
    const m = mouth === 'shh'
      ? '<ellipse cx="100" cy="143" rx="8" ry="9" fill="#5A2E2E" stroke="#D9707E" stroke-width="5"/>'
      : '<path d="M100 129 L100 136 M86 136 Q100 148 114 136" fill="none" stroke="#3B2416" stroke-width="4" stroke-linecap="round"/><path d="M94 142 Q100 162 106 142 Z" fill="#F07C8C"/>';
    return `<svg viewBox="0 0 200 200" role="img" aria-label="שוקו הכלב">
      <path d="M50 66 C18 70 16 132 40 144 C57 152 62 112 68 84 Z" fill="#5C3A21"/>
      <path d="M150 66 C182 70 184 132 160 144 C143 152 138 112 132 84 Z" fill="#5C3A21"/>
      <ellipse cx="100" cy="104" rx="58" ry="55" fill="#A86B3C"/>
      <ellipse cx="124" cy="93" rx="20" ry="17" fill="#7A4A26"/>
      <ellipse cx="100" cy="133" rx="34" ry="24" fill="#F3D7B5"/>
      <circle cx="70" cy="123" r="7" fill="#F09A8A" opacity=".55"/><circle cx="130" cy="123" r="7" fill="#F09A8A" opacity=".55"/>
      <circle cx="79" cy="96" r="8" fill="#1F2340"/><circle cx="82" cy="93" r="2.6" fill="#fff"/>
      <circle cx="122" cy="96" r="8" fill="#1F2340"/><circle cx="125" cy="93" r="2.6" fill="#fff"/>
      <ellipse cx="100" cy="121" rx="12" ry="8" fill="#2A1A10"/><ellipse cx="96" cy="118" rx="3.5" ry="2" fill="#fff" opacity=".6"/>
      ${m}
      <path d="M58 152 Q100 174 142 152 L140 164 Q100 186 60 164 Z" fill="#E8503F"/>
      <circle cx="100" cy="180" r="13" fill="#FFE45C" stroke="#B97A06" stroke-width="2"/>
      <text x="100" y="186" text-anchor="middle" font-size="17" font-weight="700" fill="#6C2BD9" font-family="Rubik, Arial, sans-serif">ש</text>
    </svg>`;
  }
  let mascotURL = null;
  async function loadMascot() { const b = await blobs.get('draw:mascot'); if (mascotURL) URL.revokeObjectURL(mascotURL); mascotURL = b ? URL.createObjectURL(b) : null; }
  const mascotHTML = (mouth = 'happy', bob = true) => `<div class="mascot${bob ? ' bob' : ''}">${mascotURL ? `<img src="${mascotURL}" alt="הדמות שלי">` : dogSVG(mouth)}</div>`;

  const picURLs = new Map();
  async function picURL(id) {
    if (picURLs.has(id)) return picURLs.get(id);
    const b = await blobs.get('draw:' + id);
    const u = b ? URL.createObjectURL(b) : null;
    picURLs.set(id, u); return u;
  }
  function invalidatePic(id) { const u = picURLs.get(id); if (u) URL.revokeObjectURL(u); picURLs.delete(id); }

  /* ---------------- choosing today's sentences ---------------- */
  function pickSentences(n, exclude) {
    const t = today();
    const order = new Map(state.sentences.map((s, i) => [s.id, i]));
    const list = state.sentences.filter((s) => !exclude.includes(s.id));
    const st = (s) => stat(s.id);
    const due = list.filter((s) => st(s).box > 0 && (!st(s).due || st(s).due <= t))
      .sort((a, b) => st(a).box - st(b).box || String(st(a).seen).localeCompare(String(st(b).seen)));
    const fresh = list.filter((s) => st(s).box === 0).sort((a, b) => a.l - b.l || order.get(a.id) - order.get(b.id));
    const later = list.filter((s) => st(s).box > 0 && st(s).due > t).sort((a, b) => st(a).box - st(b).box || st(a).due.localeCompare(st(b).due));
    const out = [];
    const take = (arr, max, bossCap) => {
      for (const s of arr) {
        if (out.length >= n || max <= 0) break;
        if (out.includes(s)) continue;
        if (bossCap && s.l === 3 && out.some((x) => x.l === 3)) continue;
        out.push(s); max--;
      }
    };
    take(due, n - 1, true); take(fresh, 2, true); take(due, n, true); take(fresh, n, true); take(later, n, true);
    take(due, n, false); take(fresh, n, false); take(later, n, false);
    return out.sort((a, b) => a.l - b.l);
  }

  /* ---------------- navigation ---------------- */
  let view = null;
  let leaveFns = [];
  const onLeave = (fn) => leaveFns.push(fn);
  const VIEWS = {};
  function go(name, arg) {
    leaveFns.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
    leaveFns = [];
    stopAudio();
    if (recorder.active) recorder.stop();
    view = name;
    window.scrollTo(0, 0);
    VIEWS[name](arg);
  }
  function startTicker() {
    const iv = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const d = dayRec(); d.sec++;
      if (d.sec % 5 === 0) save();
      if (view === 'session') updateClock();
    }, 1000);
    return () => clearInterval(iv);
  }

  /* ---------------- home ---------------- */
  function weekHTML() {
    const t = today(); const start = addDays(t, -keyToDate(t).getDay());
    let html = '';
    for (let i = 0; i < 7; i++) {
      const k = addDays(start, i); const d = state.days[k]; const mins = d ? Math.round(d.sec / 60) : 0;
      html += `<div class="day${practiced(k) ? ' done' : ''}${k === t ? ' is-today' : ''}"><span class="dn">${DAY_LETTERS[i]}</span><span class="paw">🐾</span><span class="mins">${mins ? mins + ' דק׳' : ''}</span>${i === 5 ? '<span class="tag">קלינאית</span>' : ''}</div>`;
    }
    return html;
  }
  VIEWS.home = () => {
    const d = state.days[today()]; const sec = d ? d.sec : 0; const target = state.minutes * 60;
    const mastered = state.sentences.filter((s) => stat(s.id).box >= 3).length;
    const doneToday = sec >= target;
    app.innerHTML = `
      <header class="home-top">
        ${mascotHTML('happy')}
        <div class="bubble">היי ${esc(state.name || '')}! ${doneToday ? 'היום כבר התאמנת. כל הכבוד! 🎉' : 'מוכנה לשששש? 🐾'}
          <small>${mascotURL ? 'הדמות שלך' : 'אני שוקו'}, ואני אוהב לשמוע ש׳ אמיתית.</small></div>
      </header>
      <section class="stats" aria-label="ההתקדמות שלי">
        <div class="stat"><b>${streak()}</b><span>🐾 ימים ברצף</span></div>
        <div class="stat"><b>${state.bones}</b><span>🦴 עצמות לשוקו</span></div>
        <div class="stat"><b>${mastered}/${state.sentences.length}</b><span>⭐ משפטים בשליטה</span></div>
      </section>
      <section class="today">
        <div class="today-head"><h2>השבוע שלי</h2><span>היום: ${Math.floor(sec / 60)} מתוך ${state.minutes} דקות</span></div>
        <div class="bar"><i style="width:${Math.min(100, (sec / target) * 100)}%"></i></div>
        <div class="week">${weekHTML()}</div>
      </section>
      <div class="home-actions">
        <button class="btn big go" id="start" type="button">מתחילים! ⏱️ ${state.minutes} דקות</button>
        <div class="row">
          <button class="btn" id="album" type="button">🎨 האלבום שלי</button>
          <button class="btn ghost hold" id="parent" type="button"><span class="fill"></span>👪 להורים (לחיצה ארוכה)</button>
        </div>
      </div>`;
    $('#start').onclick = () => { audioCtx(); S = null; go('session'); };
    $('#album').onclick = () => go('album');
    holdButton($('#parent'), () => go('parent'));
  };

  /* ---------------- session ---------------- */
  let S = null;
  const STEPS = [['warm', 'חימום 🪞'], ['listen', 'הקשבה 👂'], ['sent', 'משפטים 🗣️'], ['draw', 'ציור 🎨'], ['done', 'סיום 🎉']];
  const STEP_RENDER = {};
  function newSession() {
    S = {
      step: 0, queue: pickSentences(state.perSession, []).map((s) => s.id), qi: 0, card: null,
      g: 0, y: 0, r: 0, warmIdx: 0, L: null, bannerShown: dayRec().sec >= state.minutes * 60,
    };
  }
  function endSession() { if (S && S.card) finalizeCard(S.card); S = null; save(true); }
  let wakeLock = null; // keeps the iPad screen on during a session
  async function requestWake() { try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* optional */ } }
  function releaseWake() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }

  VIEWS.session = () => {
    if (!S) newSession();
    app.innerHTML = `
      <div class="sbar">
        <button class="btn small ghost" id="exit" type="button">✕ יציאה</button>
        <nav class="steps" id="steps" aria-label="שלבי האימון"></nav>
        <div class="clock" id="clock" aria-label="זמן"><div class="bar"><i id="clock-bar"></i></div><b id="clock-t">0:00</b></div>
      </div>
      <div id="banner"></div>
      <main class="stage" id="stage"></main>`;
    $('#exit').onclick = async () => {
      if (S.step >= 4 || await confirmBox('לצאת מהאימון?', 'הדקות והחזרות כבר נשמרו.', 'לצאת', 'להישאר')) { endSession(); go('home'); }
    };
    const stopTick = startTicker();
    requestWake();
    onLeave(() => { stopTick(); releaseWake(); stopCamera(); });
    updateClock();
    renderStep();
  };
  function updateClock() {
    const el = $('#clock'); if (!el || !S) return;
    const d = dayRec(); const target = state.minutes * 60; const left = target - d.sec;
    $('#clock-t').textContent = left > 0 ? mmss(left) : '✓ ' + mmss(d.sec);
    $('#clock-bar').style.width = Math.min(100, (d.sec / target) * 100) + '%';
    el.classList.toggle('over', left <= 0);
    if (left <= 0 && !S.bannerShown) { S.bannerShown = true; showBanner(); }
  }
  function showBanner() {
    const b = $('#banner'); if (!b) return;
    b.innerHTML = `<div class="banner">⏰ הגעת ל-${state.minutes} דקות היום! כל הכבוד 🎉<span class="spacer"></span><button class="btn small good" id="b-draw" type="button">לציור ולסיום</button><button class="btn small ghost" id="b-close" type="button">עוד קצת</button></div>`;
    ding('win');
    $('#b-draw').onclick = () => { b.innerHTML = ''; gotoStep(3); };
    $('#b-close').onclick = () => { b.innerHTML = ''; };
  }
  function renderStep() {
    const nav = $('#steps');
    nav.innerHTML = STEPS.map(([, label], i) => `<button class="step${i === S.step ? ' on' : i < S.step ? ' past' : ''}" data-i="${i}" type="button">${label}</button>`).join('');
    $$('.step', nav).forEach((b) => { b.onclick = () => { const i = +b.dataset.i; if (i === 4 && S.step !== 4) return; gotoStep(i); }; });
    if (S.step !== 0) stopCamera();
    STEP_RENDER[STEPS[S.step][0]]($('#stage'));
  }
  function gotoStep(i) {
    if (S.card) { finalizeCard(S.card); S.card = null; }
    if (recorder.active) recorder.stop();
    stopAudio();
    S.step = i; renderStep(); window.scrollTo(0, 0);
  }
  const nextStepBtn = (label) => `<div class="row"><span class="spacer"></span><button class="btn go" id="next-step" type="button">${label}</button></div>`;

  /* warm-up in front of the mirror */
  let camStream = null;
  async function startCamera() {
    const video = $('#mirror'), off = $('#mirror-off');
    if (!video) return;
    try {
      if (!camStream) camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (!$('#mirror')) { stopCamera(); return; }
      video.srcObject = camStream; await video.play().catch(() => {});
      off.hidden = true;
    } catch (e) {
      off.hidden = false;
      $('p', off).textContent = 'אין גישה למצלמה. אפשר להתאמן גם מול מראה רגילה 🙂';
    }
  }
  function stopCamera() { if (camStream) camStream.getTracks().forEach((t) => t.stop()); camStream = null; }
  STEP_RENDER.warm = (stage) => {
    stage.innerHTML = `
      <div class="warm">
        <div class="mirror"><video id="mirror" playsinline muted autoplay></video>
          <div class="mirror-off" id="mirror-off"><span style="font-size:56px">🪞</span><p>המראה שלך: רואים בה את השפתיים</p><button class="btn small" id="cam" type="button">להדליק מראה</button></div></div>
        <section class="panel warm-card" id="warm-card"></section>
      </div>
      ${nextStepBtn('סיימתי חימום ←')}`;
    $('#cam').onclick = startCamera;
    $('#next-step').onclick = () => gotoStep(1);
    renderWarmCard();
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) startCamera();
  };
  function renderWarmCard() {
    const cards = D.warmup; const i = S.warmIdx; const c = cards[i];
    $('#warm-card').innerHTML = `
      <div class="warm-big">${c.big}</div>
      <p class="warm-text">${shinMark(c.text)}</p>
      <p class="warm-sub">${esc(c.sub)}</p>
      <div class="warm-nav"><button class="btn small" id="w-prev" type="button" aria-label="הקודם"${i === 0 ? ' disabled' : ''}>→</button><span>${i + 1} / ${cards.length}</span><button class="btn small" id="w-next" type="button" aria-label="הבא"${i === cards.length - 1 ? ' disabled' : ''}>←</button></div>`;
    $('#w-prev').onclick = () => { S.warmIdx = Math.max(0, i - 1); renderWarmCard(); };
    $('#w-next').onclick = () => { S.warmIdx = Math.min(cards.length - 1, i + 1); renderWarmCard(); ding('tap'); };
  }

  /* listening game: ש or ס? */
  STEP_RENDER.listen = (stage) => {
    if (!S.L) S.L = { round: 0, total: 6, ok: 0, phase: 'start', pairs: shuffle(D.pairs) };
    renderListen(stage);
  };
  function renderListen(stage) {
    const L = S.L;
    if (L.round >= L.total) {
      stage.innerHTML = `<section class="panel"><h2>👂 סיימנו את משחק ההקשבה!</h2><p class="result">${L.ok} מתוך ${L.total} 🎯</p></section>${nextStepBtn('למשפטים ←')}`;
      $('#next-step').onclick = () => gotoStep(2);
      return;
    }
    const pair = L.pairs[L.round % L.pairs.length];
    if (L.phase === 'start') {
      L.target = Math.random() < 0.5 ? 'sh' : 's';
      L.mode = heVoice && L.round % 2 === 0 ? 'tts' : 'parent';
      L.phase = L.mode === 'tts' ? 'pick' : 'secret';
      L.order = shuffle(['sh', 's']); L.picked = null;
    }
    const word = (k) => (k === 'sh' ? pair.sh : pair.s);
    const emo = (k) => (k === 'sh' ? pair.shE : pair.sE);
    const opts = (reveal) => `<div class="pair">${L.order.map((k) => `<button class="pick${reveal && k === L.target ? ' right' : ''}${reveal && k === L.picked && k !== L.target ? ' wrong' : ''}" data-k="${k}" type="button"><span class="pe">${emo(k)}</span><span class="pw">${word(k)}</span></button>`).join('')}</div>`;
    const head = `<div class="row"><span class="score">סיבוב ${L.round + 1} מתוך ${L.total} · ✅ ${L.ok}</span><span class="spacer"></span><button class="btn small ghost" id="skip" type="button">דילוג למשפטים ←</button></div>`;
    let body = '';
    if (L.phase === 'pick') body = `<h2>🐶 שוקו אומר מילה. איזו מילה הוא אמר?</h2><div class="row"><button class="btn" id="say" type="button">🔊 לשמוע שוב</button></div>${opts(false)}`;
    else if (L.phase === 'secret') body = `<h2>👪 הורה, לעצום עיניים! 🙈</h2><p class="lead">${esc(state.name || '')}, רק את מסתכלת. לחצי כדי לראות את המילה הסודית, ותגידי אותה בקול.</p><div class="row center"><button class="btn go big" id="reveal" type="button">👀 להראות לי</button></div>`;
    else if (L.phase === 'show') body = `<div class="secret"><span class="pe">${emo(L.target)}</span><span class="pw">${word(L.target)}</span></div><p class="lead" style="text-align:center">תגידי את המילה בקול, ברור וחזק. ואז לחצי.</p><div class="row center"><button class="btn go big" id="said" type="button">אמרתי! 🙈</button></div>`;
    else if (L.phase === 'guess') body = `<h2>👪 הורה, אפשר לפתוח עיניים. מה שמעתם?</h2>${opts(false)}`;
    else if (L.phase === 'result') {
      const right = L.picked === L.target;
      let msg;
      if (L.mode === 'tts') msg = right ? `נכון! 🎉 שוקו אמר ${word(L.target)}` : `שוקו אמר ${word(L.target)}. בואי נשמע שוב 👂`;
      else msg = right ? `ההורה הבין! 🎉 אמרת ${word(L.target)} בדיוק.` : `ההורה שמע ${word(L.picked)} 🤔 המילה הייתה ${word(L.target)}. ${esc(state.cue)}`;
      body = `${opts(true)}<p class="result">${msg}</p><div class="row center">${!right && L.mode === 'parent' ? '<button class="btn" id="retry" type="button">🔁 עוד ניסיון, אותה מילה</button>' : ''}${L.mode === 'tts' ? '<button class="btn" id="say" type="button">🔊 לשמוע שוב</button>' : ''}<button class="btn go" id="lnext" type="button">הבא ←</button></div>`;
    }
    stage.innerHTML = `<section class="panel">${head}${body}</section>`;
    $('#skip').onclick = () => gotoStep(2);
    const sayBtn = $('#say'); if (sayBtn) sayBtn.onclick = () => speak(word(L.target), 0.7);
    const rev = $('#reveal'); if (rev) rev.onclick = () => { L.phase = 'show'; renderListen(stage); };
    const said = $('#said'); if (said) said.onclick = () => { L.phase = 'guess'; renderListen(stage); };
    const retry = $('#retry'); if (retry) retry.onclick = () => { L.phase = 'secret'; L.picked = null; renderListen(stage); };
    const ln = $('#lnext'); if (ln) ln.onclick = () => { L.round++; L.phase = 'start'; renderListen(stage); };
    if (L.phase === 'pick' || L.phase === 'guess') {
      $$('.pick', stage).forEach((b) => {
        b.onclick = () => {
          L.picked = b.dataset.k; const right = L.picked === L.target;
          if (right) L.ok++;
          state.listen.all++; if (right) state.listen.ok++; save();
          ding(right ? 'good' : 'oops');
          L.phase = 'result'; renderListen(stage);
        };
      });
    }
    if (L.phase === 'pick' && !L.spoken) { L.spoken = true; speak(word(L.target), 0.7); }
    if (L.phase !== 'pick') L.spoken = false;
  }

  /* sentence practice */
  STEP_RENDER.sent = (stage) => {
    if (S.qi >= S.queue.length) {
      const left = state.minutes * 60 - dayRec().sec;
      stage.innerHTML = `<section class="panel done">${mascotHTML('happy')}<h2>סיימת את המשפטים של היום! 🎉</h2><p class="lead">${left > 60 ? 'נשאר עוד זמן. רוצה עוד משפט?' : 'הגיע הזמן לצייר!'}</p><div class="row center"><button class="btn" id="more" type="button">➕ עוד משפט</button><button class="btn go" id="to-draw" type="button">לציור 🎨</button></div></section>`;
      $('#more').onclick = () => { const extra = pickSentences(1, S.queue)[0]; if (extra) { S.queue.push(extra.id); renderStep(); } else toast('אין עוד משפטים 🙂'); };
      $('#to-draw').onclick = () => gotoStep(3);
      return;
    }
    const id = S.queue[S.qi];
    S.card = makeCard(id, true);
    renderCard(stage, S.card, {
      pos: `משפט ${S.qi + 1} מתוך ${S.queue.length}`,
      nextLabel: S.qi + 1 < S.queue.length ? 'משפט הבא ←' : 'סיימתי ←',
      onNext: () => { finalizeCard(S.card); S.card = null; S.qi++; renderStep(); window.scrollTo(0, 0); },
    });
  };

  function makeCard(id, hunt) {
    const s = sentenceById(id); const tokens = tokenize(s.t);
    return { id, s, tokens, found: new Set(), hunting: hunt && tokens.some((t) => t.shin), huntDone: false, chunk: -1, g: 0, y: 0, r: 0, tip: false, lastRec: null, finalized: false, recTimer: 0 };
  }
  function finalizeCard(C) {
    if (!C || C.finalized) return;
    const total = C.g + C.y + C.r; if (!total) return;
    C.finalized = true;
    const st = stat(C.id); const t = today();
    st.seen = t;
    if (C.g >= 5 && C.r <= 1) st.box = Math.min(3, st.box + 1);
    else if (C.r >= 3 && C.r > C.g) st.box = 1;
    else st.box = Math.max(1, st.box);
    st.due = addDays(t, BOX_GAP[st.box]);
    st.hist.push({ d: t, g: C.g, y: C.y, r: C.r }); if (st.hist.length > 40) st.hist.shift();
    save();
  }

  async function renderCard(container, C, opts) {
    const s = C.s; const nShin = C.tokens.filter((t) => t.shin).length;
    container.innerHTML = `
      <article class="card">
        <div class="card-head">
          <span class="chip l${s.l}">${LEVEL_NAMES[s.l]}</span>
          <span class="chip">${nShin} מילים עם ש</span>
          ${hasMix(s.t, C.tokens) ? '<span class="chip mix">🔀 ש ו-ס באותו משפט</span>' : ''}
          <span class="spacer"></span><span class="qpos">${esc(opts.pos || '')}</span>
        </div>
        <div class="card-body">
          <figure class="pic" id="pic"></figure>
          <div class="text-side">
            <p class="hunt-msg" id="hunt-msg" hidden></p>
            <div id="sent-area"></div>
            <div class="voice-chip" id="voice-chip" hidden></div>
            <div class="tools">
              <button class="btn" id="t-listen" type="button" hidden>🔊 לשמוע</button>
              <button class="btn rec" id="t-rec" type="button"${canRecord ? '' : ' hidden'}>🎙️ להקליט</button>
              <button class="btn" id="t-again" type="button" hidden>▶️ לשמוע אותי</button>
              <button class="btn" id="t-chunk" type="button">🐢 לאט, בחלקים</button>
              <button class="btn" id="t-spin" type="button">🎲 קול מצחיק</button>
            </div>
            <div class="meter" id="meter" hidden><i></i></div>
            <div class="rate" id="rate">
              <p class="rate-q">איך יצאו השינים?</p>
              <button class="rg" data-r="g" type="button"><span class="face">😀</span>שששש!</button>
              <button class="ry" data-r="y" type="button"><span class="face">🙂</span>כמעט</button>
              <button class="rr" data-r="r" type="button"><span class="face">😕</span>יצא ססס</button>
            </div>
            <div class="paws" id="paws"></div>
            <div class="tip" id="tip" hidden></div>
          </div>
        </div>
        <div class="card-foot"><button class="btn go" id="c-next" type="button">${esc(opts.nextLabel)}</button></div>
      </article>`;
    renderSentence(C); renderPaws(C); renderPic(C);

    blobs.get('model:' + C.id).then((b) => { const el = $('#t-listen'); if (el && (b || heVoice)) el.hidden = false; });
    $('#t-listen').onclick = async () => {
      audioCtx();
      const b = await blobs.get('model:' + C.id);
      if (b) playBlob(b);
      else if (C.chunk >= 0) speak(chunkify(C.tokens)[C.chunk].map((i) => C.tokens[i].t).join(' '));
      else speak(plainText(s.t));
    };
    $('#t-rec').onclick = () => toggleRecord(C);
    $('#t-again').onclick = () => { if (C.lastRec) playBlob(C.lastRec); };
    $('#t-chunk').onclick = () => { C.chunk = C.chunk >= 0 ? -1 : 0; if (C.chunk >= 0) C.hunting = false; renderSentence(C); };
    $('#t-spin').onclick = () => spinVoice(C);
    $$('#rate button').forEach((b) => { b.onclick = () => rate(C, b.dataset.r); });
    $('#c-next').onclick = async () => {
      clearTimeout(C.recTimer);
      if (recorder.active) await recorder.stop();
      stopAudio();
      opts.onNext();
    };
  }

  function renderSentence(C) {
    const area = $('#sent-area'); if (!area) return;
    const msg = $('#hunt-msg'); const nShin = C.tokens.filter((t) => t.shin).length;
    const chunkBtn = $('#t-chunk'); if (chunkBtn) chunkBtn.textContent = C.chunk >= 0 ? '📜 כל המשפט' : '🐢 לאט, בחלקים';
    if (C.chunk >= 0) {
      const chunks = chunkify(C.tokens); C.chunk = Math.min(C.chunk, chunks.length - 1);
      msg.hidden = true;
      area.innerHTML = `<div class="sentence chunk">${chunks[C.chunk].map((i) => `<span class="w">${wordHTML(C.tokens[i], true)}</span>`).join(' ')}</div>
        <div class="chunk-nav"><button class="btn small" id="ch-prev" type="button" aria-label="החלק הקודם"${C.chunk === 0 ? ' disabled' : ''}>→</button><span>חלק ${C.chunk + 1} מתוך ${chunks.length}</span><button class="btn small" id="ch-next" type="button" aria-label="החלק הבא"${C.chunk === chunks.length - 1 ? ' disabled' : ''}>←</button></div>`;
      $('#ch-prev').onclick = () => { C.chunk--; renderSentence(C); };
      $('#ch-next').onclick = () => { C.chunk++; renderSentence(C); };
      return;
    }
    if (C.hunting) {
      msg.hidden = false;
      msg.innerHTML = `🔎 מצאי את כל המילים עם ש! <b>${C.found.size}/${nShin}</b> <button class="link" id="h-reveal" type="button">גלי לי</button>`;
      $('#h-reveal').onclick = () => { C.hunting = false; renderSentence(C); };
    } else if (C.huntDone) {
      msg.hidden = false; msg.textContent = '🎉 מצאת את כולן! עכשיו אומרים את המשפט בקול.';
    } else msg.hidden = true;
    area.innerHTML = `<div class="sentence${C.hunting ? ' hunting' : ''}" id="sentence">${C.tokens.map((t, i) => `<span class="w${C.hunting && C.found.has(i) ? ' found' : ''}" data-i="${i}">${wordHTML(t, !C.hunting || C.found.has(i))}</span>`).join(' ')}</div>`;
    $('#sentence').onclick = (e) => {
      const w = e.target.closest('.w'); if (!w || !C.hunting) return;
      const i = +w.dataset.i; const tok = C.tokens[i];
      if (tok.shin) {
        if (!C.found.has(i)) { C.found.add(i); ding('tap'); if (tok.num) toast(`${tok.t.replace(/\D/g, '')} = ${tok.num}. יש בו ש! 😮`, 3000); }
        if (C.found.size >= nShin) { C.hunting = false; C.huntDone = true; ding('good'); }
        renderSentence(C);
      } else {
        if (tok.sin) toast('במילה הזאת יש שׂ, והיא נשמעת כמו ס 😉', 3000);
        w.classList.remove('nope'); void w.offsetWidth; w.classList.add('nope');
      }
    };
  }

  async function renderPic(C) {
    const fig = $('#pic'); if (!fig) return;
    const url = await picURL(C.id);
    if (!fig.isConnected) return;
    fig.innerHTML = `${url ? `<img src="${url}" alt="הציור שלך">` : `<div class="emoji">${C.s.e || '🎨'}</div>`}<button class="btn small" id="draw-it" type="button">🎨 ${url ? 'לצייר עוד' : 'לצייר'}</button>`;
    $('#draw-it').onclick = () => Draw.open({ key: 'draw:' + C.id, title: C.s.t, sentence: true, onSave: () => { invalidatePic(C.id); renderPic(C); } });
  }

  function renderPaws(C) {
    const el = $('#paws'); if (!el) return;
    el.innerHTML = `${[0, 1, 2, 3, 4].map((i) => `<span class="${i < C.g ? 'on' : ''}">🐾</span>`).join('')}<small>${C.g >= 5 ? '⭐ ' : ''}${C.g} פעמים שששש · ${C.g + C.y + C.r} חזרות</small>`;
  }

  async function toggleRecord(C) {
    const btn = $('#t-rec'); audioCtx();
    if (!recorder.active) {
      stopAudio();
      try { await recorder.start($('#meter i')); } catch (e) { toast('צריך לאשר גישה למיקרופון 🎙️', 3000); return; }
      btn.classList.add('on'); btn.textContent = '⏹️ עצירה'; $('#meter').hidden = false;
      C.recTimer = setTimeout(() => { if (recorder.active && btn.isConnected) toggleRecord(C); }, 25000);
      return;
    }
    clearTimeout(C.recTimer);
    btn.classList.remove('on'); btn.textContent = '🎙️ להקליט'; $('#meter').hidden = true;
    const blob = await recorder.stop();
    if (!blob || !btn.isConnected) return;
    C.lastRec = blob; $('#t-again').hidden = false;
    saveRecording(C.id, blob);
    await playBlob(blob);
    const r = $('#rate'); if (r) { r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash'); }
  }
  async function saveRecording(id, blob) {
    await blobs.put(`rec:${id}:${Date.now()}`, blob);
    const keys = await blobs.keys(`rec:${id}:`);
    // keep the very first recording (for before/after) and the latest five
    while (keys.length > 6) { const k = keys.splice(1, 1)[0]; await blobs.del(k); }
  }

  function spinVoice(C) {
    const chip = $('#voice-chip'); chip.hidden = false;
    let n = 0; const steps = 12 + rand(6); let v = null;
    const iv = setInterval(() => {
      do { v = D.voices[rand(D.voices.length)]; } while (D.voices.length > 1 && v === C.voice);
      chip.textContent = `${v[0]} ${v[1]}`;
      if (++n >= steps) { clearInterval(iv); C.voice = v; chip.textContent = `עכשיו אומרים: ${v[0]} ${v[1]}`; ding('tap'); }
    }, 70);
  }

  function rate(C, r) {
    C[r]++;
    const st = stat(C.id); st[r]++;
    const d = dayRec(); d[r]++; if (!d.ids.includes(C.id)) d.ids.push(C.id);
    if (S && view === 'session') S[r]++;
    if (r === 'g') { state.bones++; ding('good'); } else ding(r === 'y' ? 'tap' : 'oops');
    save(); renderPaws(C);
    if (r === 'g' && C.g === 5) {
      ding('win'); confetti(); toast('⭐ חמש פעמים שששש! המשפט הושלם', 2600);
      const nb = $('#c-next'); if (nb) nb.classList.add('pulse');
    }
    if (C.r >= 3 && C.r > C.g && !C.tip) {
      C.tip = true;
      const tip = $('#tip'); tip.hidden = false;
      tip.textContent = `💡 ${state.cue}. ננסה לאט, חלק אחרי חלק 🐢`;
      if (C.chunk < 0) { C.chunk = 0; C.hunting = false; renderSentence(C); }
    }
  }

  /* drawing time */
  async function fillTiles(container, ids, onTap) {
    const tiles = await Promise.all(ids.map(async (id) => {
      const s = sentenceById(id); if (!s) return '';
      const url = await picURL(id); const st = stat(id);
      return `<button class="tile" data-id="${id}" type="button"><div class="thumb">${url ? `<img src="${url}" alt="">` : `<div class="emoji">${s.e || '🎨'}</div>`}</div><p>${litSentence(s.t)}</p><span class="status s${st.box}">${STATUS[st.box]}</span></button>`;
    }));
    if (!container.isConnected) return;
    container.innerHTML = tiles.join('');
    $$('.tile', container).forEach((b) => { b.onclick = () => onTap(b.dataset.id); });
  }
  STEP_RENDER.draw = (stage) => {
    const todayIds = dayRec().ids;
    const ids = todayIds.length ? todayIds.slice() : S.queue.slice();
    stage.innerHTML = `<section class="panel"><h2>🎨 זמן ציור!</h2><p class="lead">בחרי משפט מהיום וציירי אותו. כל פעם שאת מחליפה צבע, אומרים את המשפט בקול! 🗣️</p><div class="pick-list" id="plist"></div></section>${nextStepBtn('סיימתי ←')}`;
    const refill = () => fillTiles($('#plist'), ids, (id) => { const s = sentenceById(id); Draw.open({ key: 'draw:' + id, title: s.t, sentence: true, sayOnColor: true, onSave: () => { invalidatePic(id); refill(); } }); });
    refill();
    $('#next-step').onclick = () => gotoStep(4);
  };

  STEP_RENDER.done = (stage) => {
    const d = dayRec();
    stage.innerHTML = `<section class="panel done">${mascotHTML('happy')}<h2>כל הכבוד ${esc(state.name || '')}! 🎉</h2>
      <div class="sum"><div><b>${Math.round(d.sec / 60)}</b>דקות היום</div><div><b>${S.g}</b>🦴 עצמות באימון</div><div><b>${S.qi}</b>משפטים</div><div><b>${streak()}</b>🐾 ימים ברצף</div></div>
      <button class="btn go big" id="home" type="button">לבית 🏠</button></section>`;
    ding('win'); confetti();
    $('#home').onclick = () => { endSession(); go('home'); };
  };

  /* ---------------- album ---------------- */
  VIEWS.album = () => {
    app.innerHTML = `
      <header class="page-head"><button class="btn small" id="back" type="button">→ לבית</button><h1>🎨 האלבום שלי</h1></header>
      <section class="panel mascot-card">${mascotHTML('happy', false)}
        <div class="txt"><h2>הדמות שלי</h2><p class="lead">אפשר לצייר דמות משלך: כלב, יצור שהמצאת, מה שבא לך. היא תופיע בכל מקום במקום שוקו.</p>
          <div class="row"><button class="btn go" id="draw-mascot" type="button">🎨 לצייר את הדמות שלי</button>${mascotURL ? '<button class="btn ghost" id="reset-mascot" type="button">↩️ לחזור לשוקו</button>' : ''}</div></div></section>
      ${[1, 2, 3].filter((l) => state.sentences.some((s) => s.l === l)).map((l) => `<h2 class="group-title">${LEVEL_NAMES[l]}</h2><div class="pick-list" id="g${l}"></div>`).join('')}`;
    $('#back').onclick = () => go('home');
    $('#draw-mascot').onclick = () => Draw.open({ key: 'draw:mascot', title: 'הדמות שלי 🐶', onSave: async () => { await loadMascot(); go('album'); } });
    const rm = $('#reset-mascot');
    if (rm) rm.onclick = async () => { if (await confirmBox('לחזור לשוקו?', 'הציור של הדמות שלך יימחק.', 'כן', 'לא')) { await blobs.del('draw:mascot'); await loadMascot(); go('album'); } };
    [1, 2, 3].forEach((l) => { const el = $('#g' + l); if (el) fillTiles(el, state.sentences.filter((s) => s.l === l).map((s) => s.id), (id) => go('practice', id)); });
  };
  VIEWS.practice = (id) => {
    if (!sentenceById(id)) return go('album');
    app.innerHTML = `<header class="page-head"><button class="btn small" id="back" type="button">→ לאלבום</button></header><div id="stage"></div>`;
    const C = makeCard(id, false);
    const stopTick = startTicker();
    onLeave(() => { stopTick(); finalizeCard(C); });
    renderCard($('#stage'), C, { pos: '', nextLabel: 'חזרה לאלבום', onNext: () => go('album') });
    $('#back').onclick = () => go('album');
  };

  /* ---------------- parent area ---------------- */
  function reportText() {
    const t = today(); const from = addDays(t, -6);
    let days = 0, sec = 0, g = 0, y = 0, r = 0; const ids = new Set();
    for (let i = 0; i < 7; i++) {
      const k = addDays(from, i); const d = state.days[k]; if (!d) continue;
      if (practiced(k)) days++;
      sec += d.sec; g += d.g; y += d.y; r += d.r; d.ids.forEach((x) => ids.add(x));
    }
    const total = g + y + r;
    const ratio = (st) => st.r / Math.max(1, st.g + st.y + st.r);
    const hard = state.sentences.map((s) => ({ s, st: stat(s.id) })).filter((x) => x.st.g + x.st.y + x.st.r >= 3 && x.st.r > 0).sort((a, b) => ratio(b.st) - ratio(a.st)).slice(0, 3);
    const mastered = state.sentences.filter((s) => stat(s.id).box >= 3).length;
    return [
      `דוח תרגול ש׳: ${state.name || ''}`,
      `${shortDate(from)} עד ${shortDate(t)}`,
      '',
      `ימי תרגול: ${days} מתוך 7 · סה״כ ${Math.round(sec / 60)} דקות`,
      `חזרות על משפטים: ${total} (😀 ${g} · 🙂 ${y} · 😕 ${r})`,
      `לפי הדירוג שלה: ${total ? Math.round((g / total) * 100) : 0}% יצאו ״שששש״`,
      `משפטים שתורגלו השבוע: ${ids.size} · בשליטה (מההתחלה): ${mastered} מתוך ${state.sentences.length}`,
      `משחק ההקשבה (מההתחלה): ${state.listen.ok} נכונות מתוך ${state.listen.all}`,
      hard.length ? `\nהכי מאתגרים כרגע:\n${hard.map((x, i) => `${i + 1}. ${plainText(x.s.t)}`).join('\n')}` : '',
    ].join('\n').trim();
  }
  function chartHTML() {
    const t = today(); const cols = [];
    let max = state.minutes * 60;
    for (let i = 13; i >= 0; i--) { const k = addDays(t, -i); const d = state.days[k]; const s = d ? d.sec : 0; max = Math.max(max, s); cols.push({ k, s }); }
    return `<div class="chart" role="img" aria-label="דקות תרגול ב-14 הימים האחרונים">${cols.map((c) => `<div class="col"><span class="val">${c.s ? Math.round(c.s / 60) : ''}</span><div class="colbar${c.s ? '' : ' zero'}" style="height:${Math.max(2, (c.s / max) * 100)}%"></div><span class="lbl">${shortDate(c.k)}</span></div>`).join('')}</div>`;
  }
  let pRecId = null;
  VIEWS.parent = () => {
    const rows = state.sentences.map((s, i) => {
      const st = stat(s.id);
      return `<tr data-id="${s.id}"><td class="num">${i + 1}</td><td><div class="sentence-sm">${litSentence(s.t)}</div></td>
        <td><select data-act="level" aria-label="רמה">${[1, 2, 3].map((l) => `<option value="${l}"${s.l === l ? ' selected' : ''}>${LEVEL_NAMES[l]}</option>`).join('')}</select></td>
        <td><span class="status s${st.box}">${STATUS[st.box]}</span></td>
        <td class="num">😀 ${st.g} · 🙂 ${st.y} · 😕 ${st.r}</td>
        <td class="num">${st.seen ? shortDate(st.seen) : '–'}</td>
        <td><div class="mini" data-model></div></td><td><div class="mini" data-recs></div></td></tr>`;
    }).join('');
    app.innerHTML = `
      <div class="parent">
      <div class="stage">
      <header class="page-head"><button class="btn small" id="back" type="button">→ לבית</button><h1>👪 אזור ההורים</h1></header>

      <section class="panel"><h2>השבוע</h2>${chartHTML()}
        <div class="report" id="report">${esc(reportText())}</div>
        <div class="row"><button class="btn small" id="copy" type="button">📋 העתקת הדוח לקלינאית</button></div></section>

      <section class="panel"><h2>הגדרות</h2>
        <div class="form">
          <label class="field">שם הילדה<input id="f-name" value="${esc(state.name)}" maxlength="20"></label>
          <label class="field">דקות ביום<select id="f-min">${[10, 15, 20, 25, 30].map((m) => `<option${m === state.minutes ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
          <label class="field">משפטים בכל אימון<select id="f-per">${[3, 4, 5, 6].map((m) => `<option${m === state.perSession ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
          <label class="field">הרמז של הקלינאית<input id="f-cue" value="${esc(state.cue)}" maxlength="80"></label>
        </div>
        <p class="help">הרמז מופיע כשמשפט יוצא ״ססס״ כמה פעמים. כדאי לכתוב בדיוק את המילים שהקלינאית משתמשת בהן.</p>
        <div class="row"><button class="btn go small" id="f-save" type="button">שמירה</button></div></section>

      <section class="panel"><h2>המשפטים</h2>
        <p class="help">🎙️ <b>דוגמה</b>: הקליטו את המשפט בקול שלכם. ${esc(state.name || 'הילדה')} תשמע אותו בכפתור ״לשמוע״. בלי הקלטה, האייפד מקריא בקול ממוחשב (אם יש לו קול בעברית).<br>▶️ <b>ההקלטות שלה</b>: נשמרות ההקלטה הראשונה וחמש האחרונות, כדי לשמוע התקדמות.</p>
        <div class="tbl-wrap"><table><thead><tr><th>#</th><th>משפט</th><th>רמה</th><th>מצב</th><th>דירוגים</th><th>אחרון</th><th>דוגמה</th><th>ההקלטות שלה</th></tr></thead><tbody id="tbody">${rows}</tbody></table></div></section>

      <section class="panel"><h2>עריכת הרשימה</h2>
        <p class="help">משפט בכל שורה. ההתקדמות נשמרת לכל משפט שלא השתנה. מילה עם שׂ (נשמעת כמו ס, למשל ״*נישא״) מסמנים בכוכבית לפניה, וכך היא לא נספרת כ-ש.</p>
        <textarea id="list" spellcheck="false" dir="rtl">${esc(state.sentences.map((s) => s.t).join('\n'))}</textarea>
        <div class="row"><button class="btn go small" id="list-save" type="button">שמירת הרשימה</button><button class="btn small" id="list-reset" type="button">חזרה לרשימה של הקלינאית</button></div></section>

      <section class="panel"><h2>גיבוי</h2>
        <p class="help">הכול נשמר רק על האייפד הזה. מדי פעם כדאי לשמור גיבוי (כולל ציורים והקלטות) לקבצים.</p>
        <div class="row"><button class="btn small" id="export" type="button">💾 שמירת גיבוי</button><label class="btn small" for="import-file">📂 שחזור מגיבוי</label><input type="file" id="import-file" accept="application/json,.json" hidden><span class="spacer"></span><button class="btn small ghost" id="reset" type="button">🧹 איפוס ההתקדמות</button></div></section>
      </div></div>`;

    $('#back').onclick = () => go('home');
    $('#copy').onclick = () => {
      const txt = reportText();
      const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#report')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('הטקסט מסומן. אפשר להעתיק'); };
      try { navigator.clipboard.writeText(txt).then(() => toast('הדוח הועתק ✓'), fallback); } catch (e) { fallback(); }
    };
    $('#f-save').onclick = () => {
      state.name = $('#f-name').value.trim(); state.minutes = +$('#f-min').value; state.perSession = +$('#f-per').value;
      state.cue = $('#f-cue').value.trim() || defaults().cue; save(true); toast('נשמר ✓');
    };
    const tbody = $('#tbody');
    tbody.onchange = (e) => {
      const sel = e.target.closest('select[data-act="level"]'); if (!sel) return;
      const s = sentenceById(sel.closest('tr').dataset.id); s.l = +sel.value; save(); toast('הרמה עודכנה ✓');
    };
    tbody.onclick = async (e) => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const tr = b.closest('tr'); const id = tr.dataset.id; const act = b.dataset.act;
      audioCtx();
      if (act === 'm-rec') {
        if (recorder.active && pRecId !== id) { toast('קודם עוצרים את ההקלטה הפעילה'); return; }
        if (!recorder.active) {
          stopAudio();
          try { await recorder.start(null); } catch (err) { toast('צריך לאשר גישה למיקרופון 🎙️', 3000); return; }
          pRecId = id; b.textContent = '⏹️ עצירה'; b.classList.add('rec', 'on');
        } else {
          const blob = await recorder.stop(); pRecId = null;
          if (blob) { await blobs.put('model:' + id, blob); toast('הדוגמה נשמרה ✓'); }
          renderRowMedia(tr);
        }
      } else if (act === 'm-play') { const bl = await blobs.get('model:' + id); if (bl) playBlob(bl); }
      else if (act === 'm-del') { if (await confirmBox('למחוק את ההקלטה לדוגמה?', '', 'מחיקה', 'ביטול')) { await blobs.del('model:' + id); renderRowMedia(tr); } }
      else if (act === 'r-play') { const bl = await blobs.get(b.dataset.k); if (bl) playBlob(bl); }
    };
    $$('#tbody tr').forEach(renderRowMedia);
    onLeave(() => { pRecId = null; });

    $('#list-save').onclick = () => {
      const lines = $('#list').value.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) { toast('הרשימה ריקה'); return; }
      const known = new Map([...defaultSentences(), ...state.sentences].map((s) => [s.t, s]));
      state.sentences = lines.map((t) => { const k = known.get(t); return k ? { ...k } : { id: hashId(t), t, e: '🎨', l: autoLevel(tokenize(t)) }; });
      save(true); toast('הרשימה עודכנה ✓'); go('parent');
    };
    $('#list-reset').onclick = async () => {
      if (!(await confirmBox('לחזור לרשימה של הקלינאית?', 'ההתקדמות במשפטים האלה נשמרת.', 'כן, לחזור', 'ביטול'))) return;
      state.sentences = defaultSentences(); save(true); go('parent');
    };
    $('#export').onclick = exportBackup;
    $('#import-file').onchange = (e) => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f); e.target.value = ''; };
    $('#reset').onclick = async () => {
      if (!(await confirmBox('לאפס את כל ההתקדמות?', 'דירוגים, דקות, עצמות וההקלטות שלה יימחקו. ציורים והקלטות לדוגמה נשארים.', 'איפוס', 'ביטול'))) return;
      state.stats = {}; state.days = {}; state.bones = 0; state.listen = { ok: 0, all: 0 };
      for (const k of await blobs.keys('rec:')) await blobs.del(k);
      save(true); toast('ההתקדמות אופסה'); go('parent');
    };
  };
  async function renderRowMedia(tr) {
    const id = tr.dataset.id;
    const [model, recs] = await Promise.all([blobs.get('model:' + id), blobs.keys(`rec:${id}:`)]);
    const m = $('[data-model]', tr); const r = $('[data-recs]', tr);
    if (!m || !m.isConnected) return;
    m.innerHTML = `<button class="btn" data-act="m-rec" type="button">🎙️ ${model ? 'מחדש' : 'הקלטה'}</button>${model ? '<button class="btn" data-act="m-play" type="button" aria-label="השמעה">▶️</button><button class="btn" data-act="m-del" type="button" aria-label="מחיקה">🗑️</button>' : ''}`;
    const when = (k) => { const d = new Date(+k.split(':')[2]); return `${d.getDate()}.${d.getMonth() + 1}`; };
    r.innerHTML = recs.length ? `<button class="btn" data-act="r-play" data-k="${recs[0]}" type="button">▶️ ראשונה ${when(recs[0])}</button>${recs.length > 1 ? `<button class="btn" data-act="r-play" data-k="${recs[recs.length - 1]}" type="button">▶️ אחרונה ${when(recs[recs.length - 1])}</button>` : ''}` : '<span class="help">עוד אין</span>';
  }
  async function exportBackup() {
    toast('מכינים גיבוי…');
    const files = {};
    for (const k of await blobs.keys('')) { const b = await blobs.get(k); if (b) files[k] = await blobToDataURL(b); }
    const data = JSON.stringify({ app: 'shin-app', v: 1, at: new Date().toISOString(), state, files });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `shin-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function importBackup(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { toast('הקובץ לא נקרא. בחרו קובץ גיבוי של האפליקציה', 3000); return; }
    if (!data || data.app !== 'shin-app' || !data.state) { toast('זה לא קובץ גיבוי של שעשועון השין', 3000); return; }
    if (!(await confirmBox('לשחזר מהגיבוי?', 'ההתקדמות הנוכחית תוחלף במה שבגיבוי.', 'שחזור', 'ביטול'))) return;
    state = Object.assign(defaults(), data.state);
    for (const [k, v] of Object.entries(data.files || {})) { try { const b = await (await fetch(v)).blob(); await blobs.put(k, b); } catch (e) { /* skip broken file */ } }
    picURLs.forEach((u) => u && URL.revokeObjectURL(u)); picURLs.clear();
    await loadMascot(); save(true); toast('השחזור הושלם ✓'); go('parent');
  }

  /* ---------------- drawing board ---------------- */
  const Draw = (() => {
    const el = $('#draw'); const canvas = $('#canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const W = canvas.width, H = canvas.height;
    const COLORS = ['#1F2340', '#8B5A34', '#C68642', '#F7D046', '#F28C28', '#E8503F', '#F48FB1', '#8E44AD', '#2F5BEA', '#7EC8F2', '#1FA866', '#9AD45B', '#9AA0B5'];
    const SIZES = [6, 14, 30];
    let color = COLORS[0], size = SIZES[1], tool = 'pen';
    let ops = [], base = null, cur = null, penSeen = false, opts = null, dirty = false;

    $('#swatches').innerHTML = COLORS.map((c, i) => `<button class="swatch${i === 0 ? ' on' : ''}" data-c="${c}" style="background:${c}" type="button" aria-label="צבע"></button>`).join('');
    $('#sizes').innerHTML = SIZES.map((s, i) => `<button class="tool${i === 1 ? ' on' : ''}" data-s="${s}" type="button" aria-label="עובי"><span class="dot" style="width:${6 + i * 8}px;height:${6 + i * 8}px"></span></button>`).join('');
    $('#swatches').onclick = (e) => {
      const b = e.target.closest('.swatch'); if (!b) return;
      color = b.dataset.c; $$('.swatch').forEach((x) => x.classList.toggle('on', x === b));
      if (tool === 'eraser') setTool('pen');
      if (opts && opts.sayOnColor) toast('🗣️ צבע חדש: אומרים את המשפט!', 1500);
    };
    $('#sizes').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; size = +b.dataset.s; $$('#sizes .tool').forEach((x) => x.classList.toggle('on', x === b)); };
    function setTool(t) { tool = t; $$('[data-tool]').forEach((x) => x.classList.toggle('on', x.dataset.tool === t)); }
    $$('[data-tool]').forEach((b) => { b.onclick = () => setTool(b.dataset.tool); });

    function fit() {
      const st = $('#draw-stage').getBoundingClientRect();
      const w = Math.max(100, Math.min(st.width, st.height * W / H));
      canvas.style.width = w + 'px'; canvas.style.height = (w * H / W) + 'px';
    }
    window.addEventListener('resize', () => { if (!el.hidden) fit(); });

    function seg(op, a, b) { ctx.strokeStyle = op.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = op.size * b[2]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    function dot(op, p) { ctx.fillStyle = op.color; ctx.beginPath(); ctx.arc(p[0], p[1], (op.size * p[2]) / 2, 0, Math.PI * 2); ctx.fill(); }
    function apply(op) {
      if (op.type === 'fill') { flood(op.x, op.y, op.color); return; }
      dot(op, op.pts[0]);
      for (let i = 1; i < op.pts.length; i++) seg(op, op.pts[i - 1], op.pts[i]);
    }
    function redraw() { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); if (base) ctx.drawImage(base, 0, 0, W, H); ops.forEach(apply); }
    function flood(x, y, hex) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const img = ctx.getImageData(0, 0, W, H); const d = img.data;
      const n = parseInt(hex.slice(1), 16); const fr = (n >> 16) & 255, fg = (n >> 8) & 255, fb = n & 255;
      const i0 = (y * W + x) * 4; const sr = d[i0], sg = d[i0 + 1], sb = d[i0 + 2];
      if (Math.abs(sr - fr) + Math.abs(sg - fg) + Math.abs(sb - fb) < 12) return;
      const match = (p) => { const i = p * 4; return Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb) <= 100; };
      const seen = new Uint8Array(W * H); const stack = [x, y];
      while (stack.length) {
        const cy = stack.pop(); let cx = stack.pop(); let p = cy * W + cx;
        while (cx >= 0 && !seen[p] && match(p)) { cx--; p--; }
        cx++; p++;
        let up = false, down = false;
        while (cx < W && !seen[p] && match(p)) {
          seen[p] = 1; const i = p * 4; d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
          if (cy > 0) { const q = p - W; if (!seen[q] && match(q)) { if (!up) { stack.push(cx, cy - 1); up = true; } } else up = false; }
          if (cy < H - 1) { const q = p + W; if (!seen[q] && match(q)) { if (!down) { stack.push(cx, cy + 1); down = true; } } else down = false; }
          cx++; p++;
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const pr = e.pointerType === 'pen' ? Math.max(0.35, Math.min(1.6, (e.pressure || 0.5) * 1.6)) : 1;
      return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height, pr];
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'pen') penSeen = true;
      else if (penSeen && e.pointerType === 'touch') return; // palm rejection once a Pencil is in use
      if (cur) return;
      e.preventDefault();
      const p = pos(e);
      if (tool === 'fill') { const op = { type: 'fill', x: Math.round(p[0]), y: Math.round(p[1]), color }; ops.push(op); apply(op); dirty = true; return; }
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      cur = { id: e.pointerId, type: 'stroke', color: tool === 'eraser' ? '#FFFFFF' : color, size: tool === 'eraser' ? size * 2 : size, pts: [p] };
      dot(cur, p); dirty = true;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!cur || e.pointerId !== cur.id) return;
      e.preventDefault();
      const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
      for (const ev of evs.length ? evs : [e]) { const p = pos(ev); seg(cur, cur.pts[cur.pts.length - 1], p); cur.pts.push(p); }
    });
    const end = (e) => { if (!cur || e.pointerId !== cur.id) return; ops.push(cur); cur = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    $('#draw-undo').onclick = () => { if (ops.length) { ops.pop(); redraw(); } };
    $('#draw-clear').onclick = async () => { if (await confirmBox('לנקות את כל הדף?', '', 'לנקות', 'ביטול')) { ops = []; base = null; dirty = true; redraw(); } };
    $('#draw-cancel').onclick = async () => { if (dirty && !(await confirmBox('לסגור בלי לשמור?', '', 'לסגור', 'להמשיך לצייר'))) return; close(); };
    $('#draw-save').onclick = async () => {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (blob) await blobs.put(opts.key, blob);
      const cb = opts.onSave; close();
      toast('הציור נשמר באלבום 🎨'); ding('win');
      if (cb) cb();
    };
    function close() { el.hidden = true; document.body.style.overflow = ''; cur = null; }
    async function open(o) {
      opts = o; ops = []; cur = null; base = null; dirty = false;
      $('#draw-title').innerHTML = o.sentence ? litSentence(o.title) : esc(o.title);
      el.hidden = false; document.body.style.overflow = 'hidden';
      fit(); redraw();
      const b = await blobs.get(o.key);
      if (b) { base = await blobToImage(b); redraw(); }
    }
    return { open };
  })();

  /* ---------------- start ---------------- */
  function askName() {
    modal(`<div class="modal-box">${mascotHTML('happy')}<h2>היי! אני שוקו 🐶<br>איך קוראים לך?</h2><input id="name-in" maxlength="20" autocomplete="off" aria-label="השם שלך"><button class="btn go big" id="name-ok" type="button">יאללה!</button></div>`);
    $('.modal-box .mascot').style.margin = '0 auto';
    $('#name-ok').onclick = () => { state.name = $('#name-in').value.trim(); save(true); closeModal(); go('home'); };
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { if (view === 'session') requestWake(); }
    else save(true);
  });
  window.addEventListener('pagehide', () => save(true));
  document.addEventListener('pointerdown', () => audioCtx(), { once: true });

  (async () => {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || local)) navigator.serviceWorker.register('sw.js').catch(() => {});
    await loadMascot();
    go('home');
    if (!state.name) askName();
  })();
})();
