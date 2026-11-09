/* The puppy: one SVG drawing whose parts move (tail, ears, legs, head, eyes, mouth), with
   dress-up slots and short animations. app.js decides when to use them.
   Pup.mount(hostElement, look) -> a puppy you can animate; look = { fur, ear, wear: {slot: id} }. */
(function () {
  'use strict';

  const CREAM = '#F7E8D0';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function shade(hex, p) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    const f = (c) => Math.max(0, Math.min(255, Math.round(p < 0 ? c * (1 + p) : c + (255 - c) * p)));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('');
  }

  // Accessories, drawn in the puppy's own coordinates (viewBox 0 -18 200 248).
  const ACC = {
    bow: { slot: 'head', svg: '<g transform="translate(133 40) rotate(15)"><path d="M0 0 L-18 -11 L-18 11 Z" fill="#FF6FA8" stroke="#C93D78" stroke-width="2" stroke-linejoin="round"/><path d="M0 0 L18 -11 L18 11 Z" fill="#FF6FA8" stroke="#C93D78" stroke-width="2" stroke-linejoin="round"/><circle r="5.5" fill="#FF9BC4" stroke="#C93D78" stroke-width="2"/></g>' },
    crown: { slot: 'head', svg: '<g><path d="M72 42 L76 14 L89 29 L100 10 L111 29 L124 14 L128 42 Z" fill="#FFD23F" stroke="#C99A00" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="33" r="4" fill="#E8503F"/><circle cx="84" cy="36" r="3" fill="#2F5BEA"/><circle cx="116" cy="36" r="3" fill="#1FA866"/></g>' },
    tophat: { slot: 'head', svg: '<g transform="rotate(-8 100 36)"><ellipse cx="100" cy="38" rx="34" ry="6.5" fill="#2B2B3A"/><rect x="78" y="0" width="44" height="38" rx="4" fill="#2B2B3A"/><rect x="78" y="26" width="44" height="7" fill="#E8503F"/></g>' },
    partyhat: { slot: 'head', svg: '<g transform="rotate(-14 100 36)"><path d="M80 40 L100 -8 L120 40 Z" fill="#2FB7F5" stroke="#1E7FB0" stroke-width="2" stroke-linejoin="round"/><circle cx="96" cy="27" r="3.5" fill="#FFE45C"/><circle cx="105" cy="14" r="3" fill="#FF6FA8"/><circle cx="106" cy="32" r="3" fill="#fff"/><circle cx="100" cy="-9" r="7" fill="#FFE45C" stroke="#E0B400" stroke-width="2"/></g>' },
    flower: { slot: 'head', svg: '<g transform="translate(66 44)"><circle cx="0" cy="-9" r="7" fill="#FF8FB8"/><circle cx="8.6" cy="-2.8" r="7" fill="#FF8FB8"/><circle cx="5.3" cy="7.3" r="7" fill="#FF8FB8"/><circle cx="-5.3" cy="7.3" r="7" fill="#FF8FB8"/><circle cx="-8.6" cy="-2.8" r="7" fill="#FF8FB8"/><circle r="5" fill="#FFE45C"/></g>' },
    glasses: { slot: 'face', svg: '<g><rect x="66" y="63" width="29" height="21" rx="9" fill="#1F2340"/><rect x="105" y="63" width="29" height="21" rx="9" fill="#1F2340"/><path d="M95 71 Q100 67 105 71" fill="none" stroke="#1F2340" stroke-width="4"/><path d="M71 68 L78 68 M110 68 L117 68" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/></g>' },
    bandana: { slot: 'neck', svg: '<g><path d="M68 128 Q100 148 132 128 L100 174 Z" fill="#E8503F" stroke="#A8352A" stroke-width="2" stroke-linejoin="round"/><circle cx="92" cy="145" r="2.6" fill="#fff"/><circle cx="108" cy="145" r="2.6" fill="#fff"/><circle cx="100" cy="158" r="2.6" fill="#fff"/></g>' },
    scarf: { slot: 'neck', svg: '<g><path d="M64 122 Q100 146 136 122 L137 138 Q100 162 63 138 Z" fill="#2F5BEA"/><path d="M76 129 L76 142 M90 134 L90 148 M110 134 L110 148 M124 129 L124 142" stroke="#FFE45C" stroke-width="5"/><path d="M116 140 L132 180 L118 184 L106 146 Z" fill="#2F5BEA"/><path d="M118 168 L130 165" stroke="#FFE45C" stroke-width="5"/></g>' },
    cape: { slot: 'back', svg: '<path d="M64 122 Q32 182 42 218 L158 218 Q168 182 136 122 Z" fill="#8E44AD" stroke="#5E2A75" stroke-width="2.5" stroke-linejoin="round"/>' },
  };

  function svg(look) {
    look = look || {};
    const fur = look.fur || '#C8874D';
    const ear = look.ear || shade(fur, -0.35);
    const line = shade(fur, -0.45);
    const wear = look.wear || {};
    const acc = (slot) => { const a = ACC[wear[slot]]; return a && a.slot === slot ? a.svg : ''; };
    const st = `stroke="${line}" stroke-width="2.5"`;
    return `<svg class="pup-svg" viewBox="0 -18 200 248" aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="222" rx="62" ry="7" fill="rgba(31,35,64,.13)"/>
      ${acc('back')}
      <g class="tail"><path d="M136 190 Q172 190 174 156 Q175 144 166 147 Q163 172 134 176 Z" fill="${fur}" ${st}/></g>
      <g class="torso">
        <ellipse cx="62" cy="196" rx="21" ry="22" fill="${fur}" ${st}/>
        <ellipse cx="138" cy="196" rx="21" ry="22" fill="${fur}" ${st}/>
        <ellipse cx="100" cy="170" rx="46" ry="47" fill="${fur}" ${st}/>
        <ellipse cx="100" cy="170" rx="25" ry="31" fill="${CREAM}"/>
        <ellipse cx="55" cy="214" rx="16" ry="8" fill="${CREAM}" ${st}/>
        <ellipse cx="145" cy="214" rx="16" ry="8" fill="${CREAM}" ${st}/>
      </g>
      <g class="leg leg-l"><rect x="76" y="160" width="17" height="52" rx="8.5" fill="${fur}" ${st}/><ellipse cx="84.5" cy="213" rx="12" ry="7.5" fill="${CREAM}" ${st}/></g>
      <g class="leg leg-r"><rect x="107" y="160" width="17" height="52" rx="8.5" fill="${fur}" ${st}/><ellipse cx="115.5" cy="213" rx="12" ry="7.5" fill="${CREAM}" ${st}/></g>
      <g class="neck">
        <path d="M66 124 Q100 144 134 124 L133 135 Q100 155 67 135 Z" fill="#E8503F"/>
        <circle cx="100" cy="149" r="10.5" fill="#FFE45C" stroke="#B97A06" stroke-width="2"/>
        <text x="100" y="154.5" text-anchor="middle" font-size="14" font-weight="700" fill="#6C2BD9" font-family="Rubik, Arial, sans-serif">ש</text>
        ${acc('neck')}
      </g>
      <g class="head">
        <g class="ear ear-l"><path d="M60 50 C30 52 24 108 45 119 C60 126 66 92 73 64 Z" fill="${ear}" ${st}/></g>
        <g class="ear ear-r"><path d="M140 50 C170 52 176 108 155 119 C140 126 134 92 127 64 Z" fill="${ear}" ${st}/></g>
        <ellipse cx="100" cy="80" rx="50" ry="46" fill="${fur}" ${st}/>
        <ellipse cx="125" cy="70" rx="16" ry="14" fill="${ear}" opacity=".9"/>
        <ellipse cx="100" cy="101" rx="28" ry="20" fill="${CREAM}"/>
        <circle cx="70" cy="97" r="6" fill="#F09A8A" opacity=".5"/><circle cx="130" cy="97" r="6" fill="#F09A8A" opacity=".5"/>
        <g class="eyes-open"><circle cx="81" cy="74" r="7.5" fill="#1F2340"/><circle cx="83.5" cy="71.3" r="2.5" fill="#fff"/><circle cx="119" cy="74" r="7.5" fill="#1F2340"/><circle cx="121.5" cy="71.3" r="2.5" fill="#fff"/></g>
        <g class="eyes-closed" fill="none" stroke="#1F2340" stroke-width="3.5" stroke-linecap="round"><path d="M74 75 Q81 81 88 75"/><path d="M112 75 Q119 81 126 75"/></g>
        <ellipse cx="100" cy="92" rx="10" ry="7" fill="#2A1A10"/><ellipse cx="96.5" cy="89.5" rx="3.2" ry="1.8" fill="#fff" opacity=".6"/>
        <g class="mouth" stroke-linecap="round">
          <g class="m m-happy"><path d="M100 99 L100 104 M89 104 Q100 114 111 104" fill="none" stroke="#3B2416" stroke-width="3.5"/><path d="M95 109 Q100 121 105 109 Z" fill="#F07C8C"/></g>
          <g class="m m-shh"><path d="M100 99 L100 101" stroke="#3B2416" stroke-width="3"/><ellipse cx="100" cy="108" rx="6.5" ry="7.5" fill="#5A2E2E" stroke="#D9707E" stroke-width="4"/></g>
          <g class="m m-open"><path d="M100 99 L100 102" stroke="#3B2416" stroke-width="3"/><path d="M87 104 Q100 127 113 104 Z" fill="#5A2E2E" stroke="#3B2416" stroke-width="2.5" stroke-linejoin="round"/><path d="M94 114 Q100 123 106 114 Z" fill="#F07C8C"/></g>
          <g class="m m-kiss"><path d="M100 99 L100 102" stroke="#3B2416" stroke-width="3"/><ellipse cx="100" cy="106" rx="5.5" ry="3.8" fill="#E8607A"/><ellipse cx="100" cy="111.5" rx="5.5" ry="3.8" fill="#E8607A"/></g>
          <g class="m m-tongue"><path d="M100 99 L100 104 M88 104 Q100 113 112 104" fill="none" stroke="#3B2416" stroke-width="3.5"/><path d="M92 107 Q100 138 108 107 Z" fill="#F07C8C" stroke="#D9707E" stroke-width="2"/><path d="M100 110 L100 124" stroke="#D9707E" stroke-width="2"/></g>
          <g class="m m-sleep"><path d="M94 106 Q100 109 106 106" fill="none" stroke="#3B2416" stroke-width="3"/></g>
        </g>
        ${acc('face')}
        ${acc('head')}
      </g>
    </svg>`;
  }

  function mount(host, look) {
    host.innerHTML = '<div class="pup" data-mouth="happy"><div class="pup-bubble" hidden></div><div class="pup-fig"></div><div class="pup-fx"></div></div>';
    const el = host.firstElementChild;
    const fig = el.querySelector('.pup-fig');
    const fxEl = el.querySelector('.pup-fx');
    const bub = el.querySelector('.pup-bubble');
    const timers = {};
    let mouthT = 0;
    const api = {
      el, look, baseMouth: 'happy',
      setLook(l) { api.look = l; fig.innerHTML = svg(l); },
      mouth(m, ms) {
        el.dataset.mouth = m; clearTimeout(mouthT);
        if (ms) mouthT = setTimeout(() => { el.dataset.mouth = api.baseMouth; }, ms);
      },
      eyes(s) { if (s) el.dataset.eyes = s; else delete el.dataset.eyes; },
      flash(c, ms) {
        el.classList.remove(c); void el.offsetWidth; el.classList.add(c);
        clearTimeout(timers[c]);
        return new Promise((r) => { timers[c] = setTimeout(() => { el.classList.remove(c); r(); }, ms); });
      },
      fx(sym, n) {
        if (reduced()) return;
        n = n || 3;
        for (let i = 0; i < n; i++) {
          const s = document.createElement('span');
          s.className = 'pfx'; s.textContent = sym;
          s.style.left = (22 + Math.random() * 56) + '%';
          s.style.top = (8 + Math.random() * 28) + '%';
          s.style.animationDelay = (i * 0.16) + 's';
          fxEl.appendChild(s);
          setTimeout(() => s.remove(), 1700 + i * 160);
        }
      },
      bubble(html) {
        if (!html) { bub.hidden = true; bub.innerHTML = ''; return; }
        if (bub.innerHTML === html && !bub.hidden) return;
        bub.innerHTML = html; bub.hidden = false;
        bub.classList.remove('pop'); void bub.offsetWidth; bub.classList.add('pop');
      },
      async eat() {
        snd('crunch');
        for (let i = 0; i < 6; i++) { el.dataset.mouth = i % 2 ? 'happy' : 'open'; await wait(130); }
        el.dataset.mouth = api.baseMouth;
        api.fx('❤️', 2);
        await api.flash('happy', 700);
      },
      mouthPoint() {
        const r = fig.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * 0.5 };
      },
    };
    api.setLook(look);
    return api;
  }

  const snd = (n) => { try { if (Pup.sound) Pup.sound(n); } catch (e) { /* sound is optional */ } };

  const TRICKS = {
    sit: async (p) => { p.fx('✨', 3); await p.flash('t-sit', 1300); },
    wave: async (p) => { p.fx('👋', 1); snd('yip'); await p.flash('t-wave', 1900); },
    down: async (p) => { p.eyes('closed'); await p.flash('t-down', 1900); p.eyes(''); },
    kiss: async (p) => { p.mouth('kiss', 1700); snd('kiss'); p.fx('❤️', 5); await p.flash('t-kiss', 1700); },
    shh: async (p) => { p.mouth('shh', 2000); snd('shh'); p.fx('🤫', 1); await p.flash('t-shh', 2000); },
    sing: async (p) => { p.mouth('open', 2000); snd('howl'); p.fx('🎵', 4); await p.flash('t-sing', 2000); },
    tongue: async (p) => { p.mouth('tongue', 1800); p.fx('😜', 1); await p.flash('t-tongue', 1800); },
    roar: async (p) => { p.mouth('open', 1200); snd('roar'); p.fx('💥', 2); await p.flash('t-roar', 1200); },
    sleep: async (p) => { p.eyes('closed'); p.mouth('sleep', 3000); p.fx('💤', 3); await p.flash('t-sleep', 3000); p.eyes(''); },
    sun: async (p) => {
      const l = p.look || {}; const w = l.wear || {}; const had = w.face === 'glasses';
      if (!had) p.setLook(Object.assign({}, l, { wear: Object.assign({}, w, { face: 'glasses' }) }));
      p.fx('☀️', 2); await p.flash('t-sun', 2200);
      if (!had) p.setLook(l);
    },
  };

  const Pup = {
    svg, mount, ACC, sound: null,
    trick: (p, id) => (TRICKS[id] || TRICKS.sit)(p),
  };
  window.Pup = Pup;
})();
