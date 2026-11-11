// Song player: Wait mode (music waits for you), Play mode (keeps tempo, scores timing), Listen mode
class SongPlayer {
  constructor(root, song, opts = {}) {
    this.root = root; this.song = song; this.opts = opts;
    const both = song.hasR && song.hasL;
    this.hands = opts.hands || (song.hasR ? 'R' : 'L');
    if (this.hands === 'B' && !both) this.hands = song.hasR ? 'R' : 'L';
    this.mode = opts.mode || 'wait';
    this.tempo = opts.tempo || 1;
    this.offs = []; this.raf = 0; this.running = false;
    this.build();
    this.offs.push(Input.on('noteon', m => this.onNote(m)));
    this.reset();
  }
  $(s) { return this.root.querySelector(s); }
  build() {
    const s = this.song, both = s.hasR && s.hasL, lockHands = this.opts.lockHands;
    const handLbl = { L: 'Left hand', R: 'Right hand', B: 'Both hands' };
    this.root.innerHTML = `<div class="player">
      <div class="pl-bar">
        <div class="pl-title"><b>${s.title}</b><small>${lockHands ? handLbl[this.hands] : s.composer}</small></div>
        ${both && !lockHands ? `<div class="seg" data-g="hands">${['L', 'R', 'B'].map(h => `<button data-v="${h}">${{ L: 'Left', R: 'Right', B: 'Both' }[h]}</button>`).join('')}</div>` : ''}
        <div class="seg" data-g="mode">${[['wait', 'Wait'], ['play', 'Play'], ['listen', 'Listen']].map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div>
        <label class="tempo" title="Speed"><span>Speed</span><input type="range" min="40" max="120" step="5" value="${Math.round(this.tempo * 100)}"><b>${Math.round(this.tempo * 100)}%</b></label>
        <button class="btn-icon" data-act="restart" title="Start over" aria-label="Start over">↺</button>
      </div>
      <div class="pl-staff"></div>
      <div class="pl-info"><div class="pl-msg"></div><div class="pl-prog"><i></i></div></div>
      <div class="pl-kb"></div>
      <div class="pl-over hidden"></div>
    </div>`;
    this.staff = new Staff.View(this.$('.pl-staff'));
    const [lo, hi] = PianoKeyboard.rangeFor(s.lo, s.hi, 15);
    this.kb = new PianoKeyboard(this.$('.pl-kb'), { lo, hi });
    this.root.querySelectorAll('.seg button').forEach(b => b.onclick = () => {
      const g = b.parentElement.dataset.g;
      if (g === 'hands') this.hands = b.dataset.v; else this.mode = b.dataset.v;
      this.reset();
    });
    const rng = this.$('.tempo input');
    rng.oninput = () => { this.tempo = rng.value / 100; this.$('.tempo b').textContent = rng.value + '%'; };
    rng.onchange = () => { if (this.mode !== 'wait') this.reset(); };
    this.$('[data-act=restart]').onclick = () => this.reset();
  }
  updateSeg() {
    this.root.querySelectorAll('.seg button').forEach(b => {
      const g = b.parentElement.dataset.g;
      b.classList.toggle('on', b.dataset.v === (g === 'hands' ? this.hands : this.mode));
    });
  }
  spb() { return 60 / (this.song.bpm * this.tempo); }
  msg(html, cls = '') { const m = this.$('.pl-msg'); m.innerHTML = html; m.className = 'pl-msg ' + cls; }
  progress(f) { this.$('.pl-prog i').style.width = Math.max(0, Math.min(1, f)) * 100 + '%'; }

  reset() {
    this.stop();
    const s = this.song, H = this.hands;
    const mine = n => H === 'B' || n.h === H;
    this.active = s.notes.filter(mine);
    this.accomp = s.notes.filter(n => !mine(n));
    s.notes.forEach(n => { n.hit = false; n.miss = false; n.played = false; });
    const map = new Map();
    for (const n of this.active) { if (!map.has(n.t)) map.set(n.t, []); map.get(n.t).push(n); }
    this.events = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([t, notes]) => ({ t, notes }));
    this.idx = 0; this.correct = 0; this.wrong = 0; this.combo = 0; this.done = false;
    this.staff.setScore({ items: s.items, ppb: s.ppb, beats: s.beats, pickup: s.pickup, len: s.len, ts: s.ts,
      names: Store.settings.names, dimHands: H === 'B' ? [] : [H === 'R' ? 'L' : 'R'] });
    this.updateSeg(); this.hideOver(); this.progress(0);
    if (this.mode === 'wait') { this.showEvent(); }
    else {
      this.kb.setHints([]); this.staff.setCurrent([]);
      this.staff.setOffset(-1, false);
      this.msg(this.mode === 'play' ? 'Play each note as it reaches the line' : 'Sit back and listen');
      this.showOver(`<div class="start-card"><div class="big-emoji">${this.mode === 'play' ? '🎯' : '🎧'}</div>
        <h2>${this.mode === 'play' ? 'Play along' : 'Listen'}</h2>
        <p>${this.mode === 'play' ? 'The music keeps a steady beat. You\'ll hear clicks to count you in.' : 'Hear how the song should sound.'}</p></div>`,
        [[this.mode === 'play' ? '▶ Start' : '▶ Play', () => this.startRun(), 'primary']]);
    }
  }

  // ---------- Wait mode ----------
  showEvent() {
    const ev = this.events[this.idx];
    if (!ev) return this.finish();
    this.staff.setOffset(ev.t, true);
    this.staff.setCurrent([...new Set(ev.notes.map(n => n.t + '|' + n.h))]);
    const rem = ev.notes.filter(n => !n.hit);
    this.kb.setHints(rem.map(n => ({ m: n.midi, h: n.h, f: n.f })));
    this.progress(this.idx / this.events.length);
    if (this.flashMsg) { this.flashMsg = false; return; }
    this.msg('Next: ' + rem.map(n => `<span class="pill ${n.h}">${n.name}${n.f ? ` · finger ${n.f}` : ''}</span>`).join(' '));
  }
  match(n, m) { return n.midi === m || (Input.micOn() && (((m - n.midi) % 12) + 12) % 12 === 0); }
  onNote(m) {
    if (this.done) return;
    if (this.mode === 'wait') this.waitNote(m);
    else if (this.mode === 'play' && this.running) this.playNote(m);
  }
  waitNote(m) {
    const ev = this.events[this.idx]; if (!ev) return;
    const n = ev.notes.find(x => !x.hit && this.match(x, m));
    if (n) {
      n.hit = true; this.correct++; this.combo++;
      this.staff.mark(n.id, 'hit'); this.kb.flash(m, 'good');
      if (ev.notes.every(x => x.hit)) {
        const next = this.events[this.idx + 1];
        this.playAccomp(ev.t, next ? next.t : this.song.len + 1);
        this.idx++;
        this.msg('', '');
        this.cheer();
        this.showEvent();
      } else {
        const rem = ev.notes.filter(x => !x.hit);
        this.kb.setHints(rem.map(x => ({ m: x.midi, h: x.h, f: x.f })));
        this.msg('Keep going — ' + rem.map(x => `<span class="pill ${x.h}">${x.name}</span>`).join(' '));
      }
    } else {
      if (ev.notes.some(x => x.hit && this.match(x, m))) return; // re-pressing a note already played
      this.wrong++; this.combo = 0;
      this.kb.flash(m, 'bad');
      this.msg(`That was <b>${Songs.nameOf(m)}</b> — look for the glowing key: ` + ev.notes.filter(x => !x.hit).map(x => `<span class="pill ${x.h}">${x.name}</span>`).join(' '), 'bad');
    }
  }
  cheer() {
    const c = this.combo;
    if (c > 0 && c % 10 === 0) {
      const words = ['Nice streak!', 'On fire!', 'Beautiful!', 'You\'re a natural!', 'Unstoppable!'];
      this.msg(`🔥 ${c} in a row — ${words[(c / 10 - 1) % words.length]}`, 'good');
      this.flashMsg = true;
    }
  }
  playAccomp(t0, t1) {
    const spb = this.spb();
    for (const n of this.accomp) if (n.t >= t0 && n.t < t1) Sound.play(n.midi, 0.5, (n.t - t0) * spb, n.d * spb * 0.95);
  }

  // ---------- Play / Listen ----------
  startRun() {
    Sound.ensure(); this.hideOver();
    this.running = true;
    this.spbv = this.spb();
    const ci = this.mode === 'listen' ? 0 : (this.song.beats >= 3 ? this.song.beats : 4);
    this.countIn = ci;
    this.t0 = performance.now() / 1000 + ci * this.spbv + 0.15;
    this.nextBeat = -ci;
    const loop = () => { if (!this.running) return; this.frame(); this.raf = requestAnimationFrame(loop); };
    loop();
  }
  frame() {
    const spb = this.spbv, s = this.song, t = (performance.now() / 1000 - this.t0) / spb;
    const win = Math.max(0.3, 0.16 / spb);
    if (this.mode === 'play') {
      while (this.nextBeat <= t) {
        const nb = this.nextBeat;
        const accent = nb < 0 ? nb === -this.countIn : Math.abs((((nb - s.pickup) % s.beats) + s.beats) % s.beats) < 1e-6;
        if (nb < 0 || Store.settings.metronome) Sound.click(accent);
        if (nb < 0) this.msg(`<span class="count">${-nb}</span>`); else if (nb === 0) this.msg('Go! 🎶');
        this.nextBeat++;
      }
    }
    this.staff.setOffset(Math.max(t, -1), false);
    const auto = this.mode === 'listen' ? s.notes : this.accomp;
    for (const n of auto) {
      if (!n.played && n.t <= t) {
        n.played = true;
        Sound.play(n.midi, 0.6, 0, n.d * spb * 0.95);
        if (this.mode === 'listen') { this.staff.mark(n.id, 'hit'); this.kb.flash(n.midi, 'good', Math.max(150, n.d * spb * 900)); }
      }
    }
    if (this.mode === 'play') {
      for (const n of this.active) if (!n.hit && !n.miss && t > n.t + win) { n.miss = true; this.staff.mark(n.id, 'miss'); this.combo = 0; }
      const up = this.active.filter(n => !n.hit && !n.miss && n.t <= t + 0.6 && n.t >= t - win);
      this.kb.setHints(up.map(n => ({ m: n.midi, h: n.h, f: n.f })));
      this.staff.setCurrent([...new Set(up.filter(n => n.t <= t + 0.3).map(n => n.t + '|' + n.h))]);
    }
    this.progress(t / s.len);
    if (t > s.len + 0.6) this.finish();
  }
  playNote(m) {
    const t = (performance.now() / 1000 - this.t0) / this.spbv, win = Math.max(0.3, 0.16 / this.spbv);
    let best = null, bd = 1e9;
    for (const n of this.active) {
      if (n.hit || n.miss || !this.match(n, m)) continue;
      const d = Math.abs(n.t - t);
      if (d <= win && d < bd) { bd = d; best = n; }
    }
    if (best) { best.hit = true; this.correct++; this.combo++; this.staff.mark(best.id, 'hit'); this.kb.flash(m, 'good'); if (this.combo % 10 === 0) this.msg(`🔥 ${this.combo} in a row!`, 'good'); }
    else { this.wrong++; this.combo = 0; this.kb.flash(m, 'bad'); }
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  finish() {
    if (this.done) return;
    this.done = true; this.stop(); this.progress(1);
    this.kb.setHints([]); this.staff.setCurrent([]);
    if (this.mode === 'listen') {
      this.showOver(`<div class="start-card"><div class="big-emoji">🎶</div><h2>Now you try!</h2><p>Wait mode lets you go at your own pace.</p></div>`,
        [['Try it in Wait mode', () => { this.mode = 'wait'; this.reset(); }, 'primary'], ['Listen again', () => this.reset()]]);
      return;
    }
    let acc, stars;
    if (this.mode === 'wait') {
      acc = this.correct / Math.max(1, this.correct + this.wrong);
      stars = acc >= 0.95 ? 3 : acc >= 0.8 ? 2 : 1;
    } else {
      acc = Math.max(0, (this.correct - this.wrong * 0.25) / Math.max(1, this.active.length));
      stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : acc >= 0.45 ? 1 : 0;
    }
    const result = { stars, acc, mode: this.mode, hands: this.hands, tempo: this.tempo };
    if (this.opts.onFinish) this.opts.onFinish(result, this);
    else this.defaultResult(result);
  }
  defaultResult(r) {
    Store.songResult(this.song.id, r.stars);
    const xp = r.stars ? 5 + r.stars * 5 : 2;
    Store.addXP(xp); Store.touchStreak();
    const btns = [['Play again', () => this.reset(), 'primary']];
    if (r.mode === 'wait' && r.stars >= 2) btns.unshift(['Try Play mode 🎯', () => { this.mode = 'play'; this.reset(); }, 'primary']);
    else if (r.mode === 'play' && r.stars >= 2 && this.tempo < 1) btns.unshift([`Speed up to ${Math.round(Math.min(1, this.tempo + 0.1) * 100)}%`, () => { this.tempo = Math.min(1, Math.round((this.tempo + 0.1) * 20) / 20); this.$('.tempo input').value = this.tempo * 100; this.$('.tempo b').textContent = Math.round(this.tempo * 100) + '%'; this.reset(); }, 'primary']);
    if (btns.length > 1) btns[1][2] = '';
    this.showResult(r, btns, xp);
  }
  showResult(r, buttons, xp) {
    if (r.stars >= 3) { UI.confetti(); Sound.fanfare(); } else if (r.stars > 0) Sound.chime();
    const title = r.stars >= 3 ? 'Perfect!' : r.stars === 2 ? 'Great job!' : r.stars === 1 ? 'You did it!' : 'Keep practicing!';
    const tip = r.stars >= 3 ? (r.mode === 'wait' ? 'Ready for Play mode? It adds real rhythm.' : 'Amazing timing!')
      : r.mode === 'play' ? 'Tip: lower the speed a little — accuracy first, speed later.'
      : 'Tip: go slowly and look at the next note before you play.';
    this.showOver(`<div class="result">
      ${UI.starsHTML(r.stars, true)}
      <h2>${title}</h2>
      <p class="acc">${Math.round(r.acc * 100)}% ${r.mode === 'wait' ? 'accuracy' : 'score'}${xp ? ` · <b>+${xp} XP</b>` : ''}</p>
      <p class="tip">${tip}</p></div>`, buttons);
  }
  showOver(html, buttons = []) {
    const o = this.$('.pl-over');
    o.innerHTML = `<div class="over-card">${html}<div class="over-btns"></div></div>`;
    const bx = o.querySelector('.over-btns');
    for (const [label, fn, cls = ''] of buttons) {
      const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label;
      b.onclick = fn; bx.appendChild(b);
    }
    o.classList.remove('hidden');
  }
  hideOver() { this.$('.pl-over').classList.add('hidden'); }
  destroy() { this.stop(); this.offs.forEach(f => f()); this.staff.destroy(); this.kb.destroy(); }
}
