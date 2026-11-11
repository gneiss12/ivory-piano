// On-screen piano keyboard: shows hints (glowing keys + finger numbers), pressed keys, and accepts touch
const BLACK_PCS = [1, 3, 6, 8, 10];
const isBlack = m => BLACK_PCS.includes(((m % 12) + 12) % 12);

class PianoKeyboard {
  constructor(el, opts = {}) {
    this.el = el; this.opts = opts;
    el.classList.add('kb');
    this.keyEls = new Map(); this.hinted = []; this.ptr = new Map(); this.hintSig = '';
    this.setRange(opts.lo ?? 48, opts.hi ?? 72);
    this.onDown = e => {
      const k = e.target.closest('.key'); if (!k) return;
      e.preventDefault();
      const m = +k.dataset.m;
      this.ptr.set(e.pointerId, m);
      Input.noteOn(m, 0.8, 'touch');
    };
    this.onUp = e => {
      const m = this.ptr.get(e.pointerId); if (m == null) return;
      this.ptr.delete(e.pointerId);
      Input.noteOff(m, 'touch');
    };
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    el.addEventListener('contextmenu', e => e.preventDefault());
    this.offs = [
      Input.on('noteon', m => this.keyEls.get(m)?.classList.add('down')),
      Input.on('noteoff', m => this.keyEls.get(m)?.classList.remove('down'))
    ];
  }
  // pick a range around some notes: at least `minWhite` white keys
  static rangeFor(lo, hi, minWhite = 15) {
    lo -= 2; hi += 2;
    while (isBlack(lo)) lo--; while (isBlack(hi)) hi++;
    const whites = () => { let n = 0; for (let m = lo; m <= hi; m++) if (!isBlack(m)) n++; return n; };
    let flip = false;
    while (whites() < minWhite) { if (flip) { hi++; while (isBlack(hi)) hi++; } else { lo--; while (isBlack(lo)) lo--; } flip = !flip; }
    return [lo, hi];
  }
  setRange(lo, hi) {
    while (isBlack(lo)) lo--; while (isBlack(hi)) hi++;
    this.lo = lo; this.hi = hi; this.render();
  }
  render() {
    this.el.innerHTML = ''; this.keyEls.clear();
    const whites = []; for (let m = this.lo; m <= this.hi; m++) if (!isBlack(m)) whites.push(m);
    const w = 100 / whites.length, names = Store.settings.names;
    whites.forEach((m, i) => {
      const k = document.createElement('div');
      k.className = 'key white' + (m === 60 ? ' middle-c' : '');
      k.dataset.m = m; k.style.left = (i * w) + '%'; k.style.width = w + '%';
      const pc = m % 12;
      if (names || pc === 0) {
        const l = document.createElement('span'); l.className = 'lbl' + (pc === 0 ? ' c' : '');
        l.textContent = 'CDEFGAB'[[0, 2, 4, 5, 7, 9, 11].indexOf(pc)];
        k.appendChild(l);
      }
      this.el.appendChild(k); this.keyEls.set(m, k);
    });
    for (let m = this.lo; m <= this.hi; m++) {
      if (!isBlack(m)) continue;
      const idx = whites.filter(x => x < m).length;
      const k = document.createElement('div');
      k.className = 'key black'; k.dataset.m = m;
      k.style.left = (idx * w - w * 0.31) + '%'; k.style.width = (w * 0.62) + '%';
      this.el.appendChild(k); this.keyEls.set(m, k);
    }
    this.hintSig = '';
  }
  // hints: [{m, h:'R'|'L', f:finger}]
  setHints(list) {
    const sig = list.map(x => x.m + x.h + (x.f || '')).join(',');
    if (sig === this.hintSig) return;
    this.hintSig = sig;
    for (const k of this.hinted) { k.classList.remove('hint', 'hint-R', 'hint-L'); k.querySelector('.fing')?.remove(); }
    this.hinted = [];
    for (const { m, h = 'R', f } of list) {
      const k = this.keyEls.get(m); if (!k) continue;
      k.classList.add('hint', 'hint-' + h);
      const b = document.createElement('span'); b.className = 'fing'; b.textContent = f || '';
      if (!f) b.classList.add('empty');
      k.appendChild(b);
      this.hinted.push(k);
    }
  }
  flash(m, cls, ms = 380) {
    const k = this.keyEls.get(m); if (!k) return;
    k.classList.remove('good', 'bad'); void k.offsetWidth;
    k.classList.add(cls);
    clearTimeout(k._ft); k._ft = setTimeout(() => k.classList.remove(cls), ms);
  }
  destroy() {
    this.offs.forEach(f => f());
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.el.removeEventListener('pointerdown', this.onDown);
    for (const m of this.ptr.values()) Input.noteOff(m, 'touch');
    this.el.innerHTML = '';
  }
}
