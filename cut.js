/* Finds the spoken parts of a recording, so a parent's model sentence can be played whole
   (without the silence around it) or piece by piece (cut where the reader paused).
   Works in the browser (window.ShinCut) and in Node (for tests). */
(function (root) {
  'use strict';

  // data: Float32Array of samples (-1..1), sr: sample rate.
  // Returns { whole: [start, end], pieces: [[start, end], ...] } in seconds, or null if silent.
  function findSegments(data, sr, opt) {
    opt = opt || {};
    const hopS = 0.01;
    const hop = Math.max(1, Math.round(sr * hopS));
    const n = Math.floor(data.length / hop);
    if (n < 20) return null;

    // loudness per 10 ms frame, smoothed over 50 ms
    const e = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0; const o = i * hop;
      for (let j = 0; j < hop; j++) { const v = data[o + j]; s += v * v; }
      e[i] = Math.sqrt(s / hop);
    }
    const sm = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j < n) { s += e[j]; c++; } }
      sm[i] = s / c;
    }
    const sorted = Float32Array.from(sm).sort();
    const floor = sorted[Math.floor(n * 0.05)];
    const peak = sorted[Math.floor(n * 0.98)];
    if (!(peak > 0.004) || peak < floor * 2) return null;
    // Low threshold on purpose: a soft ש at the start or end of a piece must not be cut off.
    const thr = floor + (peak - floor) * (opt.rel || 0.06);

    const runs = [];
    for (let i = 0; i < n;) {
      if (sm[i] > thr) { let j = i; while (j < n && sm[j] > thr) j++; runs.push([i, j]); i = j; } else i++;
    }
    // join sounds separated by less than a real pause (stops inside words are short)
    const minGap = Math.round((opt.gap || 0.24) / hopS);
    const groups = [];
    for (const r of runs) {
      const last = groups[groups.length - 1];
      if (last && r[0] - last[1] < minGap) last[1] = r[1]; else groups.push([r[0], r[1]]);
    }
    let gs = groups.filter((g) => g[1] - g[0] >= 6); // drop clicks shorter than 60 ms
    if (!gs.length) return null;

    // a piece shorter than half a second joins its nearer neighbour
    const minLen = Math.round((opt.minPiece || 0.5) / hopS);
    for (let changed = true; changed && gs.length > 1;) {
      changed = false;
      for (let k = 0; k < gs.length; k++) {
        if (gs[k][1] - gs[k][0] >= minLen) continue;
        const gl = k > 0 ? gs[k][0] - gs[k - 1][1] : Infinity;
        const gr = k < gs.length - 1 ? gs[k + 1][0] - gs[k][1] : Infinity;
        if (gl <= gr) gs[k - 1][1] = gs[k][1]; else gs[k + 1][0] = gs[k][0];
        gs.splice(k, 1); changed = true; break;
      }
    }
    // at most 6 pieces: join across the shortest pauses
    const maxP = opt.max || 6;
    while (gs.length > maxP) {
      let best = 1, bg = Infinity;
      for (let k = 1; k < gs.length; k++) { const g = gs[k][0] - gs[k - 1][1]; if (g < bg) { bg = g; best = k; } }
      gs[best - 1][1] = gs[best][1]; gs.splice(best, 1);
    }

    const dur = data.length / sr;
    const pad = opt.pad || 0.12;
    const toS = (f) => (f * hop) / sr;
    const pieces = gs.map(([a, b], k) => {
      const lo = k > 0 ? (toS(gs[k - 1][1]) + toS(a)) / 2 : 0;
      const hi = k < gs.length - 1 ? (toS(b) + toS(gs[k + 1][0])) / 2 : dur;
      return [Math.max(lo, toS(a) - pad), Math.min(hi, toS(b) + pad + 0.05)];
    });
    return {
      whole: [Math.max(0, toS(gs[0][0]) - 0.15), Math.min(dur, toS(gs[gs.length - 1][1]) + 0.25)],
      pieces,
    };
  }

  // 16-bit mono WAV with 8 ms fades, so a cut piece starts and ends without a click.
  function wavBuffer(samples, sr) {
    const n = samples.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
    const fade = Math.min(Math.floor(sr * 0.008), Math.floor(n / 2));
    for (let i = 0; i < n; i++) {
      let s = samples[i];
      if (fade && i < fade) s *= i / fade; else if (fade && i >= n - fade) s *= (n - 1 - i) / fade;
      s = Math.max(-1, Math.min(1, s));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buf;
  }

  const api = { findSegments, wavBuffer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShinCut = api;
})(typeof window !== 'undefined' ? window : globalThis);
