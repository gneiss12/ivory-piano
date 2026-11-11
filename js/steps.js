// Lesson step types: info cards, "find the key" exercises, note-reading drills
const Steps = {};

Steps.info = (root, step, done) => {
  root.innerHTML = `<div class="step-info">
    <div class="info-card">
      <h2>${step.title}</h2>
      <div class="info-body">${step.html}</div>
      ${step.staff ? '<div class="info-staff"></div>' : ''}
    </div>
    ${step.kb ? '<div class="info-kb"></div>' : ''}
    <button class="btn primary big" data-next>Got it →</button>
  </div>`;
  let staff = null, kb = null;
  if (step.staff) {
    staff = new Staff.View(root.querySelector('.info-staff'), { noBand: true });
    const sc = Songs.mini(step.staff);
    staff.setScore({ items: sc.items, ppb: 62, beats: 4, len: sc.len, names: true });
    staff.showStart();
  }
  if (step.kb) {
    kb = new PianoKeyboard(root.querySelector('.info-kb'), { lo: step.kb.lo, hi: step.kb.hi });
    kb.setHints(step.kb.marks || []);
  }
  root.querySelector('[data-next]').onclick = () => done({});
  return () => { staff?.destroy(); kb?.destroy(); };
};

Steps.find = (root, step, done) => {
  const targets = step.targets || Array.from({ length: step.reps || 1 }, () => ({ prompt: step.prompt, notes: step.notes, pcs: step.pcs, fingers: step.fingers }));
  root.innerHTML = `<div class="step-find">
    <div class="find-top"><div class="find-prompt"></div><div class="dots"></div><div class="find-fb"></div></div>
    <div class="find-kb"></div></div>`;
  const kb = new PianoKeyboard(root.querySelector('.find-kb'), { lo: step.kb?.lo ?? 48, hi: step.kb?.hi ?? 72 });
  const P = root.querySelector('.find-prompt'), D = root.querySelector('.dots'), F = root.querySelector('.find-fb');
  let i = 0, got = new Set(), misses = 0, busy = false;
  const h = step.h || 'R';
  const hintsFor = tg => {
    if (tg.notes) return tg.notes.map((m, j) => ({ m, h, f: tg.fingers?.[j] }));
    const out = []; for (let m = kb.lo; m <= kb.hi; m++) if (tg.pcs.includes(m % 12)) out.push({ m, h });
    return out;
  };
  const show = () => {
    const tg = targets[i];
    P.innerHTML = tg.prompt;
    D.innerHTML = targets.map((_, j) => `<i class="${j < i ? 'on' : j === i ? 'cur' : ''}"></i>`).join('');
    got.clear(); F.innerHTML = '&nbsp;'; F.className = 'find-fb';
    // chords: show the shape right away; single notes: let her search first
    kb.setHints(tg.notes && tg.notes.length > 1 ? hintsFor(tg) : []);
  };
  const success = () => {
    busy = true; Sound.chime();
    F.innerHTML = ['Yes! ✨', 'Got it! 🎉', 'Perfect! 👏', 'Nice! 🙌'][i % 4]; F.className = 'find-fb good';
    i++;
    D.innerHTML = targets.map((_, j) => `<i class="${j < i ? 'on' : j === i ? 'cur' : ''}"></i>`).join('');
    setTimeout(() => { busy = false; if (i >= targets.length) done({ stars: misses === 0 ? 3 : misses <= 2 ? 2 : 1 }); else show(); }, 700);
  };
  const off = Input.on('noteon', m => {
    if (busy) return;
    const tg = targets[i]; if (!tg) return;
    const pc = ((m % 12) + 12) % 12;
    const ok = tg.notes ? tg.notes.includes(m) || (Input.micOn() && tg.notes.length === 1 && tg.notes[0] % 12 === pc) : tg.pcs.includes(pc);
    if (ok) {
      kb.flash(m, 'good');
      if (tg.notes && tg.notes.length > 1) {
        got.add(m);
        const all = tg.notes.every(x => got.has(x) && Input.held().has(x));
        if (all) success();
        else { const missing = tg.notes.filter(x => !Input.held().has(x)); F.innerHTML = `Hold it and add ${missing.map(Songs.nameOf).join(' + ')}`; F.className = 'find-fb'; }
      } else success();
    } else {
      misses++; kb.flash(m, 'bad');
      F.innerHTML = `That's <b>${Songs.nameOf(m)}</b>. Look for the glowing key${tg.pcs ? 's' : ''}!`; F.className = 'find-fb bad';
      kb.setHints(hintsFor(tg));
    }
  });
  show();
  return () => { off(); kb.destroy(); };
};

// Note-reading drill: a note appears on the staff, play it. Missed notes come back more often.
class NoteDrill {
  constructor(root, { pool, rounds = 10, clef = 'auto', timed = 0, onDone }) {
    this.pool = pool; this.rounds = rounds; this.clef = clef; this.timed = timed; this.onDone = onDone;
    this.root = root; this.n = 0; this.firstTry = 0; this.score = 0; this.combo = 0; this.last = null; this.queue = []; this.busy = false;
    root.innerHTML = `<div class="drill">
      <div class="drill-head"><div class="drill-prompt">Play this note</div><div class="drill-score"></div></div>
      ${timed ? '<div class="timer"><i></i></div>' : '<div class="dots"></div>'}
      <div class="drill-staff"></div>
      <div class="drill-fb">&nbsp;</div>
      <div class="drill-kb"></div></div>`;
    this.staff = new Staff.View(root.querySelector('.drill-staff'), { center: true, noBand: true });
    const [lo, hi] = PianoKeyboard.rangeFor(Math.min(...pool), Math.max(...pool), 10);
    this.kb = new PianoKeyboard(root.querySelector('.drill-kb'), { lo, hi });
    this.fb = root.querySelector('.drill-fb');
    this.off = Input.on('noteon', m => this.onNote(m));
    if (timed) {
      this.tEnd = performance.now() + timed * 1000;
      const tick = () => {
        const left = (this.tEnd - performance.now()) / 1000;
        const bar = root.querySelector('.timer i'); if (bar) bar.style.width = Math.max(0, left / timed * 100) + '%';
        if (left <= 0) return this.end();
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    }
    this.next();
  }
  pick() {
    if (this.queue.length) return this.queue.shift();
    const st = Store.data.noteStats;
    const w = this.pool.map(m => { const p = st[m]; const rate = p ? p.wrong / Math.max(1, p.seen) : 0.3; return m === this.last ? 0 : 1 + rate * 4 + (!p || p.seen < 3 ? 1 : 0); });
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return this.pool[i]; }
    return this.pool[0];
  }
  next() {
    if (!this.timed && this.n >= this.rounds) return this.end();
    const m = this.pick(); this.last = m; this.cur = m; this.tries = 0;
    const p = Songs.fromMidi(m);
    const h = this.clef === 'b' || (this.clef === 'auto' && m < 60) ? 'L' : 'R';
    this.staff.setScore({ items: [{ id: 'd', ...p, t: 0, d: 4, h }], ppb: 100, names: false });
    this.staff.setOffset(0, false);
    this.kb.setHints([]);
    const dots = this.root.querySelector('.dots');
    if (dots) dots.innerHTML = Array.from({ length: this.rounds }, (_, j) => `<i class="${j < this.n ? 'on' : j === this.n ? 'cur' : ''}"></i>`).join('');
    this.root.querySelector('.drill-score').innerHTML = this.timed ? `<b>${this.score}</b> pts${this.combo >= 3 ? ` · 🔥${this.combo}` : ''}` : '';
  }
  onNote(m) {
    if (this.busy || this.finished) return;
    const ok = m === this.cur || (Input.micOn() && (m - this.cur) % 12 === 0);
    if (ok) {
      Store.noteResult(this.cur, this.tries === 0);
      if (this.tries === 0) { this.firstTry++; this.combo++; this.score += 10 + Math.min(this.combo, 10) * 2; } else this.combo = 0;
      this.n++;
      this.staff.mark('d', 'hit'); this.kb.flash(m, 'good');
      this.fb.innerHTML = `<b>${Songs.nameOf(this.cur)}</b> ✓`; this.fb.className = 'drill-fb good';
      this.busy = true;
      setTimeout(() => { this.busy = false; this.fb.innerHTML = '&nbsp;'; this.fb.className = 'drill-fb'; this.next(); }, this.timed ? 220 : 450);
    } else {
      this.tries++; this.combo = 0; this.kb.flash(m, 'bad');
      if (this.tries === 1) this.queue.push(this.cur);
      this.fb.innerHTML = this.tries >= 2 ? `It's <b>${Songs.nameOf(this.cur)}</b> — the glowing key` : `Not ${Songs.nameOf(m)} — try again`;
      this.fb.className = 'drill-fb bad';
      if (this.tries >= 2) this.kb.setHints([{ m: this.cur, h: this.cur < 60 ? 'L' : 'R', f: Songs.nameOf(this.cur) }]);
    }
  }
  end() {
    if (this.finished) return; this.finished = true;
    cancelAnimationFrame(this.raf);
    const acc = this.firstTry / Math.max(1, this.n);
    this.onDone?.({ stars: acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1, acc, score: this.score, count: this.n });
  }
  destroy() { this.finished = true; cancelAnimationFrame(this.raf); this.off(); this.staff.destroy(); this.kb.destroy(); }
}

Steps.drill = (root, step, done) => {
  const d = new NoteDrill(root, { pool: step.pool, rounds: step.rounds, clef: step.clef, onDone: r => done(r) });
  return () => d.destroy();
};
