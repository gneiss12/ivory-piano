// Song player: Wait mode (music waits for you), Play mode (keeps tempo, scores timing), Listen mode.
// Extras: loop a range of bars, hints that fade as a song is mastered, and a "hold long notes" check.
const HINT_LABELS = ['Full hints', 'Fewer hints', 'Minimal hints'];
const DUR_NAMES = { 4: 'whole note', 3: 'dotted half note', 2: 'half note' };

class SongPlayer {
  constructor(root, song, opts = {}) {
    this.root = root; this.song = song; this.opts = opts;
    const both = song.hasR && song.hasL;
    this.hands = opts.hands || (song.hasR ? 'R' : 'L');
    if (this.hands === 'B' && !both) this.hands = song.hasR ? 'R' : 'L';
    this.mode = opts.mode || 'wait';
    this.tempo = opts.tempo || 1;
    this.offs = []; this.raf = 0; this.running = false; this.timers = [];
    this.loop = null; // {a, b} bar indexes (inclusive)
    this.bars = this.barStarts();
    this.hint = Store.settings.fadeHints ? (Store.data.songs[song.id]?.hint || 0) : 0;
    this.pressed = new Map();
    this.build();
    this.offs.push(Input.on('noteon', m => this.onNote(m)));
    this.offs.push(Input.on('noteoff', m => this.onRelease(m)));
    this.reset();
  }
  $(s) { return this.root.querySelector(s); }
  barStarts() {
    const s = this.song, st = [0];
    for (let b = s.pickup || s.beats; b < s.len - 1e-6; b += s.beats) st.push(b);
    return st;
  }
  range() {
    if (!this.loop) return [0, this.song.len];
    return [this.bars[this.loop.a], this.bars[this.loop.b + 1] ?? this.song.len];
  }
  build() {
    const s = this.song, both = s.hasR && s.hasL, lockHands = this.opts.lockHands;
    const handLbl = { L: 'Left hand', R: 'Right hand', B: 'Both hands' };
    this.root.innerHTML = `<div class="player">
      <div class="pl-bar">
        <div class="pl-title"><b>${UI.esc(s.title)}</b><small>${lockHands ? handLbl[this.hands] : UI.esc(s.composer)}</small></div>
        ${both && !lockHands ? `<div class="seg" data-g="hands">${['L', 'R', 'B'].map(h => `<button data-v="${h}">${{ L: 'Left', R: 'Right', B: 'Both' }[h]}</button>`).join('')}</div>` : ''}
        <div class="seg" data-g="mode">${[['wait', 'Wait'], ['play', 'Play'], ['listen', 'Listen']].map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div>
        <label class="tempo" title="Speed"><span>Speed</span><input type="range" min="40" max="120" step="5" value="${Math.round(this.tempo * 100)}"><b>${Math.round(this.tempo * 100)}%</b></label>
        <button class="chipbtn" data-act="loop" title="Loop a few bars">🔁 Loop</button>
        <button class="chipbtn" data-act="hint" title="How much help to show">💡 <span></span></button>
        <button class="btn-icon" data-act="restart" title="Start over" aria-label="Start over">↺</button>
      </div>
      <div class="loop-panel hidden">
        <span>Loop bars</span>
        <span class="stepper"><button data-l="a-" aria-label="Earlier start">−</button><b class="la"></b><button data-l="a+" aria-label="Later start">+</button></span>
        <span>to</span>
        <span class="stepper"><button data-l="b-" aria-label="Earlier end">−</button><b class="lb"></b><button data-l="b+" aria-label="Later end">+</button></span>
        <span class="loop-stat"></span>
        <button class="btn small" data-l="off">Done looping</button>
      </div>
      <div class="pl-staff"></div>
      <div class="pl-info"><div class="pl-msg"></div><div class="pl-prog"><i></i></div></div>
      <div class="pl-kb"></div>
      <div class="pl-over hidden"></div>
    </div>`;
    this.staff = new Staff.View(this.$('.pl-staff'));
    const [lo, hi] = PianoKeyboard.rangeFor(s.lo, s.hi, 15);
    this.kb = new PianoKeyboard(this.$('.pl-kb'), { lo, hi, names: this.showNames() });
    this.root.querySelectorAll('.seg button').forEach(b => b.onclick = () => {
      const g = b.parentElement.dataset.g;
      if (g === 'hands') this.hands = b.dataset.v; else this.mode = b.dataset.v;
      this.reset();
    });
    const rng = this.$('.tempo input');
    rng.oninput = () => { this.tempo = rng.value / 100; this.$('.tempo b').textContent = rng.value + '%'; };
    rng.onchange = () => { if (this.mode !== 'wait') this.reset(); };
    this.$('[data-act=restart]').onclick = () => { this.loopStats = null; this.reset(); };
    this.$('[data-act=hint]').onclick = () => this.setHint((this.hint + 1) % 3, true);
    this.$('[data-act=loop]').onclick = () => this.loop ? this.stopLoop() : this.startLoop();
    this.root.querySelectorAll('[data-l]').forEach(b => b.onclick = () => {
      const k = b.dataset.l, n = this.bars.length - 1;
      if (k === 'off') return this.stopLoop();
      const L = this.loop;
      if (k === 'a-') L.a = Math.max(0, L.a - 1);
      if (k === 'a+') { L.a = Math.min(n, L.a + 1); L.b = Math.max(L.b, L.a); }
      if (k === 'b-') { L.b = Math.max(0, L.b - 1); L.a = Math.min(L.a, L.b); }
      if (k === 'b+') L.b = Math.min(n, L.b + 1);
      this.loopStats = null; this.reset();
    });
    this.updateHintBtn();
  }
  showNames() { return Store.settings.names && this.hint === 0; }
  updateHintBtn() { this.$('[data-act=hint] span').textContent = HINT_LABELS[this.hint].split(' ')[0]; this.$('[data-act=hint]').title = HINT_LABELS[this.hint]; }
  setHint(lvl, manual) {
    this.hint = lvl;
    Store.setHint(this.song.id, lvl);
    this.updateHintBtn();
    this.kb.opts.names = this.showNames(); this.kb.render();
    if (manual) UI.toast(['💡 Full hints: note names + glowing keys', '💡 Fewer hints: no note names', '💡 Minimal: keys glow only if you get stuck'][lvl]);
    this.reset();
  }
  startLoop() {
    // default: the bar she's on plus the next one
    const t = this.events?.[this.idx]?.t ?? 0;
    let a = 0; while (a + 1 < this.bars.length && this.bars[a + 1] <= t + 1e-6) a++;
    this.loop = { a, b: Math.min(this.bars.length - 1, a + 1) };
    this.loopStats = null;
    this.$('.loop-panel').classList.remove('hidden');
    this.$('[data-act=loop]').classList.add('on');
    this.reset();
  }
  stopLoop() {
    this.loop = null; this.loopStats = null;
    this.$('.loop-panel').classList.add('hidden');
    this.$('[data-act=loop]').classList.remove('on');
    this.reset();
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
  clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }

  reset({ autostart = false } = {}) {
    this.stop(); this.clearTimers();
    const s = this.song, H = this.hands, [tA, tB] = this.range();
    const mine = n => H === 'B' || n.h === H;
    const inRange = n => n.t >= tA - 1e-6 && n.t < tB - 1e-6;
    this.active = s.notes.filter(n => mine(n) && inRange(n));
    this.accomp = s.notes.filter(n => !mine(n) && inRange(n));
    s.notes.forEach(n => { n.hit = false; n.miss = false; n.played = false; });
    const map = new Map();
    for (const n of this.active) { if (!map.has(n.t)) map.set(n.t, []); map.get(n.t).push(n); }
    this.events = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([t, notes]) => ({ t, notes }));
    this.idx = 0; this.correct = 0; this.wrong = 0; this.combo = 0; this.done = false; this.shortHolds = 0;
    this.pressed.clear(); this.flashMsg = false;
    this.staff.setScore({ items: s.items, ppb: s.ppb, beats: s.beats, pickup: s.pickup, len: s.len, ts: s.ts,
      names: this.showNames(), dimHands: H === 'B' ? [] : [H === 'R' ? 'L' : 'R'] });
    this.staff.setRegion(this.loop ? tA : null, tB);
    if (this.loop) {
      this.$('.la').textContent = this.loop.a + 1; this.$('.lb').textContent = this.loop.b + 1;
      const st = this.loopStats;
      this.$('.loop-stat').innerHTML = st ? `Pass ${st.passes} · <b>${st.clean} clean</b>` : '';
    }
    this.updateSeg(); this.hideOver(); this.progress(0);
    if (this.loop && !this.active.length) {
      this.done = true; this.kb.setHints([]); this.staff.setOffset(tA, true);
      this.msg('This hand has no notes in these bars — pick other bars or hands', 'warn');
      return;
    }
    if (this.mode === 'wait') { this.showEvent(); }
    else {
      this.kb.setHints([]); this.staff.setCurrent([]);
      this.staff.setOffset(tA - 1, false);
      if (autostart) { this.startRun(); return; }
      this.msg(this.mode === 'play' ? 'Play each note as it reaches the line' : 'Sit back and listen');
      this.showOver(`<div class="start-card"><div class="big-emoji">${this.mode === 'play' ? '🎯' : '🎧'}</div>
        <h2>${this.mode === 'play' ? 'Play along' : 'Listen'}</h2>
        <p>${this.mode === 'play' ? 'The music keeps a steady beat. You\'ll hear clicks to count you in.' : 'Hear how the song should sound.'}${this.loop ? ` Bars ${this.loop.a + 1}–${this.loop.b + 1} will repeat until you stop.` : ''}</p></div>`,
        [[this.mode === 'play' ? '▶ Start' : '▶ Play', () => this.startRun(), 'primary']]);
    }
  }

  // ---------- Wait mode ----------
  hintsFor(notes) { return notes.map(n => ({ m: n.midi, h: n.h, f: n.f })); }
  showEvent() {
    this.clearTimers();
    const ev = this.events[this.idx];
    if (!ev) return this.finish();
    this.staff.setOffset(ev.t, true);
    this.staff.setCurrent([...new Set(ev.notes.map(n => n.t + '|' + n.h))]);
    const rem = ev.notes.filter(n => !n.hit);
    this.revealed = this.hint < 2;
    if (this.revealed) this.kb.setHints(this.hintsFor(rem));
    else { this.kb.setHints([]); this.timers.push(setTimeout(() => this.reveal(), 3500)); }
    const [tA, tB] = this.range();
    this.progress(this.idx / this.events.length);
    if (this.flashMsg) { this.flashMsg = false; return; }
    this.msg(this.nextMsg(rem));
  }
  nextMsg(rem) {
    if (this.hint === 0) return 'Next: ' + rem.map(n => `<span class="pill ${n.h}">${n.name}${n.f ? ` · finger ${n.f}` : ''}</span>`).join(' ');
    if (this.hint === 1) return rem.some(n => n.f) ? 'Next: ' + rem.map(n => `<span class="pill ${n.h}">finger ${n.f || '?'}</span>`).join(' ') : 'Read the next note 👀';
    return this.revealed ? 'Here it is: ' + rem.map(n => `<span class="pill ${n.h}">${n.name}</span>`).join(' ') : 'Read the next note 👀';
  }
  reveal() {
    const ev = this.events[this.idx]; if (!ev || this.revealed) return;
    this.revealed = true;
    const rem = ev.notes.filter(n => !n.hit);
    this.kb.setHints(this.hintsFor(rem));
    this.msg(this.nextMsg(rem));
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
      this.pressed.set(m, { n, at: performance.now() });
      this.staff.mark(n.id, 'hit'); this.kb.flash(m, 'good');
      if (ev.notes.every(x => x.hit)) {
        const next = this.events[this.idx + 1];
        this.playAccomp(ev.t, next ? next.t : this.range()[1] + 1);
        this.idx++;
        this.cheer();
        this.showEvent();
      } else {
        const rem = ev.notes.filter(x => !x.hit);
        if (this.revealed) this.kb.setHints(this.hintsFor(rem));
        this.msg('Keep going — add ' + rem.length + ' more');
      }
    } else {
      if (ev.notes.some(x => x.hit && this.match(x, m))) return; // re-pressing a note already played
      this.wrong++; this.combo = 0;
      if (this.loopStats) this.loopStats.dirty = true;
      this.kb.flash(m, 'bad');
      this.revealed = true;
      const rem = ev.notes.filter(x => !x.hit);
      this.kb.setHints(this.hintsFor(rem));
      this.msg(`That was <b>${Songs.nameOf(m)}</b> — look for the glowing key${this.hint === 0 ? ': ' + rem.map(x => `<span class="pill ${x.h}">${x.name}</span>`).join(' ') : ''}`, 'bad');
    }
  }
  // gentle check that long notes are held for their full value
  onRelease(m) {
    const p = this.pressed.get(m); if (!p) return;
    this.pressed.delete(m);
    if (Input.micOn() || this.mode === 'listen' || p.n.d < 2) return;
    const held = (performance.now() - p.at) / 1000, need = p.n.d * this.spb() * 0.7;
    if (held < need) {
      this.shortHolds++;
      this.msg(`⏱️ Hold that ${DUR_NAMES[p.n.d] || 'long note'} for ${p.n.d} beats — count it out loud`, 'warn');
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
    this.tStart = this.range()[0];
    this.t0 = performance.now() / 1000 + ci * this.spbv + 0.15;
    this.nextBeat = this.tStart - ci;
    const loop = () => { if (!this.running) return; this.frame(); this.raf = requestAnimationFrame(loop); };
    loop();
  }
  now() { return this.tStart + (performance.now() / 1000 - this.t0) / this.spbv; }
  frame() {
    const spb = this.spbv, s = this.song, t = this.now(), [tA, tB] = this.range();
    const win = Math.max(0.3, 0.16 / spb);
    if (this.mode === 'play') {
      while (this.nextBeat <= t) {
        const nb = this.nextBeat, counting = nb < this.tStart - 1e-6;
        const accent = counting ? nb === this.tStart - this.countIn : Math.abs((((nb - s.pickup) % s.beats) + s.beats) % s.beats) < 1e-6;
        if (counting || Store.settings.metronome) Sound.click(accent);
        if (counting) this.msg(`<span class="count">${Math.round(this.tStart - nb)}</span>`);
        else if (Math.abs(nb - this.tStart) < 1e-6) this.msg('Go! 🎶');
        this.nextBeat++;
      }
    }
    this.staff.setOffset(Math.max(t, tA - 1), false);
    const auto = this.mode === 'listen' ? this.active.concat(this.accomp) : this.accomp;
    for (const n of auto) {
      if (!n.played && n.t <= t) {
        n.played = true;
        Sound.play(n.midi, 0.6, 0, n.d * spb * 0.95);
        if (this.mode === 'listen') { this.staff.mark(n.id, 'hit'); this.kb.flash(n.midi, 'good', Math.max(150, n.d * spb * 900)); }
      }
    }
    if (this.mode === 'play') {
      for (const n of this.active) if (!n.hit && !n.miss && t > n.t + win) { n.miss = true; this.staff.mark(n.id, 'miss'); this.combo = 0; if (this.loopStats) this.loopStats.dirty = true; }
      const up = this.active.filter(n => !n.hit && !n.miss && n.t <= t + 0.6 && n.t >= t - win);
      this.kb.setHints(this.hint < 2 ? this.hintsFor(up) : []);
      this.staff.setCurrent([...new Set(up.filter(n => n.t <= t + 0.3).map(n => n.t + '|' + n.h))]);
    }
    this.progress((t - tA) / (tB - tA));
    if (t > tB + (this.loop ? 0.25 : 0.6)) this.finish();
  }
  playNote(m) {
    const t = this.now(), win = Math.max(0.3, 0.16 / this.spbv);
    let best = null, bd = 1e9;
    for (const n of this.active) {
      if (n.hit || n.miss || !this.match(n, m)) continue;
      const d = Math.abs(n.t - t);
      if (d <= win && d < bd) { bd = d; best = n; }
    }
    if (best) {
      best.hit = true; this.correct++; this.combo++;
      this.pressed.set(m, { n: best, at: performance.now() });
      this.staff.mark(best.id, 'hit'); this.kb.flash(m, 'good');
      if (this.combo % 10 === 0) this.msg(`🔥 ${this.combo} in a row!`, 'good');
    } else { this.wrong++; this.combo = 0; this.kb.flash(m, 'bad'); if (this.loopStats) this.loopStats.dirty = true; }
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  finish() {
    if (this.done) return;
    this.done = true; this.stop(); this.clearTimers(); this.progress(1);
    this.kb.setHints([]); this.staff.setCurrent([]);
    if (this.loop) return this.loopAgain();
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
    const result = { stars, acc, mode: this.mode, hands: this.hands, tempo: this.tempo, shortHolds: this.shortHolds };
    result.hintUp = this.maybeFadeHints(result);
    if (this.opts.onFinish) this.opts.onFinish(result, this);
    else this.defaultResult(result);
  }
  // after mastering a song with full hints, take some away next time
  maybeFadeHints(r) {
    if (!Store.settings.fadeHints || r.stars < 3 || this.hint >= 2) return '';
    if (this.hint === 0 && r.mode === 'wait') { Store.setHint(this.song.id, 1); return 'Next time, the note names will be hidden for this song — you\'re reading music now! 📖'; }
    if (this.hint === 1) { Store.setHint(this.song.id, 2); return 'Next time, keys only glow if you get stuck. Real reading mode! 🎓'; }
    return '';
  }
  loopAgain() {
    const st = this.loopStats || (this.loopStats = { passes: 0, clean: 0 });
    st.passes++;
    const clean = !st.dirty && this.wrong === 0 && (this.mode !== 'play' || this.active.every(n => n.hit));
    if (clean) st.clean++;
    st.dirty = false;
    if (clean) Sound.chime();
    const note = st.clean >= 3 && clean ? `🌟 ${st.clean} clean in a row! Try a faster speed, or tap “Done looping”.` : clean ? '✓ Clean pass! Again…' : 'Again — slow and steady…';
    this.timers.push(setTimeout(() => {
      if (!this.loop) return;
      this.reset({ autostart: this.mode !== 'wait' });
      this.msg(note, clean ? 'good' : '');
      this.flashMsg = this.mode === 'wait';
    }, 700));
    if (!clean) st.clean = 0;
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
    const tip = r.hintUp ? r.hintUp
      : r.shortHolds >= 2 ? `Tip: you let go of long notes early ${r.shortHolds} times — count “1, 2” on half notes.`
      : r.stars >= 3 ? (r.mode === 'wait' ? 'Ready for Play mode? It adds real rhythm.' : 'Amazing timing!')
      : r.mode === 'play' ? 'Tip: lower the speed a little — accuracy first, speed later. Or 🔁 Loop the tricky bars.'
      : 'Tip: tap 🔁 Loop to practice just the bars that trip you up.';
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
  destroy() { this.stop(); this.clearTimers(); this.offs.forEach(f => f()); this.staff.destroy(); this.kb.destroy(); }
}
