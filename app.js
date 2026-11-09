/* שעשועון השין (v2): daily ש practice for an 8-year-old, built so she never has to read.
   She hears each sentence (a recording by a parent or the therapist), sees it (her drawing or an
   emoji scene), says it, hears herself, and rates it. A puppy walks along the bottom of the
   screen, points at the next thing to do, and earns treats she feeds it in its house.
   No server: progress is in localStorage; recordings and drawings are in IndexedDB. */
(() => {
  'use strict';

  const D = window.SHIN_DATA;
  const Cut = window.ShinCut;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------------- dates ---------------- */
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return dayKey(d); };
  const today = () => dayKey();
  const shortDate = (k) => { const d = keyToDate(k); return `${d.getDate()}.${d.getMonth() + 1}`; };
  const mmss = (sec) => { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${pad(sec % 60)}`; };
  const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  /* ---------------- text: finding the ש (for the parent's view) ---------------- */
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
  function chunkify(tokens) {
    const out = []; let cur = [];
    tokens.forEach((t, i) => { cur.push(i); if (cur.length >= 3 || /[.?!,]$/.test(t.t)) { out.push(cur); cur = []; } });
    if (cur.length) { if (cur.length === 1 && out.length) out[out.length - 1].push(...cur); else out.push(cur); }
    return out;
  }
  // The sentence with a red │ where the reader should pause (the app cuts the recording there).
  function pauseMarked(text) {
    const toks = tokenize(text);
    return chunkify(toks).map((g) => g.map((i) => wordHTML(toks[i], true)).join(' ')).join(' <span class="pause">│</span> ');
  }
  const hashId = (s) => { let h = 5381; for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return 's' + h.toString(36); };

  const LEVEL_NAMES = { 1: 'קל', 2: 'בינוני', 3: 'שלב בוס' };
  const LEVEL_ICONS = { 1: '⭐', 2: '⭐⭐', 3: '👑' };
  const STATUS = ['חדש', 'מתאמנת', 'כמעט שם', '⭐ שולטת'];
  const STATUS_KID = ['🆕', '🌱', '🌿', '⭐'];
  const BOX_GAP = [0, 1, 2, 5]; // days until a sentence comes back, by box

  /* ---------------- state ---------------- */
  const KEY = 'shin-app.v1';
  const defaultSentences = () => D.sentences.map((s) => ({ id: hashId(s.t), t: s.t, e: s.e, l: s.l }));
  const defaultPup = () => ({ name: 'שוקו', fur: D.colors[0], ear: D.colors[1], wear: { head: null, face: null, neck: null, back: null }, fed: 0, jar: {} });
  const defaults = () => ({
    v: 2, name: '', minutes: 20, perSession: 4, cue: 'שפתיים קדימה כמו נשיקה 😗', showText: false,
    sentences: defaultSentences(), stats: {}, days: {}, listen: { ok: 0, all: 0 }, pup: defaultPup(),
  });
  function normalize(s) {
    const st = Object.assign(defaults(), s);
    const p = s.pup || {};
    st.pup = Object.assign(defaultPup(), p);
    st.pup.wear = Object.assign(defaultPup().wear, p.wear || {});
    st.pup.jar = Object.assign({}, p.jar || {});
    if (s.bones) st.pup.jar.bone = (st.pup.jar.bone || 0) + s.bones; // v1 bones become treats
    delete st.bones;
    st.v = 2;
    return st;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); if (s && Array.isArray(s.sentences) && s.sentences.length) return normalize(s); }
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

  /* ---------------- sound effects ---------------- */
  let actx = null;
  function audioCtx() {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) { try { actx = new C(); } catch (e) { actx = null; } } }
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  const DING = { good: [660, 880], win: [523, 659, 784, 1046], oops: [330, 262], tap: [600] };
  function ding(kind) {
    const ctx = audioCtx(); if (!ctx) return;
    (DING[kind] || DING.tap).forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const t = ctx.currentTime + i * 0.11;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.25);
    });
  }
  let noiseBuf = null;
  function noiseSrc(ctx) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.5), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function envGain(ctx, t, attack, peak, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(ctx.destination); return g;
  }
  function sfx(name) {
    if (DING[name]) { ding(name); return; }
    const ctx = audioCtx(); if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    try {
      if (name === 'pop') {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(1250, t + 0.08);
        o.connect(envGain(ctx, t, 0.01, 0.15, 0.12)); o.start(t); o.stop(t + 0.14);
      } else if (name === 'yip') {
        [0, 0.17].forEach((d) => {
          const o = ctx.createOscillator(), f = ctx.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(980, t + d); o.frequency.exponentialRampToValueAtTime(520, t + d + 0.1);
          f.type = 'lowpass'; f.frequency.value = 2400;
          o.connect(f).connect(envGain(ctx, t + d, 0.012, 0.12, 0.12)); o.start(t + d); o.stop(t + d + 0.14);
        });
      } else if (name === 'crunch') {
        for (let i = 0; i < 4; i++) {
          const s = noiseSrc(ctx), f = ctx.createBiquadFilter();
          f.type = 'bandpass'; f.frequency.value = 1500 + Math.random() * 900; f.Q.value = 1.2;
          s.connect(f).connect(envGain(ctx, t + i * 0.14, 0.005, 0.3, 0.07)); s.start(t + i * 0.14, Math.random()); s.stop(t + i * 0.14 + 0.09);
        }
      } else if (name === 'shh') {
        const s = noiseSrc(ctx), f = ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.9;
        s.connect(f).connect(envGain(ctx, t, 0.12, 0.35, 1.2)); s.start(t); s.stop(t + 1.25);
      } else if (name === 'howl') {
        const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(380, t); o.frequency.linearRampToValueAtTime(720, t + 0.45); o.frequency.linearRampToValueAtTime(540, t + 1.5);
        lfo.frequency.value = 5.5; lg.gain.value = 14; lfo.connect(lg).connect(o.frequency);
        o.connect(envGain(ctx, t, 0.15, 0.16, 1.6)); o.start(t); lfo.start(t); o.stop(t + 1.65); lfo.stop(t + 1.65);
      } else if (name === 'roar') {
        const s = noiseSrc(ctx), f = ctx.createBiquadFilter(), o = ctx.createOscillator(), og = ctx.createGain();
        f.type = 'lowpass'; f.frequency.value = 520;
        o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.linearRampToValueAtTime(75, t + 0.9);
        const g = envGain(ctx, t, 0.06, 0.32, 1.0); og.gain.value = 0.35;
        s.connect(f).connect(g); o.connect(og).connect(g); s.start(t); o.start(t); s.stop(t + 1.05); o.stop(t + 1.05);
      } else if (name === 'kiss') {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(2600, t + 0.07);
        o.connect(envGain(ctx, t, 0.005, 0.18, 0.09)); o.start(t); o.stop(t + 0.1);
      }
    } catch (e) { /* sound effects are optional */ }
  }

  /* ---------------- recording ---------------- */
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
      // If the microphone never answers, give up after 12 s instead of freezing the button
      // (a stream that arrives later is closed right away).
      const req = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
      const stream = await Promise.race([req, wait(12000).then(() => null)]);
      if (!stream) { req.then((s) => s.getTracks().forEach((t) => t.stop()), () => {}); throw new Error('mic timeout'); }
      this.stream = stream;
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

  /* ---------------- playback ---------------- */
  // One shared <audio> element: once a tap has started it, iPad lets it play again later
  // (after a recording, or piece after piece) without another tap.
  const player = new Audio();
  player.preload = 'auto';
  const SILENT_URL = URL.createObjectURL(new Blob([Cut.wavBuffer(new Float32Array(1600), 16000)], { type: 'audio/wav' }));
  let curSrc = null, playDone = null;
  const isPlaying = () => !!playDone;
  function stopAudio() {
    try { player.pause(); } catch (e) { /* ignore */ }
    if (curSrc) { try { curSrc.stop(); } catch (e) { /* ignore */ } curSrc = null; }
    if (playDone) { const f = playDone; playDone = null; f(); }
  }
  function decode(blob) {
    const ctx = audioCtx();
    if (!ctx) return Promise.reject(new Error('no audio'));
    return blob.arrayBuffer().then((ab) => new Promise((res, rej) => {
      try { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); }
    }));
  }
  async function playViaContext(blob) {
    const ctx = audioCtx(); if (!ctx) return;
    try {
      const buf = await decode(blob);
      if (ctx.state !== 'running') { try { await Promise.race([ctx.resume(), wait(300)]); } catch (e) { /* ignore */ } }
      if (ctx.state !== 'running') return;
      await new Promise((res) => {
        const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); curSrc = s;
        let fin = false; const done = () => { if (fin) return; fin = true; if (curSrc === s) curSrc = null; res(); };
        s.onended = done; setTimeout(done, (buf.duration + 0.6) * 1000); s.start();
      });
    } catch (e) { /* undecodable */ }
  }
  function playBlob(blob) {
    stopAudio();
    return new Promise((res) => {
      const url = URL.createObjectURL(blob);
      let settled = false;
      const finish = () => {
        if (settled) return; settled = true;
        player.onended = null; player.onerror = null;
        if (playDone === finish) playDone = null;
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        res();
      };
      const fallback = () => { if (settled) return; player.onended = null; player.onerror = null; playViaContext(blob).then(finish); };
      playDone = finish;
      player.onended = finish;
      player.onerror = fallback;
      player.src = url;
      let p;
      try { p = player.play(); } catch (e) { fallback(); return; }
      if (p && p.catch) p.catch((e) => { if (!e || e.name !== 'AbortError') fallback(); });
    });
  }
  let audioUnlocked = false;
  function unlockAudio() {
    audioCtx();
    if (audioUnlocked) return;
    audioUnlocked = true;
    try { player.src = SILENT_URL; const p = player.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }

  /* model recordings: decoded once, trimmed, and cut into pieces where the reader paused */
  const modelCache = new Map();
  function getModel(key) {
    if (modelCache.has(key)) return modelCache.get(key);
    const p = (async () => {
      const blob = await blobs.get(key);
      if (!blob) return null;
      const m = { key, blob, buf: null, whole: null, pieces: [], wav: {} };
      try {
        const buf = await decode(blob);
        m.buf = buf;
        const seg = Cut.findSegments(buf.getChannelData(0), buf.sampleRate);
        if (seg) { m.whole = seg.whole; m.pieces = seg.pieces.length > 1 ? seg.pieces : []; }
      } catch (e) { /* can't decode here: play the original file */ }
      return m;
    })();
    modelCache.set(key, p);
    return p;
  }
  const forgetModel = (key) => modelCache.delete(key);
  function playModel(m, which) {
    if (!m) return Promise.resolve();
    const range = which === 'whole' ? m.whole : m.pieces[which];
    if (!m.buf || !range) return playBlob(m.blob);
    const k = String(which);
    if (!m.wav[k]) {
      const sr = m.buf.sampleRate; const ch = m.buf.getChannelData(0);
      const a = Math.max(0, Math.floor(range[0] * sr)), b = Math.min(ch.length, Math.ceil(range[1] * sr));
      m.wav[k] = new Blob([Cut.wavBuffer(ch.subarray(a, b), sr)], { type: 'audio/wav' });
    }
    return playBlob(m.wav[k]);
  }

  // Listens until she says something (or time runs out). Used for the puppy's tricks.
  // true = heard a voice, false = silence, null = no microphone.
  async function listenForVoice(maxMs) {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return null;
    const ctx = audioCtx();
    if (!ctx) return null;
    let stream;
    try {
      const req = navigator.mediaDevices.getUserMedia({ audio: true });
      stream = await Promise.race([req, wait(8000).then(() => null)]);
      if (!stream) { req.then((s) => s.getTracks().forEach((t) => t.stop()), () => {}); return null; }
    } catch (e) { return null; }
    if (ctx.state !== 'running') { try { await Promise.race([ctx.resume(), wait(300)]); } catch (e) { /* ignore */ } }
    let src, an;
    try {
      if (ctx.state !== 'running') throw new Error('suspended');
      src = ctx.createMediaStreamSource(stream); an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    } catch (e) { stream.getTracks().forEach((t) => t.stop()); return null; }
    const data = new Uint8Array(an.fftSize);
    return new Promise((res) => {
      const t0 = performance.now();
      // base = the quietest moment in the first 0.3 s (she may start talking right away)
      let last = t0, base = Infinity, voiced = 0, quiet = 0, raf = 0, done = false, to = 0;
      const finish = (v) => {
        if (done) return; done = true;
        cancelAnimationFrame(raf); clearTimeout(to);
        try { src.disconnect(); } catch (e) { /* ignore */ }
        stream.getTracks().forEach((t) => t.stop());
        res(v);
      };
      to = setTimeout(() => finish(false), maxMs + 400);
      const tick = (now) => {
        an.getByteTimeDomainData(data);
        let s = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; }
        const rms = Math.sqrt(s / data.length); const dt = now - last; last = now;
        if (now - t0 < 300) base = Math.min(base, rms);
        if (now - t0 >= 120) { // the first frames only set the base
          const thr = Math.min(0.08, Math.max(0.025, base * 3));
          if (rms > thr) { voiced += dt; quiet = 0; } else if (voiced > 0) quiet += dt;
          if (voiced > 150 && (quiet > 300 || voiced > 1400)) { finish(true); return; }
        }
        if (now - t0 > maxMs) { finish(false); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
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
  function promptBox(title, value) {
    return new Promise((res) => {
      modal(`<div class="modal-box" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><input id="p-in" maxlength="16" autocomplete="off" value="${esc(value || '')}"><div class="row center"><button class="btn go" id="p-ok" type="button">שמירה</button><button class="btn" id="p-cancel" type="button">ביטול</button></div></div>`);
      $('#p-ok').onclick = () => { const v = $('#p-in').value.trim(); closeModal(); res(v || null); };
      $('#p-cancel').onclick = () => { closeModal(); res(null); };
    });
  }
  let toastT = 0;
  function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms); }
  function confetti(symbols = ['🦴', '🐾', '⭐', '🎉']) {
    if (reduced()) return;
    const c = $('#confetti'); const ctx = c.getContext('2d'); const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  // Centre of an element on screen (or a {x, y} point passed through).
  function rectPoint(t) {
    const mid = { x: innerWidth / 2, y: innerHeight / 2 };
    if (!t) return mid;
    if (t.getBoundingClientRect) { const r = t.getBoundingClientRect(); return r.width || r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : mid; }
    return t;
  }
  function flyTo(sym, from, to, ms = 700) {
    if (reduced()) return Promise.resolve();
    const a = rectPoint(from), b = rectPoint(to);
    return new Promise((res) => {
      const s = document.createElement('div');
      s.className = 'flyer'; s.innerHTML = `<span>${sym}</span>`;
      s.style.left = a.x + 'px'; s.style.top = a.y + 'px';
      document.body.appendChild(s);
      const dx = b.x - a.x, dy = b.y - a.y;
      let done = false; const fin = () => { if (done) return; done = true; s.remove(); res(); };
      if (s.animate) {
        const an = s.animate([
          { transform: 'translate(0px, 0px) scale(.7)' },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) scale(1.5)`, offset: 0.45 },
          { transform: `translate(${dx}px, ${dy}px) scale(.8)` },
        ], { duration: ms, easing: 'ease-in-out', fill: 'forwards' });
        an.onfinish = fin;
      }
      setTimeout(fin, ms + 250);
    });
  }

  /* ---------------- her drawings ---------------- */
  const picURLs = new Map();
  async function picURL(id) {
    if (picURLs.has(id)) return picURLs.get(id);
    const b = await blobs.get('draw:' + id);
    const u = b ? URL.createObjectURL(b) : null;
    picURLs.set(id, u); return u;
  }
  function invalidatePic(id) { const u = picURLs.get(id); if (u) URL.revokeObjectURL(u); picURLs.delete(id); }

  /* ---------------- the puppy's treats, levels and prizes ---------------- */
  const look = () => ({ fur: state.pup.fur, ear: state.pup.ear, wear: state.pup.wear });
  const TREATS = D.treats;
  const UNLOCKS = D.unlocks.map(([type, id]) => ({ type, id }));
  const levelCost = (n) => 5 + 2 * n; // treats from level n-1 to level n: 7, 9, 11, ...
  function levelInfo(fed) {
    let lvl = 0, base = 0;
    while (fed - base >= levelCost(lvl + 1)) { base += levelCost(lvl + 1); lvl++; }
    return { lvl, into: fed - base, need: levelCost(lvl + 1) };
  }
  const curLevel = () => levelInfo(state.pup.fed).lvl;
  const unlockLevel = (type, id) => UNLOCKS.findIndex((u) => u.type === type && u.id === id) + 1;
  const isOpen = (type, id) => { const l = unlockLevel(type, id); return l > 0 && l <= curLevel(); };
  const hasTrick = (id) => id === 'sit' || isOpen('trick', id);
  const hasAcc = (id) => isOpen('acc', id);
  const hasColor = (c) => D.colors.indexOf(c) < D.baseColors || isOpen('color', c);
  function unlockInfo(u, lvl) {
    const name = state.pup.name;
    if (!u) return { e: '🏅', title: `${name} עלה לרמה ${lvl}!` };
    if (u.type === 'trick') { const t = D.tricks.find((x) => x.id === u.id); return { e: t.e, title: `${name} למד טריק חדש: ${t.cmd}` }; }
    if (u.type === 'acc') { const a = D.accessories.find((x) => x.id === u.id); return { e: a.e, title: `מתנה חדשה: ${a.name}!` }; }
    return { e: '🎨', title: 'צבע חדש לפרווה!', color: u.id };
  }
  const nextUnlockIcon = (lvl) => unlockInfo(UNLOCKS[lvl], lvl + 1).e;
  const levelHTML = (L) => `<div class="lvl-meter" aria-label="רמה ${L.lvl}"><span>❤️ ${L.lvl}</span><div class="bar love"><i style="width:${Math.round((L.into / L.need) * 100)}%"></i></div><span class="next" title="הפרס הבא">🎁${nextUnlockIcon(L.lvl)}</span></div>`;
  const jarCount = () => Object.values(state.pup.jar).reduce((a, b) => a + (b || 0), 0);
  const jarHTML = () => `<span class="jar" id="jar" title="צנצנת החטיפים">🫙 <b>${jarCount()}</b></span>`;
  function pickTreat() {
    const pool = TREATS.filter((t) => t.w > 0);
    let r = Math.random() * pool.reduce((a, t) => a + t.w, 0);
    for (const t of pool) { r -= t.w; if (r < 0) return t; }
    return pool[0];
  }
  function updateJar(bump) {
    $$('.jar b').forEach((b) => { b.textContent = jarCount(); });
    const j = $('#jar');
    if (bump && j) { j.classList.remove('bump'); void j.offsetWidth; j.classList.add('bump'); }
  }
  // Adds treats to the jar, with each one flying there from where she earned it.
  function earn(n, from, kind) {
    if (n <= 0) return;
    const got = [];
    for (let i = 0; i < n; i++) {
      const t = (kind && TREATS.find((x) => x.k === kind)) || pickTreat();
      state.pup.jar[t.k] = (state.pup.jar[t.k] || 0) + 1; got.push(t);
    }
    const d = dayRec(); d.treats = (d.treats || 0) + n;
    if (S) S.treats.push(...got.map((t) => t.e));
    save();
    const a = rectPoint(from);
    got.forEach((t, i) => setTimeout(() => {
      sfx('pop');
      const jar = $('#jar');
      if (jar) flyTo(t.e, a, jar, 750).then(() => updateJar(true)); else updateJar(false);
    }, i * 200));
    Lane.cheer();
  }

  /* ---------------- the puppy lane: a puppy that walks to the next thing to do ---------------- */
  const Lane = (() => {
    const lane = $('#pup-lane');
    const host = $('#lane-pup');
    let pup = null, x = null, on = false, target = null, icon = '', idleT = 0, sleepT = 0, walkT = 0, asleep = false, listening = false;
    const W = () => host.offsetWidth || 104;
    const laneH = () => lane.offsetHeight || 128;
    const busy = () => recorder.active || isPlaying();
    function ensure() {
      if (pup) return;
      pup = Pup.mount(host, look());
      host.addEventListener('click', pet);
    }
    function setX(nx, dur) {
      nx = Math.max(6, Math.min(innerWidth - W() - 6, nx));
      host.style.transitionDuration = (dur || 0) + 'ms';
      host.style.transform = `translateX(${Math.round(nx)}px)`;
      x = nx;
    }
    function walk(nx) {
      nx = Math.max(6, Math.min(innerWidth - W() - 6, nx));
      const d = Math.abs(nx - (x === null ? nx : x));
      if (d < 8) return Promise.resolve();
      const dur = Math.min(1500, 250 + d * 2);
      pup.el.classList.remove('point-up', 'point-l', 'point-r');
      pup.el.classList.add('walking');
      setX(nx, dur);
      clearTimeout(walkT);
      return new Promise((r) => { walkT = setTimeout(() => { if (pup) pup.el.classList.remove('walking'); r(); }, dur); });
    }
    function clear() {
      if (target) target.classList.remove('pup-target');
      target = null; icon = '';
      if (pup) { pup.el.classList.remove('point-up', 'point-l', 'point-r'); if (!asleep) pup.bubble(null); }
    }
    async function stand(el) {
      let r = el.getBoundingClientRect();
      const laneTop = innerHeight - laneH();
      if (r.bottom > laneTop - 8) { // hidden behind the lane: scroll it up if the page can
        const dy = r.bottom - (laneTop - 16);
        if (r.top - dy > 60) {
          window.scrollBy({ top: dy, behavior: reduced() ? 'auto' : 'smooth' });
          await wait(380);
          if (target !== el) return;
          r = el.getBoundingClientRect();
        }
      }
      const w = W();
      let nx, side = 'up';
      if (r.bottom > laneTop - 8) {
        if (innerWidth - r.right >= w + 12) { nx = r.right + 6; side = 'l'; } else { nx = r.left - w - 6; side = 'r'; }
      } else nx = r.left + r.width / 2 - w / 2;
      await walk(nx);
      if (target !== el || !pup) return;
      pup.el.classList.remove('point-up', 'point-l', 'point-r');
      if (!listening) pup.el.classList.add('point-' + side);
      if (icon) pup.bubble(icon);
    }
    async function to(el, ic) {
      if (!on) return;
      ensure(); wake(); clear(); idle();
      icon = ic || '';
      if (!el || !el.isConnected || el.hidden) { if (icon) pup.bubble(icon); return; }
      target = el; el.classList.add('pup-target');
      await stand(el);
    }
    function listen(ic = '👂') {
      if (!on) return;
      ensure(); wake(); listening = true;
      pup.el.classList.remove('point-up', 'point-l', 'point-r');
      pup.el.classList.add('listen'); pup.bubble(ic);
    }
    function idle() { listening = false; if (pup) pup.el.classList.remove('listen'); }
    function cheer() { if (!on || !pup) return; pup.flash('happy', 700); pup.fx('❤️', 1); }
    function mouth(m) { if (!pup) return; pup.baseMouth = m || 'happy'; if (!asleep) pup.mouth(pup.baseMouth); }
    function poke() {
      clearTimeout(idleT); clearTimeout(sleepT);
      if (!on) return;
      idleT = setTimeout(nudge, 15000); sleepT = setTimeout(sleep, 90000);
    }
    function nudge() {
      if (!on) return;
      if (!busy() && !asleep && target && target.isConnected) { pup.flash('happy', 700); sfx('yip'); stand(target); }
      idleT = setTimeout(nudge, 20000);
    }
    function sleep() {
      if (!on) return;
      if (busy()) { sleepT = setTimeout(sleep, 30000); return; }
      asleep = true; pup.eyes('closed'); pup.mouth('sleep'); pup.el.classList.add('sleeping'); pup.bubble('💤');
    }
    function wake() {
      if (!asleep || !pup) return;
      asleep = false; pup.eyes(''); pup.mouth(pup.baseMouth); pup.el.classList.remove('sleeping'); pup.bubble(icon || null);
    }
    function pet(e) { e.stopPropagation(); wake(); poke(); sfx('yip'); pup.flash('happy', 700); pup.fx('❤️', 2); }
    function show(v) {
      on = v; lane.hidden = !v; document.body.classList.toggle('has-lane', v);
      if (v) { ensure(); if (x === null) setX(innerWidth - W() - 24, 0); poke(); } else { clear(); idle(); clearTimeout(idleT); clearTimeout(sleepT); }
    }
    function refresh() { if (pup) pup.setLook(look()); }
    document.addEventListener('pointerdown', () => { if (on) { wake(); poke(); } }, true);
    window.addEventListener('resize', debounce(() => { if (!on) return; if (target && target.isConnected) stand(target); else if (x !== null) setX(x, 0); }, 150));
    window.addEventListener('scroll', debounce(() => { if (on && target && target.isConnected) stand(target); }, 220), { passive: true });
    return { show, to, clear, listen, idle, cheer, mouth, refresh, el: () => host };
  })();
  function refreshPups() { Lane.refresh(); if (roomPup) roomPup.setLook(look()); }

  /* ---------------- choosing today's sentences ---------------- */
  // Prefers sentences that have a recording, so she can practise without reading.
  function pickFrom(n, exclude, ok) {
    const t = today();
    const order = new Map(state.sentences.map((s, i) => [s.id, i]));
    const list = state.sentences.filter((s) => !exclude.includes(s.id) && ok(s));
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
        if (bossCap && s.l === 3 && out.some((q) => q.l === 3)) continue;
        out.push(s); max--;
      }
    };
    take(due, n - 1, true); take(fresh, 2, true); take(due, n, true); take(fresh, n, true); take(later, n, true);
    take(due, n, false); take(fresh, n, false); take(later, n, false);
    return out;
  }
  // Recorded sentences come first (she can do those alone), then the ones a grown-up reads out.
  function pickSentences(n, exclude, recorded) {
    const byLevel = (a, b) => a.l - b.l;
    const first = recorded && recorded.size ? pickFrom(n, exclude, (s) => recorded.has(s.id)).sort(byLevel) : [];
    const rest = first.length < n ? pickFrom(n - first.length, exclude.concat(first.map((s) => s.id)), (s) => !recorded || !recorded.has(s.id)).sort(byLevel) : [];
    return first.concat(rest);
  }
  const recordedIds = async () => new Set((await blobs.keys('model:')).map((k) => k.slice(6)));
  async function recordedCounts() {
    const ids = await recordedIds();
    const words = new Set(await blobs.keys('word:'));
    return {
      sent: state.sentences.filter((s) => ids.has(s.id)).length,
      word: D.pairs.reduce((n, p) => n + (words.has('word:' + p.sh) ? 1 : 0) + (words.has('word:' + p.s) ? 1 : 0), 0),
    };
  }
  const warmKey = (c) => 'warm:' + hashId(c.text);

  /* ---------------- navigation ---------------- */
  let view = null;
  let leaveFns = [];
  const onLeave = (fn) => leaveFns.push(fn);
  const VIEWS = {};
  const LANE_VIEWS = new Set(['session', 'album', 'practice']);
  function go(name, arg) {
    leaveFns.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
    leaveFns = [];
    stopAudio();
    if (recorder.active) recorder.stop();
    view = name;
    window.scrollTo(0, 0);
    Lane.clear(); Lane.idle(); Lane.mouth('happy');
    Lane.show(LANE_VIEWS.has(name));
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
    const doneToday = sec >= target; const P = state.pup;
    app.innerHTML = `
      <header class="hero">
        <div class="hero-pup" id="hero-pup" role="img" aria-label="${esc(P.name)}"></div>
        <div class="hero-side">
          <div class="bubble">היי ${esc(state.name || '')}! ${doneToday ? '🎉 היום כבר התאמנת!' : 'מוכנה לשששש? 🐾'}<small>אני ${esc(P.name)}. כל משפט שאת אומרת = חטיף בשבילי 🦴</small></div>
          <div class="hero-meta">${jarHTML()}${levelHTML(levelInfo(P.fed))}</div>
        </div>
      </header>
      <button class="btn big go start" id="start" type="button">▶️ מתחילים! <span class="mins">⏱️ ${state.minutes}</span></button>
      <div class="row home-row">
        <button class="btn tall" id="house" type="button"><span class="bi">🏠</span>הבית של ${esc(P.name)}</button>
        <button class="btn tall" id="album" type="button"><span class="bi">🎨</span>האלבום שלי</button>
      </div>
      <section class="today">
        <div class="today-head"><h2>🐾 השבוע שלי</h2><span>היום: ${Math.floor(sec / 60)} / ${state.minutes} דק׳</span></div>
        <div class="bar"><i style="width:${Math.min(100, (sec / target) * 100)}%"></i></div>
        <div class="week">${weekHTML()}</div>
      </section>
      <div id="parent-note"></div>
      <div class="row"><span class="spacer"></span><button class="btn small ghost hold" id="parent" type="button"><span class="fill"></span>👪 להורים (לחיצה ארוכה)</button></div>`;
    const hp = Pup.mount($('#hero-pup'), look());
    hp.bubble(doneToday ? '❤️' : '▶️');
    $('#hero-pup').onclick = () => { sfx('yip'); hp.flash('happy', 700); hp.fx('❤️', 2); };
    $('#start').onclick = () => { audioCtx(); startSession(); };
    $('#start').classList.add('pup-target');
    $('#house').onclick = () => go('house');
    $('#album').onclick = () => go('album');
    holdButton($('#parent'), () => go('parent'));
    recordedCounts().then((c) => {
      const el = $('#parent-note');
      if (!el || c.sent >= state.sentences.length) return;
      el.innerHTML = `<div class="parent-note">🎙️ <b>להורים:</b> ${c.sent} מתוך ${state.sentences.length} משפטים מוקלטים. משפט בלי הקלטה צריך מבוגר שיקריא אותו. כדי להקליט: לחיצה ארוכה על ״להורים״, ואז ״אולפן הקלטות״.</div>`;
    });
  };

  /* ---------------- session ---------------- */
  let S = null;
  const STEPS = [['warm', '🪞', 'חימום'], ['listen', '👂', 'הקשבה'], ['sent', '🗣️', 'משפטים'], ['draw', '🎨', 'ציור'], ['done', '🎉', 'סיום']];
  const STEP_RENDER = {};
  async function startSession() {
    const rec = await recordedIds();
    S = {
      step: 0, queue: pickSentences(state.perSession, [], rec).map((s) => s.id), qi: 0, card: null, rec,
      warmIdx: 0, warmPaid: false, L: null, treats: [], tries: 0, bannerShown: dayRec().sec >= state.minutes * 60,
    };
    go('session');
  }
  function endSession() { if (S && S.card) { S.card.alive = false; finalizeCard(S.card); } S = null; save(true); }
  let wakeLock = null; // keeps the iPad screen on during a session
  async function requestWake() { try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* optional */ } }
  function releaseWake() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }

  VIEWS.session = () => {
    if (!S) { go('home'); return; }
    app.innerHTML = `
      <div class="sbar">
        <button class="btn small ghost" id="exit" type="button" aria-label="יציאה">✕</button>
        <nav class="steps" id="steps" aria-label="שלבי האימון"></nav>
        ${jarHTML()}
        <div class="clock" id="clock" aria-label="זמן"><div class="bar"><i id="clock-bar"></i></div><b id="clock-t">0:00</b></div>
      </div>
      <div id="banner"></div>
      <main class="stage" id="stage"></main>`;
    $('#exit').onclick = async () => {
      if (S.step >= 4 || await confirmBox('לצאת מהאימון?', 'הדקות והחזרות כבר נשמרו.', 'לצאת', 'להישאר')) { endSession(); go('home'); }
    };
    const stopTick = startTicker();
    requestWake();
    onLeave(() => { stopTick(); releaseWake(); stopCamera(); if (S && S.card) S.card.alive = false; });
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
    b.innerHTML = `<div class="banner">⏰ ${state.minutes} דקות! כל הכבוד 🎉 🧁<span class="spacer"></span><button class="btn small good" id="b-draw" type="button">🎨 לציור ולסיום</button><button class="btn small ghost" id="b-close" type="button">עוד קצת</button></div>`;
    sfx('win');
    const d = dayRec();
    if (!d.cake) { d.cake = true; earn(1, $('#banner .banner'), 'cupcake'); }
    $('#b-draw').onclick = () => { b.innerHTML = ''; gotoStep(3); };
    $('#b-close').onclick = () => { b.innerHTML = ''; };
  }
  function renderStep() {
    const nav = $('#steps'); if (!nav || !S) return;
    nav.innerHTML = STEPS.map(([, ic, label], i) => `<button class="step${i === S.step ? ' on' : i < S.step ? ' past' : ''}" data-i="${i}" type="button"><span class="si">${ic}</span><span class="sl">${label}</span></button>`).join('');
    $$('.step', nav).forEach((b) => { b.onclick = () => { const i = +b.dataset.i; if (i === 4 && S.step !== 4) return; gotoStep(i); }; });
    if (S.step !== 0) stopCamera();
    Lane.clear(); Lane.idle(); Lane.mouth('happy');
    STEP_RENDER[STEPS[S.step][0]]($('#stage'));
  }
  function gotoStep(i) {
    if (S.card) { S.card.alive = false; finalizeCard(S.card); S.card = null; }
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
      ${nextStepBtn('סיימתי חימום ➡️')}`;
    $('#cam').onclick = startCamera;
    $('#next-step').onclick = () => { if (!S.warmPaid) { S.warmPaid = true; earn(1, $('#next-step')); } gotoStep(1); };
    renderWarmCard();
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) startCamera();
  };
  async function renderWarmCard() {
    const cards = D.warmup; const i = S.warmIdx; const c = cards[i];
    const box = $('#warm-card'); if (!box) return;
    box.innerHTML = `
      <div class="warm-big">${c.big}</div>
      <p class="warm-text">${shinMark(c.text)}</p>
      <p class="warm-sub">${esc(c.sub)}</p>
      <div class="row center"><button class="round listen" id="w-hear" type="button" hidden><span class="ic">🔊</span><span class="lb">לשמוע</span></button></div>
      <div class="warm-nav"><button class="btn small" id="w-prev" type="button" aria-label="הקודם"${i === 0 ? ' disabled' : ''}>→</button><span>${i + 1} / ${cards.length}</span><button class="btn small" id="w-next" type="button" aria-label="הבא"${i === cards.length - 1 ? ' disabled' : ''}>←</button></div>`;
    $('#w-prev').onclick = () => { S.warmIdx = Math.max(0, i - 1); renderWarmCard(); };
    $('#w-next').onclick = () => { S.warmIdx = Math.min(cards.length - 1, i + 1); renderWarmCard(); sfx('tap'); };
    Lane.mouth(c.m || 'happy');
    const last = i === cards.length - 1;
    Lane.to(last ? $('#next-step') : $('#w-next'), last ? '➡️' : esc(c.big));
    const m = await getModel(warmKey(c));
    const hb = $('#w-hear');
    if (!m || !S || S.warmIdx !== i || !hb) return;
    hb.hidden = false;
    const play = async () => { hb.classList.add('playing'); await playModel(m, 'whole'); hb.classList.remove('playing'); };
    hb.onclick = play;
    play();
  }

  /* listening game: ש or ס? */
  STEP_RENDER.listen = async (stage) => {
    if (!S.L) {
      const words = new Set((await blobs.keys('word:')).map((k) => k.slice(5)));
      if (!S) return;
      S.L = S.L || { round: 0, total: 6, ok: 0, phase: 'start', pairs: shuffle(D.pairs), words };
    }
    if (!S || STEPS[S.step][0] !== 'listen' || !stage.isConnected) return;
    renderListen(stage);
  };
  function renderListen(stage) {
    const L = S.L;
    if (L.round >= L.total) {
      stage.innerHTML = `<section class="panel center-panel"><h2>👂 סיימנו את משחק ההקשבה!</h2><p class="result">🎯 ${L.ok} / ${L.total}</p></section>${nextStepBtn('למשפטים ➡️')}`;
      $('#next-step').onclick = () => gotoStep(2);
      Lane.to($('#next-step'), '➡️');
      return;
    }
    const pair = L.pairs[L.round % L.pairs.length];
    if (L.phase === 'start') {
      L.target = Math.random() < 0.5 ? 'sh' : 's';
      L.mode = L.words.has(pair.sh) && L.words.has(pair.s) ? 'hear' : 'parent';
      L.phase = L.mode === 'hear' ? 'pick' : 'secret';
      L.order = shuffle(['sh', 's']); L.picked = null; L.spoken = false;
    }
    const word = (k) => (k === 'sh' ? pair.sh : pair.s);
    const emo = (k) => (k === 'sh' ? pair.shE : pair.sE);
    const opts = (reveal) => `<div class="pair">${L.order.map((k) => `<button class="pick${reveal && k === L.target ? ' right' : ''}${reveal && k === L.picked && k !== L.target ? ' wrong' : ''}" data-k="${k}" type="button"><span class="pe">${emo(k)}</span><span class="pw">${word(k)}</span></button>`).join('')}</div>`;
    const head = `<div class="row"><span class="score">${L.round + 1} / ${L.total} · ✅ ${L.ok}</span><span class="spacer"></span><button class="btn small ghost" id="skip" type="button">דילוג ➡️</button></div>`;
    let body = '';
    if (L.phase === 'pick') body = `<h2>👂 ${esc(state.pup.name)} אומר מילה. איזו?</h2><div class="row center"><button class="round listen" id="say" type="button"><span class="ic">🔊</span><span class="lb">שוב</span></button></div>${opts(false)}`;
    else if (L.phase === 'secret') body = `<h2>👪 הורה, לעצום עיניים! 🙈</h2><p class="lead">${esc(state.name || '')}, רק את מסתכלת. לוחצים, רואים את המילה הסודית, ואומרים אותה בקול.</p><div class="row center"><button class="btn go big" id="reveal" type="button">👀 להראות לי</button></div>`;
    else if (L.phase === 'show') body = `<div class="secret"><span class="pe">${emo(L.target)}</span><span class="pw">${word(L.target)}</span></div><p class="lead" style="text-align:center">אומרים את המילה בקול, ברור וחזק. ואז לוחצים.</p><div class="row center"><button class="btn go big" id="said" type="button">אמרתי! 🙈</button></div>`;
    else if (L.phase === 'guess') body = `<h2>👪 הורה, אפשר לפתוח עיניים. מה שמעתם?</h2>${opts(false)}`;
    else if (L.phase === 'result') {
      const right = L.picked === L.target;
      let msg;
      if (L.mode === 'hear') msg = right ? `🎉 נכון! ${word(L.target)}` : `👂 זה היה ${word(L.target)}`;
      else msg = right ? `🎉 ההורה הבין! אמרת ${word(L.target)} בדיוק.` : `🤔 ההורה שמע ${word(L.picked)}, והמילה הייתה ${word(L.target)}. ${esc(state.cue)}`;
      body = `${opts(true)}<p class="result">${msg}</p><div class="row center">${!right && L.mode === 'parent' ? '<button class="btn" id="retry" type="button">🔁 עוד ניסיון</button>' : ''}${L.mode === 'hear' ? '<button class="btn" id="say" type="button">🔊 שוב</button>' : ''}<button class="btn go" id="lnext" type="button">הבא ➡️</button></div>`;
    }
    stage.innerHTML = `<section class="panel">${head}${body}</section>`;
    const sayWord = async () => {
      const m = await getModel('word:' + word(L.target)); if (!m) return;
      const b = $('#say'); if (b) b.classList.add('playing');
      Lane.clear(); Lane.listen();
      await playModel(m, 'whole');
      Lane.idle();
      if (b && b.isConnected) b.classList.remove('playing');
      if (L.phase === 'pick' && $('.pair')) Lane.to($('.pair'), '🤔');
    };
    $('#skip').onclick = () => gotoStep(2);
    const sayBtn = $('#say'); if (sayBtn) sayBtn.onclick = sayWord;
    const rev = $('#reveal'); if (rev) rev.onclick = () => { L.phase = 'show'; renderListen(stage); };
    const said = $('#said'); if (said) said.onclick = () => { L.phase = 'guess'; renderListen(stage); };
    const retry = $('#retry'); if (retry) retry.onclick = () => { L.phase = 'secret'; L.picked = null; renderListen(stage); };
    const ln = $('#lnext'); if (ln) ln.onclick = () => { L.round++; L.phase = 'start'; renderListen(stage); };
    if (L.phase === 'pick' || L.phase === 'guess') {
      $$('.pick', stage).forEach((b) => {
        b.onclick = () => {
          L.picked = b.dataset.k; const right = L.picked === L.target;
          const from = rectPoint(b);
          if (right) L.ok++;
          state.listen.all++; if (right) state.listen.ok++; save();
          sfx(right ? 'good' : 'oops');
          if (right) earn(1, from);
          L.phase = 'result'; renderListen(stage);
        };
      });
    }
    if (L.phase === 'pick') { if (!L.spoken) { L.spoken = true; sayWord(); } else Lane.to($('.pair'), '🤔'); }
    else if (L.phase === 'result') Lane.to($('#lnext'), '➡️');
    else if (L.phase === 'secret') Lane.to($('#reveal'), '🙈');
    else if (L.phase === 'show') Lane.to($('#said'), '🗣️');
    else if (L.phase === 'guess') Lane.to($('.pair'), '👪');
  }

  /* sentence practice: hear it, see it, say it, hear yourself, rate it */
  STEP_RENDER.sent = (stage) => {
    if (S.qi >= S.queue.length) {
      const left = state.minutes * 60 - dayRec().sec;
      stage.innerHTML = `<section class="panel done"><h2>🎉 סיימת את המשפטים של היום!</h2><p class="lead">${left > 60 ? 'נשאר עוד זמן. עוד משפט?' : 'הגיע הזמן לצייר!'}</p><div class="row center"><button class="btn" id="more" type="button">➕ עוד משפט</button><button class="btn go" id="to-draw" type="button">🎨 לציור</button></div></section>`;
      $('#more').onclick = () => { const extra = pickSentences(1, S.queue, S.rec)[0]; if (extra) { S.queue.push(extra.id); renderStep(); } else toast('אין עוד משפטים 🙂'); };
      $('#to-draw').onclick = () => gotoStep(3);
      Lane.to(left > 60 ? $('#more') : $('#to-draw'), left > 60 ? '➕' : '🎨');
      return;
    }
    S.card = makeCard(S.queue[S.qi]);
    renderCard(stage, S.card, {
      pos: `${S.qi + 1} / ${S.queue.length}`,
      nextLabel: S.qi + 1 < S.queue.length ? 'משפט הבא ➡️' : 'סיימתי ➡️',
      onNext: () => { finalizeCard(S.card); S.card = null; S.qi++; renderStep(); window.scrollTo(0, 0); },
    });
  };

  function makeCard(id) {
    return { id, s: sentenceById(id), model: null, ready: false, alive: true, g: 0, y: 0, r: 0, n: 0, earned: 0, tip: false, lastRec: null, finalized: false, recTimer: 0, piece: -1, voice: null, starting: false, noMic: false };
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

  function renderCard(container, C, opts) {
    const s = C.s;
    container.innerHTML = `
      <article class="card" id="card">
        <div class="card-head">
          <span class="lvl" title="${esc(LEVEL_NAMES[s.l])}">${LEVEL_ICONS[s.l]}</span>
          <span class="qpos">${esc(opts.pos || '')}</span>
          <span class="spacer"></span>
          <button class="btn small ghost" id="t-text" type="button" hidden>👁️ טקסט</button>
        </div>
        <div class="card-body">
          <figure class="pic" id="pic"></figure>
          <div class="say-side">
            <div class="ask-parent" id="ask-parent" hidden>👪 <span>מבוגר מקריא את המשפט, ואת אומרת אחריו</span></div>
            <p class="sent-text" id="sent-text" hidden></p>
            <div class="big-tools">
              <button class="round listen" id="t-listen" type="button" hidden><span class="ic">🔊</span><span class="lb">לשמוע</span></button>
              <button class="round rec" id="t-rec" type="button"><span class="ic">🎤</span><span class="lb">עכשיו אני</span></button>
              <button class="round again" id="t-again" type="button" hidden><span class="ic">▶️</span><span class="lb">לשמוע אותי</span></button>
            </div>
            <div class="meter" id="meter" hidden><i></i></div>
            <div class="pieces" id="pieces" hidden></div>
            <div class="rate" id="rate" hidden>
              <p class="rate-q">👂 איך יצא?</p>
              <button class="rg" data-r="g" type="button"><span class="face">😀</span>שששש!</button>
              <button class="ry" data-r="y" type="button"><span class="face">🙂</span>כמעט</button>
              <button class="rr" data-r="r" type="button"><span class="face">😕</span>יצא ססס</button>
            </div>
            <div class="small-tools">
              <button class="btn small" id="t-pieces" type="button" hidden>🧩 חלק-חלק</button>
              <button class="btn small" id="t-spin" type="button">🎲 קול מצחיק</button>
              <span class="voice-chip" id="voice-chip" hidden></span>
            </div>
            <div class="paws" id="paws"></div>
            <div class="tip" id="tip" hidden></div>
          </div>
        </div>
        <div class="card-foot"><button class="btn go" id="c-next" type="button">${esc(opts.nextLabel)}</button></div>
      </article>`;
    setRecBtn(C, false);
    renderPaws(C); renderPic(C);
    $('#t-listen').onclick = async () => {
      audioCtx(); C.piece = -1; renderPieces(C);
      await hearWhole(C);
      if (C.alive) Lane.to($('#t-rec'), '🎤');
    };
    $('#t-rec').onclick = () => toggleRecord(C);
    $('#t-again').onclick = async () => {
      if (!C.lastRec) return;
      Lane.clear(); Lane.listen();
      await playBlob(C.lastRec);
      if (C.alive) Lane.idle();
    };
    $('#t-pieces').onclick = () => {
      audioCtx();
      if (C.piece >= 0) { C.piece = -1; stopAudio(); renderPieces(C); Lane.to($('#t-rec'), '🎤'); } else startPieces(C);
    };
    $('#t-spin').onclick = () => spinVoice(C);
    $('#t-text').onclick = () => { state.showText = !state.showText; save(); renderCardText(C); };
    $$('#rate button').forEach((b) => { b.onclick = () => rate(C, b.dataset.r, b); });
    $('#c-next').onclick = async () => {
      C.alive = false; clearTimeout(C.recTimer);
      if (recorder.active) await recorder.stop();
      stopAudio();
      opts.onNext();
    };
    cardIntro(C);
  }
  async function cardIntro(C) {
    C.model = await getModel('model:' + C.id);
    C.ready = true;
    if (!C.alive || !$('#t-rec')) return;
    const nP = C.model ? C.model.pieces.length : 0;
    $('#t-listen').hidden = !C.model;
    $('#t-pieces').hidden = nP < 2;
    renderCardText(C);
    if (!C.model) { Lane.to($('#t-rec'), '👪'); return; }
    const st = stat(C.id);
    if (st.box >= 2) { Lane.to($('#t-rec'), '🖼️'); return; } // she knows it: say it from the picture
    if (st.box === 0 && nP >= 3) { startPieces(C); return; } // new and long: piece by piece first
    await hearWhole(C);
    if (C.alive) Lane.to($('#t-rec'), '🎤');
  }
  function renderCardText(C) {
    const el = $('#sent-text'), ask = $('#ask-parent'), tb = $('#t-text');
    if (!el || !C.ready) return;
    const show = state.showText || !C.model;
    el.hidden = !show; el.innerHTML = show ? litSentence(C.s.t) : '';
    ask.hidden = !!C.model;
    tb.hidden = !C.model; tb.classList.toggle('on', state.showText); tb.setAttribute('aria-pressed', String(state.showText));
  }
  async function hearWhole(C) {
    if (!C.model) return;
    const b = $('#t-listen'); if (b) b.classList.add('playing');
    Lane.clear(); Lane.listen();
    await playModel(C.model, 'whole');
    if (b) b.classList.remove('playing');
    if (C.alive) Lane.idle();
  }
  function startPieces(C) { C.piece = 0; $('#rate').hidden = true; playPiece(C); }
  async function playPiece(C) {
    const i = C.piece;
    renderPieces(C);
    Lane.clear(); Lane.listen();
    await playModel(C.model, i);
    if (!C.alive || C.piece !== i) return;
    Lane.idle();
    Lane.to($('#pc-next'), '🗣️');
  }
  function renderPieces(C) {
    const el = $('#pieces'); if (!el) return;
    const tb = $('#t-pieces'); if (tb) tb.classList.toggle('on', C.piece >= 0);
    if (C.piece < 0 || !C.model) { el.hidden = true; el.innerHTML = ''; return; }
    const n = C.model.pieces.length;
    el.hidden = false;
    el.innerHTML = `<div class="dots" aria-label="חלק ${C.piece + 1} מתוך ${n}">${Array.from({ length: n }, (_, i) => `<span class="${i < C.piece ? 'past' : i === C.piece ? 'on' : ''}"></span>`).join('')}</div>
      <button class="btn small" id="pc-again" type="button">🔁 שוב</button>
      <button class="btn go" id="pc-next" type="button">${C.piece < n - 1 ? 'אמרתי! ➡️' : 'עכשיו הכל ביחד 🔗'}</button>
      <button class="btn small ghost" id="pc-close" type="button" aria-label="סגירה">✕</button>`;
    $('#pc-again').onclick = () => playPiece(C);
    $('#pc-next').onclick = async () => {
      if (C.piece < n - 1) { C.piece++; playPiece(C); return; }
      C.piece = -1; renderPieces(C);
      await hearWhole(C);
      if (C.alive) Lane.to($('#t-rec'), '🎤');
    };
    $('#pc-close').onclick = () => { stopAudio(); C.piece = -1; renderPieces(C); Lane.to($('#t-rec'), '🎤'); };
  }
  async function renderPic(C) {
    const fig = $('#pic'); if (!fig) return;
    const url = await picURL(C.id);
    if (!fig.isConnected) return;
    fig.innerHTML = `${url ? `<img src="${url}" alt="הציור שלך">` : `<div class="emoji">${C.s.e || '🎨'}</div>`}<button class="btn small" id="draw-it" type="button">🎨 ${url ? 'לצייר עוד' : 'לצייר'}</button>`;
    $('#draw-it').onclick = () => openDrawSentence(C.id, () => { invalidatePic(C.id); renderPic(C); }, false);
  }
  async function openDrawSentence(id, after, sayOnColor) {
    const s = sentenceById(id); if (!s) return;
    audioCtx();
    const m = await getModel('model:' + id);
    Draw.open({ key: 'draw:' + id, title: s.t, sentence: true, sentenceId: id, model: m, sayOnColor, onSave: after });
  }
  function renderPaws(C) {
    const el = $('#paws'); if (!el) return;
    el.innerHTML = `${[0, 1, 2, 3, 4].map((i) => `<span class="${i < C.n ? 'on' : ''}">🐾</span>`).join('')}${C.n >= 5 ? '<span class="star">⭐</span>' : ''}<small>😀 ${C.g} · 🙂 ${C.y} · 😕 ${C.r}</small>`;
  }
  function setRecBtn(C, on) {
    const b = $('#t-rec'); if (!b) return;
    const said = !canRecord || C.noMic;
    b.classList.toggle('on', on);
    $('.ic', b).textContent = on ? '⏹️' : said ? '🗣️' : '🎤';
    $('.lb', b).textContent = on ? 'סיימתי' : said ? 'אמרתי!' : 'עכשיו אני';
  }
  async function toggleRecord(C) {
    audioCtx();
    if (C.starting) return;
    if (!canRecord || C.noMic) { showRate(C); return; }
    if (!recorder.active) {
      stopAudio(); C.piece = -1; renderPieces(C); $('#rate').hidden = true;
      C.starting = true;
      const rb = $('#t-rec'); if (rb) $('.ic', rb).textContent = '⏳';
      try { await recorder.start($('#meter i')); } catch (e) {
        C.starting = false;
        if (e && e.message === 'mic timeout') { setRecBtn(C, false); toast('🎙️ המיקרופון לא ענה. לוחצים שוב', 3000); return; }
        C.noMic = true; setRecBtn(C, false);
        toast('🎙️ צריך לאשר גישה למיקרופון', 3000); showRate(C); return;
      }
      C.starting = false;
      if (!C.alive) { recorder.stop(); return; }
      setRecBtn(C, true); $('#meter').hidden = false;
      Lane.clear(); Lane.listen('👂');
      C.recTimer = setTimeout(() => { if (recorder.active && C.alive) toggleRecord(C); }, 25000);
      return;
    }
    clearTimeout(C.recTimer);
    setRecBtn(C, false);
    const meter = $('#meter'); if (meter) meter.hidden = true;
    const blob = await recorder.stop();
    if (!C.alive) return;
    if (!blob) { Lane.idle(); Lane.to($('#t-rec'), '🎤'); return; }
    C.lastRec = blob;
    const ab = $('#t-again'); ab.hidden = false; ab.classList.add('playing');
    saveRecording(C.id, blob);
    await playBlob(blob);
    if (!C.alive) return;
    ab.classList.remove('playing'); Lane.idle();
    showRate(C);
  }
  function showRate(C) {
    const r = $('#rate'); if (!r || !C.alive) return;
    r.hidden = false; r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash');
    Lane.to(r, '🤔');
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
      if (!chip.isConnected) { clearInterval(iv); return; }
      do { v = D.voices[rand(D.voices.length)]; } while (D.voices.length > 1 && v === C.voice);
      chip.textContent = `${v[0]} ${v[1]}`;
      if (++n >= steps) { clearInterval(iv); C.voice = v; chip.textContent = `${v[0]} ${v[1]}`; sfx('tap'); Lane.to($('#t-rec'), v[0]); }
    }, 70);
  }
  // Every try earns a treat (up to 5 per sentence), whatever she rates it: effort, not perfection.
  function rate(C, r, btn) {
    const from = rectPoint(btn);
    C[r]++; C.n++;
    const st = stat(C.id); st[r]++;
    const d = dayRec(); d[r]++; if (!d.ids.includes(C.id)) d.ids.push(C.id);
    if (S && view === 'session') S.tries++;
    $('#rate').hidden = true;
    sfx(r === 'g' ? 'good' : 'tap');
    if (C.earned < 5) { C.earned++; earn(1, from); }
    save(); renderPaws(C);
    if (C.n >= 5) {
      const nb = $('#c-next');
      if (C.n === 5) { sfx('win'); confetti(); if (nb) nb.classList.add('pulse'); }
      Lane.to(nb, '⭐');
      return;
    }
    if (C.r >= 3 && C.r > C.g && !C.tip) { showTip(C); return; }
    if (r === 'r' && C.model) Lane.to($('#t-listen'), '🔊'); else Lane.to($('#t-rec'), '🎤');
  }
  function showTip(C) {
    C.tip = true;
    const tip = $('#tip'); tip.hidden = false;
    const canPieces = !!(C.model && C.model.pieces.length > 1);
    tip.innerHTML = `😗 ${esc(state.cue)}${canPieces ? ' · 🧩 ננסה חלק-חלק' : ''}`;
    Lane.mouth('kiss');
    setTimeout(() => { if (C.alive) Lane.mouth('happy'); }, 4000);
    if (canPieces) Lane.to($('#t-pieces'), '🧩'); else if (C.model) Lane.to($('#t-listen'), '😗'); else Lane.to($('#t-rec'), '😗');
  }

  /* drawing time */
  async function fillTiles(container, ids, onTap) {
    const rec = await recordedIds();
    const tiles = await Promise.all(ids.map(async (id) => {
      const s = sentenceById(id); if (!s) return '';
      const url = await picURL(id); const st = stat(id);
      return `<button class="tile" data-id="${id}" type="button"><div class="thumb">${url ? `<img src="${url}" alt="">` : `<div class="emoji">${s.e || '🎨'}</div>`}</div>${state.showText ? `<p>${litSentence(s.t)}</p>` : ''}<span class="status s${st.box}" title="${esc(STATUS[st.box])}">${STATUS_KID[st.box]}</span>${rec.has(id) ? '<span class="has-voice" title="יש הקלטה">🔊</span>' : ''}</button>`;
    }));
    if (!container.isConnected) return;
    container.innerHTML = tiles.join('');
    $$('.tile', container).forEach((b) => { b.onclick = () => onTap(b.dataset.id); });
  }
  STEP_RENDER.draw = (stage) => {
    const todayIds = dayRec().ids;
    const ids = todayIds.length ? todayIds.slice() : S.queue.slice();
    stage.innerHTML = `<section class="panel"><h2>🎨 זמן ציור!</h2><p class="lead">בוחרים משפט, שומעים אותו, ומציירים. כל צבע חדש = אומרים את המשפט בקול! 🗣️</p><div class="pick-list" id="plist"></div></section>${nextStepBtn('סיימתי ➡️')}`;
    const refill = () => fillTiles($('#plist'), ids, (id) => openDrawSentence(id, () => { invalidatePic(id); refill(); }, true)).then(() => {
      if (!$('#plist')) return;
      const drew = (dayRec().drew || []).length;
      Lane.to(drew ? $('#next-step') : $('#plist .tile'), drew ? '➡️' : '🎨');
    });
    refill();
    $('#next-step').onclick = () => gotoStep(4);
  };

  STEP_RENDER.done = (stage) => {
    const d = dayRec(); const tr = S.treats;
    stage.innerHTML = `<section class="panel done">
      <h2>🎉 כל הכבוד ${esc(state.name || '')}!</h2>
      <div class="sum"><div><b>${Math.round(d.sec / 60)}</b>⏱️ דקות היום</div><div><b>${S.tries}</b>🗣️ פעמים אמרת</div><div><b>${streak()}</b>🐾 ימים ברצף</div></div>
      ${tr.length ? `<div class="got" aria-label="החטיפים שהרווחת">${tr.slice(0, 60).join('')}</div>` : ''}
      <div class="row center"><button class="btn go big" id="feed" type="button">🍽️ להאכיל את ${esc(state.pup.name)}</button><button class="btn" id="home" type="button">🏠 לבית</button></div></section>`;
    sfx('win'); confetti();
    $('#feed').onclick = () => { endSession(); go('house'); };
    $('#home').onclick = () => { endSession(); go('home'); };
    Lane.to($('#feed'), '🍽️');
  };

  /* ---------------- album: every sentence as a picture ---------------- */
  VIEWS.album = () => {
    app.innerHTML = `
      <header class="page-head"><button class="btn small" id="back" type="button">→ לבית</button><h1>🎨 האלבום שלי</h1>${jarHTML()}</header>
      <p class="lead">🖼️ לוחצים על ציור, שומעים את המשפט, ואומרים אותו. כל פעם = חטיף 🦴</p>
      ${[1, 2, 3].filter((l) => state.sentences.some((s) => s.l === l)).map((l) => `<h2 class="group-title">${LEVEL_ICONS[l]} ${LEVEL_NAMES[l]}</h2><div class="pick-list" id="g${l}"></div>`).join('')}`;
    $('#back').onclick = () => go('home');
    [1, 2, 3].forEach((l) => { const el = $('#g' + l); if (el) fillTiles(el, state.sentences.filter((s) => s.l === l).map((s) => s.id), (id) => go('practice', id)); });
    Lane.to(null, '🖼️');
  };
  VIEWS.practice = (id) => {
    if (!sentenceById(id)) { go('album'); return; }
    app.innerHTML = `<header class="page-head"><button class="btn small" id="back" type="button">→ לאלבום</button><span class="spacer"></span>${jarHTML()}</header><div class="stage" id="stage"></div>`;
    const C = makeCard(id);
    const stopTick = startTicker();
    onLeave(() => { C.alive = false; stopTick(); finalizeCard(C); });
    renderCard($('#stage'), C, { pos: '', nextLabel: '➡️ חזרה לאלבום', onNext: () => go('album') });
    $('#back').onclick = () => go('album');
  };

  /* ---------------- the puppy's house: feed, tricks, dress-up ---------------- */
  let roomPup = null, houseBusy = false, portraitURL = null;
  VIEWS.house = () => {
    const P = state.pup;
    app.innerHTML = `
      <header class="page-head"><button class="btn small" id="back" type="button">→ לבית</button><h1>🏠 הבית של ${esc(P.name)}</h1>${jarHTML()}</header>
      <div class="house">
      <section class="room">
        <button class="portrait" id="portrait" type="button" aria-label="ציור על הקיר"></button>
        <div class="room-pup" id="room-pup" role="img" aria-label="${esc(P.name)}"></div>
        <div class="love" id="love"></div>
      </section>
      <div class="house-panels">
      <section class="panel"><h2>🍽️ להאכיל</h2><div class="treat-row" id="treats"></div></section>
      <section class="panel"><h2>🎪 טריקים</h2><p class="lead">לוחצים על טריק, אומרים את המילה בקול, ו${esc(P.name)} עושה אותו!</p><div class="trick-grid" id="tricks"></div></section>
      <section class="panel"><h2>👒 להלביש</h2><div class="acc-grid" id="accs"></div></section>
      <section class="panel"><h2>🎨 צבעים</h2><div class="color-rows" id="colors"></div><div class="row"><button class="btn small" id="rename" type="button">✏️ לשנות שם</button></div></section>
      </div>
      </div>`;
    roomPup = Pup.mount($('#room-pup'), look());
    houseBusy = false;
    $('#back').onclick = () => go('home');
    $('#room-pup').onclick = () => { if (houseBusy || !roomPup) return; sfx('yip'); roomPup.flash('happy', 700); roomPup.fx('❤️', 2); };
    $('#rename').onclick = async () => { const n = await promptBox('איך קוראים לכלב?', P.name); if (n) { P.name = n; save(true); go('house'); } };
    renderPortrait(); renderLove(); renderTreats(); renderTricks(); renderAccs(); renderColors();
    if (jarCount()) roomPup.bubble('🍽️');
    onLeave(() => { roomPup = null; houseBusy = false; });
  };
  async function renderPortrait() {
    const el = $('#portrait'); if (!el) return;
    const b = await blobs.get('draw:mascot');
    if (portraitURL) URL.revokeObjectURL(portraitURL);
    portraitURL = b ? URL.createObjectURL(b) : null;
    if (!el.isConnected) return;
    el.innerHTML = portraitURL ? `<img src="${portraitURL}" alt="הציור שלי">` : '<span>🖼️<small>✏️ לצייר</small></span>';
    el.onclick = () => Draw.open({ key: 'draw:mascot', title: `ציור של ${state.pup.name} 🖼️`, onSave: () => renderPortrait() });
  }
  function renderLove() { const el = $('#love'); if (el) el.innerHTML = levelHTML(levelInfo(state.pup.fed)); }
  // On narrow screens the room scrolls away; bring the puppy back into view before it does something.
  async function seePup() {
    const el = $('#room-pup'); if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= innerHeight) return;
    el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    await wait(450);
  }
  function renderTreats() {
    const el = $('#treats'); if (!el) return;
    const jar = state.pup.jar;
    el.innerHTML = TREATS.map((t) => `<button class="treat" data-k="${t.k}" type="button"${jar[t.k] ? '' : ' disabled'}><span class="te">${t.e}</span><b>${jar[t.k] || 0}</b></button>`).join('')
      + (jarCount() ? '' : '<p class="lead">הצנצנת ריקה. כל משפט שאומרים באימון = חטיף! 🗣️</p>');
    el.onclick = (e) => { const b = e.target.closest('.treat'); if (b && !b.disabled) feed(b.dataset.k, b); };
  }
  async function feed(k, btn) {
    if (houseBusy || !roomPup || !(state.pup.jar[k] > 0)) return;
    houseBusy = true;
    const p = roomPup;
    const t = TREATS.find((x) => x.k === k);
    const before = levelInfo(state.pup.fed).lvl;
    state.pup.jar[k]--; state.pup.fed += t.v; save();
    await seePup();
    if (roomPup !== p) return;
    const from = rectPoint(btn);
    renderTreats(); updateJar(false);
    p.bubble(null); p.mouth('open');
    await flyTo(t.e, from, p.mouthPoint(), 650);
    if (roomPup !== p) return;
    await p.eat();
    if (roomPup !== p) return;
    renderLove();
    const after = levelInfo(state.pup.fed).lvl;
    for (let l = before + 1; l <= after; l++) { await celebrate(l); if (roomPup !== p) return; }
    houseBusy = false;
  }
  function celebrate(l) {
    return new Promise((res) => {
      const u = UNLOCKS[l - 1]; const info = unlockInfo(u, l);
      sfx('win'); confetti(['⭐', '🎉', '❤️', info.e]);
      modal(`<div class="modal-box"><div class="unlock-big">${info.color ? `<span class="swatch-big" style="background:${info.color}"></span>` : info.e}</div><h2>${esc(info.title)}</h2><div class="row center"><button class="btn go big" id="u-ok" type="button">✨ יאללה!</button></div></div>`);
      $('#u-ok').onclick = async () => { closeModal(); await applyUnlock(u); res(); };
    });
  }
  async function applyUnlock(u) {
    renderTricks(); renderAccs(); renderColors();
    if (!roomPup) return;
    if (u && u.type === 'trick') { await Pup.trick(roomPup, u.id); return; }
    if (u && u.type === 'acc') { const a = D.accessories.find((x) => x.id === u.id); state.pup.wear[a.slot] = a.id; }
    else if (u && u.type === 'color') state.pup.fur = u.id;
    save(); refreshPups(); renderAccs(); renderColors();
    if (roomPup) await roomPup.flash('happy', 700);
  }
  function renderTricks() {
    const el = $('#tricks'); if (!el) return;
    el.innerHTML = D.tricks.map((t) => (hasTrick(t.id)
      ? `<button class="trick" data-id="${t.id}" type="button"><span class="te">${t.e}</span><span class="tc">${esc(t.cmd)}</span></button>`
      : `<div class="trick locked"><span class="te">🔒</span><span class="tc">❤️ ${unlockLevel('trick', t.id)}</span></div>`)).join('');
    el.onclick = (e) => { const b = e.target.closest('.trick[data-id]'); if (b) doTrick(D.tricks.find((t) => t.id === b.dataset.id)); };
  }
  async function doTrick(t) {
    if (houseBusy || !roomPup) return;
    houseBusy = true;
    const p = roomPup;
    try {
      audioCtx();
      await seePup();
      if (roomPup !== p) return;
      p.bubble(`${t.e} ${esc(t.cmd)}`);
      const cmd = await getModel('cmd:' + t.id);
      if (cmd) await playModel(cmd, 'whole');
      if (roomPup !== p) return;
      p.el.classList.add('listen'); p.bubble(`🎤 ${esc(t.cmd)}`);
      const heard = await listenForVoice(6000);
      if (roomPup !== p) return;
      p.el.classList.remove('listen');
      if (heard === false) { p.bubble('❓🎤'); sfx('tap'); await wait(1400); return; }
      if (heard === null) await wait(1600); // no microphone: give her a moment to say it
      if (roomPup !== p) return;
      p.bubble(null);
      await Pup.trick(p, t.id);
    } finally {
      if (roomPup === p) { houseBusy = false; p.bubble(null); p.el.classList.remove('listen'); }
    }
  }
  function renderAccs() {
    const el = $('#accs'); if (!el) return;
    const w = state.pup.wear;
    el.innerHTML = D.accessories.map((a) => (hasAcc(a.id)
      ? `<button class="acc${w[a.slot] === a.id ? ' on' : ''}" data-id="${a.id}" type="button" aria-pressed="${w[a.slot] === a.id}" aria-label="${esc(a.name)}">${a.e}</button>`
      : `<div class="acc locked">🔒<small>❤️ ${unlockLevel('acc', a.id)}</small></div>`)).join('');
    el.onclick = (e) => {
      const b = e.target.closest('.acc[data-id]'); if (!b) return;
      const a = D.accessories.find((x) => x.id === b.dataset.id);
      w[a.slot] = w[a.slot] === a.id ? null : a.id; save();
      refreshPups(); renderAccs(); sfx('pop'); seePup();
      if (roomPup && !houseBusy) roomPup.flash('happy', 700);
    };
  }
  function renderColors() {
    const el = $('#colors'); if (!el) return;
    const P = state.pup;
    const row = (field, label) => `<div class="color-row"><span>${label}</span>${D.colors.map((c) => (hasColor(c)
      ? `<button class="swatch${P[field] === c ? ' on' : ''}" data-f="${field}" data-c="${c}" style="background:${c}" type="button" aria-label="צבע"></button>`
      : '<span class="swatch locked" aria-hidden="true">🔒</span>')).join('')}</div>`;
    el.innerHTML = row('fur', '🐕 פרווה') + row('ear', '👂 אוזניים');
    el.onclick = (e) => {
      const b = e.target.closest('.swatch[data-c]'); if (!b) return;
      P[b.dataset.f] = b.dataset.c; save(); refreshPups(); renderColors(); seePup();
      if (roomPup && !houseBusy) roomPup.flash('happy', 700);
    };
  }

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
    const kid = state.name || 'הילדה';
    const L = levelInfo(state.pup.fed);
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
      <header class="page-head"><button class="btn small" id="back" type="button">→ לבית</button><h1>👪 אזור ההורים</h1></header>

      <section class="panel studio-cta"><h2>🎙️ אולפן הקלטות</h2>
        <p class="help">${esc(kid)} לא צריכה לקרוא. היא שומעת כל משפט בקול שלכם (או של הקלינאית), רואה ציור, ואומרת אחריכם. משפט בלי הקלטה צריך מבוגר שיקריא אותו. מקליטים כל משפט פעם אחת: כ-10 דקות לכל הרשימה.</p>
        <div class="row" id="studio-counts"></div>
        <div class="row"><button class="btn go" id="to-studio" type="button">🎙️ לאולפן ההקלטות</button></div></section>

      <section class="panel"><h2>השבוע</h2>${chartHTML()}
        <div class="report" id="report">${esc(reportText())}</div>
        <div class="row"><button class="btn small" id="copy" type="button">📋 העתקת הדוח לקלינאית</button></div></section>

      <section class="panel"><h2>הגדרות</h2>
        <div class="form">
          <label class="field">שם הילדה<input id="f-name" value="${esc(state.name)}" maxlength="20"></label>
          <label class="field">שם הכלב<input id="f-pup" value="${esc(state.pup.name)}" maxlength="16"></label>
          <label class="field">דקות ביום<select id="f-min">${[10, 15, 20, 25, 30].map((m) => `<option${m === state.minutes ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
          <label class="field">משפטים בכל אימון<select id="f-per">${[3, 4, 5, 6].map((m) => `<option${m === state.perSession ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
          <label class="field">הרמז של הקלינאית<input id="f-cue" value="${esc(state.cue)}" maxlength="80"></label>
        </div>
        <label class="check"><input type="checkbox" id="f-text"${state.showText ? ' checked' : ''}> להראות את הטקסט של המשפט בכרטיס (אפשר גם בכפתור 👁️ שבכרטיס)</label>
        <p class="help">הרמז מופיע עם 😗 כשמשפט יוצא ״ססס״ כמה פעמים. כדאי לכתוב בדיוק את המילים של הקלינאית.</p>
        <div class="row"><button class="btn go small" id="f-save" type="button">שמירה</button></div></section>

      <section class="panel"><h2>🐶 הכלב והפרסים</h2>
        <p class="help">${esc(state.pup.name)} ברמה ${L.lvl}, ויש ${jarCount()} חטיפים בצנצנת. חטיף על כל ניסיון במשפט (עד 5 למשפט, לא משנה איך דירגה: מתגמלים מאמץ ולא שלמות), על תשובה נכונה במשחק ההקשבה, על סיום החימום, על ציור משפט, ו-🧁 כשמגיעים לדקות של היום. בבית של הכלב היא מאכילה אותו, וכל רמה פותחת טריק, בגד או צבע. כל הטריקים מופעלים במילה עם ש׳ שהיא אומרת בקול.</p>
        <div class="row"><button class="btn small" id="bonus" type="button">🎁 פרס מההורים: 3 חטיפים</button></div></section>

      <section class="panel"><h2>המשפטים</h2>
        <p class="help">🎙️ <b>דוגמה</b>: אותה הקלטה כמו באולפן. ▶️ <b>ההקלטות שלה</b>: נשמרות ההקלטה הראשונה וחמש האחרונות, כדי לשמוע התקדמות.</p>
        <div class="tbl-wrap"><table><thead><tr><th>#</th><th>משפט</th><th>רמה</th><th>מצב</th><th>דירוגים</th><th>אחרון</th><th>דוגמה</th><th>ההקלטות שלה</th></tr></thead><tbody id="tbody">${rows}</tbody></table></div></section>

      <section class="panel"><h2>עריכת הרשימה</h2>
        <p class="help">משפט בכל שורה. ההתקדמות וההקלטות נשמרות לכל משפט שלא השתנה. מילה עם שׂ (נשמעת כמו ס, למשל ״*נישא״) מסמנים בכוכבית לפניה, וכך היא לא נספרת כ-ש.</p>
        <textarea id="list" spellcheck="false" dir="rtl">${esc(state.sentences.map((s) => s.t).join('\n'))}</textarea>
        <div class="row"><button class="btn go small" id="list-save" type="button">שמירת הרשימה</button><button class="btn small" id="list-reset" type="button">חזרה לרשימה של הקלינאית</button></div></section>

      <section class="panel"><h2>גיבוי</h2>
        <p class="help">הכול נשמר רק על האייפד הזה. מדי פעם כדאי לשמור גיבוי (כולל ציורים והקלטות) לקבצים.</p>
        <div class="row"><button class="btn small" id="export" type="button">💾 שמירת גיבוי</button><label class="btn small" for="import-file">📂 שחזור מגיבוי</label><input type="file" id="import-file" accept="application/json,.json" hidden><span class="spacer"></span><button class="btn small ghost" id="reset" type="button">🧹 איפוס ההתקדמות</button></div></section>
      </div>`;

    $('#back').onclick = () => go('home');
    $('#to-studio').onclick = () => go('studio');
    recordedCounts().then((c) => {
      const el = $('#studio-counts'); if (!el) return;
      el.innerHTML = `<span class="count-chip${c.sent >= state.sentences.length ? ' ok' : ''}">🗣️ משפטים ${c.sent}/${state.sentences.length}</span><span class="count-chip${c.word >= D.pairs.length * 2 ? ' ok' : ''}">👂 מילים למשחק ${c.word}/${D.pairs.length * 2}</span>`;
    });
    $('#copy').onclick = () => {
      const txt = reportText();
      const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#report')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('הטקסט מסומן. אפשר להעתיק'); };
      try { navigator.clipboard.writeText(txt).then(() => toast('הדוח הועתק ✓'), fallback); } catch (e) { fallback(); }
    };
    $('#f-save').onclick = () => {
      state.name = $('#f-name').value.trim(); state.minutes = +$('#f-min').value; state.perSession = +$('#f-per').value;
      state.cue = $('#f-cue').value.trim() || defaults().cue;
      state.pup.name = $('#f-pup').value.trim() || 'שוקו';
      state.showText = $('#f-text').checked;
      save(true); toast('נשמר ✓');
    };
    $('#bonus').onclick = () => { earn(3, $('#bonus')); toast('🎁 3 חטיפים נכנסו לצנצנת'); };
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
          try { await recorder.start(null); } catch (err) { toast('🎙️ צריך לאשר גישה למיקרופון', 3000); return; }
          pRecId = id; b.textContent = '⏹️ עצירה'; b.classList.add('rec', 'on');
        } else {
          const blob = await recorder.stop(); pRecId = null;
          if (blob) { await blobs.put('model:' + id, blob); forgetModel('model:' + id); toast('הדוגמה נשמרה ✓'); }
          renderRowMedia(tr);
        }
      } else if (act === 'm-play') { const m = await getModel('model:' + id); if (m) playModel(m, 'whole'); }
      else if (act === 'm-del') { if (await confirmBox('למחוק את ההקלטה לדוגמה?', '', 'מחיקה', 'ביטול')) { await blobs.del('model:' + id); forgetModel('model:' + id); renderRowMedia(tr); } }
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
      if (!(await confirmBox('לחזור לרשימה של הקלינאית?', 'ההתקדמות וההקלטות של המשפטים האלה נשמרות.', 'כן, לחזור', 'ביטול'))) return;
      state.sentences = defaultSentences(); save(true); go('parent');
    };
    $('#export').onclick = exportBackup;
    $('#import-file').onchange = (e) => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f); e.target.value = ''; };
    $('#reset').onclick = async () => {
      if (!(await confirmBox('לאפס את ההתקדמות?', 'דירוגים, דקות וההקלטות שלה יימחקו. הציורים, הקלטות הדוגמה, והכלב עם החטיפים שלו נשארים.', 'איפוס', 'ביטול'))) return;
      state.stats = {}; state.days = {}; state.listen = { ok: 0, all: 0 };
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
    const data = JSON.stringify({ app: 'shin-app', v: 2, at: new Date().toISOString(), state, files });
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
    state = normalize(data.state);
    for (const [k, v] of Object.entries(data.files || {})) { try { const b = await (await fetch(v)).blob(); await blobs.put(k, b); } catch (e) { /* skip broken file */ } }
    picURLs.forEach((u) => u && URL.revokeObjectURL(u)); picURLs.clear(); modelCache.clear();
    refreshPups(); save(true); toast('השחזור הושלם ✓'); go('parent');
  }

  /* ---------------- recording studio (parents or the therapist record the model voice) ---------------- */
  const STUDIO_KINDS = [
    ['sent', '🗣️ משפטים'],
    ['word', '👂 מילים למשחק ההקשבה'],
    ['warm', '🪞 הוראות חימום (רשות)'],
    ['cmd', '🐶 פקודות לכלב (רשות)'],
  ];
  function studioItems(k) {
    if (k === 'sent') return state.sentences.map((s, i) => ({ key: 'model:' + s.id, title: `משפט ${i + 1}`, html: pauseMarked(s.t), list: litSentence(s.t), cut: true }));
    if (k === 'word') return D.pairs.flatMap((p) => [[p.sh, p.shE], [p.s, p.sE]]).map(([w, e]) => ({ key: 'word:' + w, title: 'מילה', html: `${e} ${esc(w)}`, list: `${e} ${esc(w)}` }));
    if (k === 'warm') return D.warmup.map((c, i) => ({ key: warmKey(c), title: `חימום ${i + 1}`, html: `${c.big} ${shinMark(c.text)}<br><small>${esc(c.sub)}</small>`, list: `${c.big} ${shinMark(c.text)}` }));
    return D.tricks.map((t) => ({ key: 'cmd:' + t.id, title: 'פקודה לכלב', html: `${t.e} ${esc(t.cmd)}`, list: `${t.e} ${esc(t.cmd)}` }));
  }
  const studio = { k: 'sent', i: -1, have: new Set(), timer: 0, busy: false };
  const firstMissing = () => { const i = studioItems(studio.k).findIndex((it) => !studio.have.has(it.key)); return i < 0 ? 0 : i; };
  VIEWS.studio = async () => {
    studio.have = new Set(await blobs.keys(''));
    if (view !== 'studio') return;
    if (studio.i < 0) studio.i = firstMissing();
    app.innerHTML = `
      <div class="parent">
      <header class="page-head"><button class="btn small" id="back" type="button">→ לאזור ההורים</button><h1>🎙️ אולפן הקלטות</h1></header>
      <details class="panel tips" open><summary>איך מקליטים? (חצי דקה)</summary>
        <ul>
          <li>חדר שקט. האייפד במרחק של כף יד מהפה.</li>
          <li>קוראים לאט וברור, עם ש׳ ברורה ואפילו קצת מוגזמת, כמו שהקלינאית אומרת אותה.</li>
          <li>בכל <span class="pause">│</span> עוצרים לרגע (חצי שנייה). האפליקציה חותכת שם, ו${esc(state.name || 'הילדה')} מתאמנת חלק אחרי חלק.</li>
          <li>לוחצים ⏺️, מחכים שנייה, קוראים, ולוחצים ⏹️. אפשר להקליט שוב כמה שרוצים.</li>
          <li>אפשר גם לבקש מהקלינאית להקליט ביום שישי, על האייפד הזה.</li>
        </ul></details>
      <nav class="tabs" id="tabs"></nav>
      <section class="panel studio-cur" id="cur"></section>
      <section class="panel"><h2>כל הרשימה</h2><div class="slist" id="slist"></div></section>
      </div>`;
    $('#back').onclick = () => go('parent');
    renderStudio();
    onLeave(() => { clearTimeout(studio.timer); studio.busy = false; });
  };
  function renderStudio() { renderStudioTabs(); renderStudioCur(); renderStudioList(); }
  function renderStudioTabs() {
    const el = $('#tabs'); if (!el) return;
    el.innerHTML = STUDIO_KINDS.map(([k, label]) => {
      const items = studioItems(k); const n = items.filter((it) => studio.have.has(it.key)).length;
      return `<button class="tab${studio.k === k ? ' on' : ''}" data-k="${k}" type="button">${label} <span class="cnt${n === items.length ? ' ok' : ''}">${n}/${items.length}</span></button>`;
    }).join('');
    el.onclick = (e) => { const b = e.target.closest('.tab'); if (!b || recorder.active || studio.busy) return; studio.k = b.dataset.k; studio.i = firstMissing(); renderStudio(); };
  }
  function renderStudioCur() {
    const box = $('#cur'); if (!box) return;
    const items = studioItems(studio.k);
    studio.i = Math.max(0, Math.min(items.length - 1, studio.i));
    const it = items[studio.i]; const has = studio.have.has(it.key);
    box.innerHTML = `
      <div class="row"><b>${esc(it.title)}</b><span class="qpos">${studio.i + 1} / ${items.length}</span><span class="spacer"></span>${has ? '<span class="count-chip ok">✓ מוקלט</span>' : '<span class="count-chip">עוד לא הוקלט</span>'}</div>
      <p class="studio-text">${it.html}</p>
      <div class="row center"><button class="btn rec big" id="s-rec" type="button">⏺️ ${has ? 'להקליט מחדש' : 'הקלטה'}</button></div>
      <div class="meter" id="s-meter" hidden><i></i></div>
      <div class="row center s-play" id="s-play"></div>
      <div class="row"><button class="btn small" id="s-prev" type="button"${studio.i === 0 ? ' disabled' : ''}>→ הקודם</button><span class="spacer"></span>${has ? '<button class="btn small ghost" id="s-del" type="button">🗑️ מחיקה</button>' : ''}<button class="btn go" id="s-next" type="button"${studio.i === items.length - 1 ? ' disabled' : ''}>הבא ←</button></div>`;
    const move = (d) => { if (recorder.active || studio.busy) return; stopAudio(); studio.i += d; renderStudioCur(); renderStudioList(); };
    $('#s-prev').onclick = () => move(-1);
    $('#s-next').onclick = () => move(1);
    const del = $('#s-del');
    if (del) del.onclick = async () => {
      if (!(await confirmBox('למחוק את ההקלטה?', '', 'מחיקה', 'ביטול'))) return;
      await blobs.del(it.key); forgetModel(it.key); studio.have.delete(it.key); renderStudio();
    };
    $('#s-rec').onclick = () => studioRecord(it);
    if (has) renderStudioPlay(it);
  }
  async function renderStudioPlay(it) {
    const m = await getModel(it.key);
    const el = $('#s-play'); if (!el || !m) return;
    const n = it.cut ? m.pieces.length : 0;
    let note = '';
    if (m.buf && !m.whole) note = '⚠️ לא נשמע קול בהקלטה. כדאי להקליט שוב.';
    else if (it.cut) note = n > 1 ? `✂️ ${n} חלקים` : 'בלי עצירות: המשפט יושמע רק בשלמותו';
    el.innerHTML = `<button class="btn small" data-p="whole" type="button">▶️ הכל</button>${n > 1 ? m.pieces.map((_, i) => `<button class="btn small" data-p="${i}" type="button">▶️ ${i + 1}</button>`).join('') : ''}<span class="help">${note}</span>`;
    el.onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { audioCtx(); playModel(m, b.dataset.p === 'whole' ? 'whole' : +b.dataset.p); } };
  }
  function renderStudioList() {
    const el = $('#slist'); if (!el) return;
    el.innerHTML = studioItems(studio.k).map((it, i) => `<button class="srow${studio.have.has(it.key) ? ' done' : ''}${i === studio.i ? ' on' : ''}" data-i="${i}" type="button"><span class="mark">${studio.have.has(it.key) ? '✓' : '○'}</span><span class="t">${it.list}</span></button>`).join('');
    el.onclick = (e) => {
      const b = e.target.closest('.srow'); if (!b || recorder.active || studio.busy) return;
      stopAudio(); studio.i = +b.dataset.i; renderStudioCur(); renderStudioList();
      $('#cur').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    };
  }
  async function studioRecord(it) {
    const btn = $('#s-rec'); audioCtx();
    if (studio.busy) return;
    if (!recorder.active) {
      studio.busy = true; stopAudio();
      btn.textContent = '⏳ רגע…';
      try { await recorder.start($('#s-meter i')); } catch (e) {
        studio.busy = false;
        toast(e && e.message === 'mic timeout' ? '🎙️ המיקרופון לא ענה. לוחצים שוב' : '🎙️ צריך לאשר גישה למיקרופון', 3000);
        if (btn.isConnected) renderStudioCur();
        return;
      }
      studio.busy = false;
      if (!btn.isConnected) { recorder.stop(); return; }
      btn.classList.add('on'); btn.textContent = '⏹️ עצירה'; $('#s-meter').hidden = false;
      clearTimeout(studio.timer);
      studio.timer = setTimeout(() => { if (recorder.active && btn.isConnected) studioRecord(it); }, 30000);
      return;
    }
    clearTimeout(studio.timer);
    studio.busy = true;
    const blob = await recorder.stop();
    if (!blob) { studio.busy = false; toast('ההקלטה לא נשמרה. נסו שוב'); renderStudioCur(); return; }
    await blobs.put(it.key, blob); forgetModel(it.key); studio.have.add(it.key);
    studio.busy = false;
    if (view !== 'studio') return;
    renderStudio();
    const m = await getModel(it.key);
    toast(m && m.buf && !m.whole ? '⚠️ לא נשמע קול בהקלטה' : '✓ נשמר');
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
    const sw = $('#swatches');

    sw.innerHTML = COLORS.map((c, i) => `<button class="swatch${i === 0 ? ' on' : ''}" data-c="${c}" style="background:${c}" type="button" aria-label="צבע"></button>`).join('');
    $('#sizes').innerHTML = SIZES.map((s, i) => `<button class="tool${i === 1 ? ' on' : ''}" data-s="${s}" type="button" aria-label="עובי"><span class="dot" style="width:${6 + i * 8}px;height:${6 + i * 8}px"></span></button>`).join('');
    sw.onclick = (e) => {
      const b = e.target.closest('.swatch'); if (!b) return;
      color = b.dataset.c; $$('.swatch', sw).forEach((q) => q.classList.toggle('on', q === b));
      if (tool === 'eraser') setTool('pen');
      if (opts && opts.sayOnColor) toast('🗣️ צבע חדש: אומרים את המשפט!', 1500);
    };
    $('#sizes').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; size = +b.dataset.s; $$('#sizes .tool').forEach((q) => q.classList.toggle('on', q === b)); };
    function setTool(t) { tool = t; $$('[data-tool]', el).forEach((q) => q.classList.toggle('on', q.dataset.tool === t)); }
    $$('[data-tool]', el).forEach((b) => { b.onclick = () => setTool(b.dataset.tool); });

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
    $('#draw-hear').onclick = () => { audioCtx(); if (opts && opts.model) playModel(opts.model, 'whole'); };
    $('#draw-save').onclick = async () => {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (blob) await blobs.put(opts.key, blob);
      const o = opts; close();
      toast('🎨 הציור נשמר'); sfx('win');
      if (o.sentenceId) {
        const d = dayRec(); d.drew = d.drew || [];
        if (!d.drew.includes(o.sentenceId)) { d.drew.push(o.sentenceId); save(); earn(2, null); }
      }
      if (o.onSave) o.onSave();
    };
    function close() { el.hidden = true; document.body.style.overflow = ''; cur = null; stopAudio(); }
    async function open(o) {
      opts = o; ops = []; cur = null; base = null; dirty = false;
      const showText = o.sentence && (state.showText || !o.model);
      $('#draw-title').innerHTML = o.sentence ? (showText ? litSentence(o.title) : '🎨 🗣️') : esc(o.title);
      $('#draw-hear').hidden = !o.model;
      el.hidden = false; document.body.style.overflow = 'hidden';
      fit(); redraw();
      if (o.model) playModel(o.model, 'whole');
      const b = await blobs.get(o.key);
      if (b && opts === o) { base = await blobToImage(b); redraw(); }
    }
    return { open };
  })();

  /* ---------------- start ---------------- */
  function askName() {
    modal(`<div class="modal-box"><div class="modal-pup" id="m-pup"></div><h2>היי! אני ${esc(state.pup.name)} 🐶<br>איך קוראים לך?</h2><input id="name-in" maxlength="20" autocomplete="off" aria-label="השם שלך"><button class="btn go big" id="name-ok" type="button">יאללה!</button></div>`);
    Pup.mount($('#m-pup'), look());
    $('#name-ok').onclick = () => { state.name = $('#name-in').value.trim(); save(true); closeModal(); go('home'); };
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { if (view === 'session') requestWake(); }
    else save(true);
  });
  window.addEventListener('pagehide', () => save(true));
  document.addEventListener('click', unlockAudio, true);
  document.addEventListener('touchend', unlockAudio, true);

  Pup.sound = sfx;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || local)) navigator.serviceWorker.register('sw.js').catch(() => {});
  go('home');
  if (!state.name) askName();
})();
