// Grand-staff renderer (SVG) with a scrolling score and a fixed playhead
const Staff = (() => {
  const NS = 'http://www.w3.org/2000/svg', H = 240, TB = 105, BB = 195;
  // step = octave*7 + letterIndex. Treble bottom line E4 = 30, bass bottom line G2 = 18
  const yOf = (step, clef) => clef === 't' ? TB - (step - 30) * 5 : BB - (step - 18) * 5;
  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function ledgerSteps(step, clef) {
    const out = [];
    if (clef === 't') { for (let s = 28; s >= step; s -= 2) out.push(s); for (let s = 40; s <= step; s += 2) out.push(s); }
    else { for (let s = 16; s >= step; s -= 2) out.push(s); for (let s = 28; s <= step; s += 2) out.push(s); }
    return out;
  }

  const CLEF_FONT = "'Noto Music', 'Segoe UI Symbol', 'Apple Symbols', serif";
  const fitCache = {};
  function clefFit(ch, top, bottom) {
    const key = ch + top + bottom;
    if (fitCache[key]) return fitCache[key];
    const cv = clefFit.cv || (clefFit.cv = document.createElement('canvas').getContext('2d'));
    cv.font = `100px ${CLEF_FONT}`;
    const m = cv.measureText(ch);
    const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent, ink = asc + desc;
    if (!ink || !isFinite(ink)) return { size: 60, y: bottom };
    const k = (bottom - top) / ink, res = { size: 100 * k, y: top + asc * k };
    if (fontsReady) fitCache[key] = res;
    return res;
  }
  let fontsReady = false;
  const views = new Set();
  if (document.fonts) {
    document.fonts.load(`60px 'Noto Music'`, '\u{1D11E}\u{1D122}').finally(() => { fontsReady = true; views.forEach(v => v.drawFixed()); });
  } else fontsReady = true;

  class View {
    constructor(container, opts = {}) {
      this.c = container; this.opts = opts;
      this.svg = el('svg', { class: 'staff-svg' });
      container.appendChild(this.svg);
      this.gLines = el('g', { class: 'lines' }, this.svg);
      this.band = el('rect', { class: 'band', y: 48, height: 166, width: 40, rx: 12 }, this.svg);
      this.gScroll = el('g', { class: 'scroll' }, this.svg);
      this.gFront = el('g', { class: 'front' }, this.svg);
      this.noteEls = new Map(); this.evEls = new Map(); this.cur = [];
      this.t = 0; this.ppb = 70; this.ts = ''; this.clefW = 58;
      this.ro = new ResizeObserver(() => this.layout());
      this.ro.observe(container);
      views.add(this);
      this.layout();
    }
    layout() {
      const w = this.c.clientWidth || 600, h = this.c.clientHeight || 200;
      this.W = Math.max(240, w * H / h);
      this.svg.setAttribute('viewBox', `0 0 ${this.W} ${H}`);
      this.playX = this.opts.center ? this.W / 2 + this.clefW / 2 : Math.min(200, Math.max(this.clefW + 50, this.W * 0.3));
      this.drawFixed();
      this.setOffset(this.t, false);
    }
    drawFixed() {
      const W = this.W;
      this.gLines.innerHTML = ''; this.gFront.innerHTML = '';
      const lines = (g, x1, x2) => {
        for (const s of [30, 32, 34, 36, 38]) el('line', { x1, x2, y1: yOf(s, 't'), y2: yOf(s, 't'), class: 'sl' }, g);
        for (const s of [18, 20, 22, 24, 26]) el('line', { x1, x2, y1: yOf(s, 'b'), y2: yOf(s, 'b'), class: 'sl' }, g);
      };
      lines(this.gLines, 0, W);
      el('rect', { x: 0, y: 0, width: this.clefW, height: H, class: 'cover' }, this.gFront);
      el('rect', { x: this.clefW, y: 0, width: 14, height: H, class: 'cover-fade' }, this.gFront);
      lines(this.gFront, 0, this.clefW + 14);
      el('line', { x1: 4, x2: 4, y1: yOf(38, 't'), y2: yOf(18, 'b'), class: 'sl thick' }, this.gFront);
      // Fit clef glyphs by their measured ink box, so they sit right whatever font the device uses
      const tc = clefFit('\u{1D11E}', yOf(38, 't') - 17, yOf(30, 't') + 15);
      const bc = clefFit('\u{1D122}', yOf(26, 'b') - 1.5, yOf(20, 'b') + 2);
      el('text', { x: 10, y: tc.y, class: 'clef', 'font-size': tc.size }, this.gFront).textContent = '\u{1D11E}';
      el('text', { x: 12, y: bc.y, class: 'clef', 'font-size': bc.size }, this.gFront).textContent = '\u{1D122}';
      if (this.ts) {
        const [a, b] = this.ts.split('/');
        for (const [top, bot] of [[yOf(36, 't'), yOf(32, 't')], [yOf(24, 'b'), yOf(20, 'b')]]) {
          el('text', { x: 64, y: top + 7, class: 'tsig' }, this.gFront).textContent = a;
          el('text', { x: 64, y: bot + 7, class: 'tsig' }, this.gFront).textContent = b;
        }
      }
      this.band.setAttribute('x', this.playX - 20);
      this.band.style.display = this.opts.noBand ? 'none' : '';
    }
    setScore({ items, ppb = 70, beats = 0, pickup = 0, len = 0, ts = '', names = false, dimHands = [] }) {
      this.ts = ts; this.clefW = ts ? 84 : 58; this.ppb = ppb;
      this.layout();
      const g = this.gScroll; g.innerHTML = ''; this.region = null;
      this.noteEls.clear(); this.evEls.clear(); this.cur = [];
      const gap = Math.min(22, ppb * 0.32);
      if (beats) {
        for (let b = pickup || beats; b < len - 1e-6; b += beats) {
          const x = b * ppb - gap;
          el('line', { x1: x, x2: x, y1: yOf(38, 't'), y2: yOf(18, 'b'), class: 'bar' }, g);
        }
        const xe = len * ppb - gap;
        el('line', { x1: xe - 5, x2: xe - 5, y1: yOf(38, 't'), y2: yOf(18, 'b'), class: 'bar' }, g);
        el('line', { x1: xe, x2: xe, y1: yOf(38, 't'), y2: yOf(18, 'b'), class: 'bar end' }, g);
      }
      const groups = new Map();
      for (const it of items) { const k = it.t + '|' + it.h; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
      for (const [k, arr] of groups) {
        const { t, h, d } = arr[0], clef = h === 'L' ? 'b' : 't', x = t * ppb;
        const ev = el('g', { class: 'ev ' + h + (dimHands.includes(h) ? ' dim' : '') }, g);
        this.evEls.set(k, ev);
        if (arr[0].rest) { this.drawRest(ev, x, d, clef); continue; }
        const hollow = d >= 2;
        let minS = 99, maxS = -99;
        for (const n of arr) {
          minS = Math.min(minS, n.step); maxS = Math.max(maxS, n.step);
          const y = yOf(n.step, clef);
          const nh = el('g', { class: 'nh' }, ev);
          this.noteEls.set(n.id, nh);
          for (const s of ledgerSteps(n.step, clef)) el('line', { x1: x - 11, x2: x + 11, y1: yOf(s, clef), y2: yOf(s, clef), class: 'ledger' }, nh);
          el('ellipse', { cx: x, cy: y, rx: 6.8, ry: 5, transform: `rotate(-20 ${x} ${y})`, class: hollow ? 'head hollow' : 'head' }, nh);
          if (n.acc) el('text', { x: x - 19, y: y + 5, class: 'acc' }, nh).textContent = n.acc > 0 ? '♯' : '♭';
          if (n.dot) el('circle', { cx: x + 11, cy: n.step % 2 === 0 ? y - 4 : y, r: 1.9, class: 'dot' }, nh);
          if (names) el('text', { x, y: y + 3, class: 'nm' + (hollow ? ' dark' : '') }, nh).textContent = n.letter;
        }
        if (d < 4) {
          const mid = clef === 't' ? 34 : 22, up = (minS + maxS) / 2 < mid;
          const sx = up ? x + 6.2 : x - 6.2;
          const y1 = up ? yOf(minS, clef) - 1 : yOf(maxS, clef) + 1;
          const y2 = up ? yOf(maxS, clef) - 32 : yOf(minS, clef) + 32;
          el('line', { x1: sx, x2: sx, y1, y2, class: 'stem' }, ev);
          const nf = d <= 0.375 ? 2 : d < 1 ? 1 : 0;
          for (let i = 0; i < nf; i++) {
            const yy = up ? y2 + i * 7 : y2 - i * 7, s = up ? 1 : -1;
            el('path', { d: `M${sx} ${yy} c 1 ${6 * s} 9 ${8 * s} 7 ${17 * s}`, class: 'flag' }, ev);
          }
        }
      }
      this.setOffset(this.t, false);
    }
    drawRest(g, x, d, clef) {
      const mid = clef === 't' ? 34 : 22, y = yOf(mid, clef);
      if (d >= 4) el('rect', { x: x - 6, y: y - 10, width: 12, height: 5, class: 'rest' }, g);
      else if (d >= 2) el('rect', { x: x - 6, y: y - 5, width: 12, height: 5, class: 'rest' }, g);
      else if (d >= 1) el('path', { d: `M${x - 2} ${y - 14} l5 6 l-5 6 l5 6 c-4 -2 -7 0 -3 5`, class: 'rest-line' }, g);
      else {
        el('circle', { cx: x - 2, cy: y - 4, r: 2.4, class: 'rest' }, g);
        el('path', { d: `M${x - 2} ${y - 3} q 4 1 6 -3 l -5 14`, class: 'rest-line' }, g);
      }
    }
    // shaded band behind a looped range of the score (t0 = null clears it)
    setRegion(t0, t1) {
      this.region?.remove(); this.region = null;
      if (t0 == null) return;
      const gap = Math.min(22, this.ppb * 0.32);
      this.region = el('rect', { x: t0 * this.ppb - gap, y: 40, width: (t1 - t0) * this.ppb, height: 180, rx: 10, class: 'loop-region' });
      this.gScroll.insertBefore(this.region, this.gScroll.firstChild);
    }
    setOffset(t, smooth) {
      this.t = t;
      const tx = this.playX - t * this.ppb;
      this.gScroll.style.transition = smooth ? 'transform .3s cubic-bezier(.2,.8,.3,1)' : 'none';
      this.gScroll.style.transform = `translate(${tx}px,0px)`;
    }
    // show score from its beginning (for static examples)
    showStart() { this.setOffset((this.playX - this.clefW - 34) / this.ppb, false); }
    setCurrent(keys) {
      for (const k of this.cur) this.evEls.get(k)?.classList.remove('cur');
      this.cur = keys;
      for (const k of keys) this.evEls.get(k)?.classList.add('cur');
    }
    mark(id, cls) { this.noteEls.get(id)?.classList.add(cls); }
    destroy() { views.delete(this); this.ro.disconnect(); this.svg.remove(); }
  }
  return { View };
})();
