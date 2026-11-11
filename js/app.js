// UI helpers
const UI = {
  esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  starsHTML(n, big = false) { return `<div class="stars${big ? ' big' : ''}">${[1, 2, 3].map(i => `<span class="${i <= n ? 'on' : ''}" style="--i:${i}">★</span>`).join('')}</div>`; },
  toast(msg) {
    const t = document.getElementById('toast'); t.innerHTML = msg; t.classList.add('show');
    clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('show'), 2400);
  },
  confetti() {
    const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
    const dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
    c.width = W * dpr; c.height = H * dpr; const x = c.getContext('2d'); x.scale(dpr, dpr);
    const cols = ['#7c5cff', '#ff7a59', '#f5b301', '#10b981', '#3b82f6', '#e11d48'];
    const ps = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[Math.floor(Math.random() * cols.length)] }));
    const t0 = performance.now();
    const step = now => {
      const el = now - t0; x.clearRect(0, 0, W, H);
      for (const p of ps) { p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.globalAlpha = Math.max(0, 1 - el / 2600); x.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); x.restore(); }
      if (el < 2600) requestAnimationFrame(step); else c.remove();
    };
    requestAnimationFrame(step);
  },
  ring(frac, size = 64, stroke = 7) {
    const r = (size - stroke) / 2, C = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-width="${stroke}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  }
};

const App = (() => {
  const app = document.getElementById('app'), tabs = document.getElementById('tabs');
  let cleanups = [], activity = false, current = 'home';
  const onLeave = f => cleanups.push(f);

  function go(name, params = {}) {
    cleanups.forEach(f => { try { f(); } catch (e) { console.error(e); } }); cleanups = [];
    const sc = Screens[name]; current = name;
    activity = !!sc.activity;
    document.body.classList.toggle('in-activity', activity);
    tabs.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === (sc.tab || name)));
    app.innerHTML = ''; app.scrollTop = 0; window.scrollTo(0, 0);
    sc.render(app, params);
  }
  tabs.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });

  // practice-time tracking: count seconds while in an activity and she's been playing in the last 45s
  setInterval(() => { if (activity && !document.hidden && Date.now() - Input.lastInput() < 45000) Store.addSeconds(1); }, 1000);

  return { go, onLeave, get current() { return current; } };
})();

// ---------- progression helpers ----------
const Prog = {
  idx: id => Lessons.flat.findIndex(l => l.id === id),
  unlocked(i) { if (Store.settings.unlockAll || i <= 0) return true; return !!Store.data.lessons[Lessons.flat[i - 1].id]?.done; },
  next() { return Lessons.flat.find((l, i) => !Store.data.lessons[l.id]?.done && Prog.unlocked(i)) || null; },
  songUnlocked(s) { return !s.unlock || Prog.unlocked(Prog.idx(s.unlock)); },
  doneCount() { return Lessons.flat.filter(l => Store.data.lessons[l.id]?.done).length; }
};

function inputStatus() {
  const st = Input.status();
  if (st.devices.length) return { ok: true, html: `<span class="led on"></span><b>${UI.esc(st.devices[0])}</b> connected` };
  if (st.mic) return { ok: true, html: '<span class="led on"></span>Listening through the <b>microphone</b>' };
  if (!st.midiSupported) return { ok: false, html: '<span class="led"></span>This browser can\'t see your keyboard — <u>how to connect</u>' };
  return { ok: false, html: '<span class="led"></span>No keyboard detected — <u>how to connect</u>' };
}

const Screens = {};

// ---------- HOME ----------
Screens.home = {
  render(root) {
    const s = Store.settings, hr = new Date().getHours();
    const greet = (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + (s.name ? `, ${UI.esc(s.name)}` : '');
    const mins = Store.todaySeconds() / 60, goal = s.goalMin;
    const nxt = Prog.next();
    const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d; });
    const fmt = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const inp = inputStatus();
    root.innerHTML = `<div class="page home">
      <header class="home-head">
        <div><div class="hello">${greet}</div><h1>Let's play 🎹</h1></div>
        <div class="chips">
          <div class="chip fire" title="Day streak">🔥 <b>${Store.streak()}</b></div>
          <div class="chip lvl" title="Level">Lv <b>${Store.level()}</b><i style="--p:${Store.levelProgress()}"></i></div>
        </div>
      </header>
      <section class="card today">
        <div class="ring-wrap">${UI.ring(mins / goal, 72, 8)}<div class="ring-txt"><b>${Math.floor(mins)}</b><small>/${goal}m</small></div></div>
        <div class="today-txt">
          <b>${mins >= goal ? 'Daily goal reached! 🎉' : mins > 0 ? 'Keep it going!' : 'Today\'s practice'}</b>
          <span>${mins >= goal ? 'Anything extra is a bonus.' : `${Math.max(1, Math.ceil(goal - mins))} min to your daily goal`}</span>
          <div class="week">${week.map(d => `<i class="${Store.practicedOn(fmt(d)) ? 'on' : ''}${fmt(d) === Store.today() ? ' today' : ''}">${'SMTWTFS'[d.getDay()]}</i>`).join('')}</div>
        </div>
      </section>
      <button class="conn ${inp.ok ? 'ok' : ''}" data-help>${inp.html}</button>
      ${nxt ? `<button class="card continue" data-lesson="${nxt.id}" style="--u:${nxt.unit.color}">
        <div class="cont-emoji">${nxt.unit.emoji}</div>
        <div class="cont-txt"><small>${Prog.doneCount() ? 'Up next' : 'Start here'} · ${nxt.unit.title}</small><b>${nxt.title}</b><span>${nxt.desc}</span></div>
        <div class="cont-go">▶</div></button>` : `<div class="card continue done"><b>You finished every lesson! 🏆</b><span>Keep polishing songs in the library.</span></div>`}
      <div class="path">${Lessons.units.map(u => `
        <section class="unit" style="--u:${u.color}">
          <div class="unit-head"><span>${u.emoji}</span><div><small>Unit ${u.id.slice(1)}</small><b>${u.title}</b></div></div>
          <div class="nodes">${u.lessons.map((l, j) => {
            const i = Prog.idx(l.id), done = Store.data.lessons[l.id]?.done, open = Prog.unlocked(i), isNext = nxt && nxt.id === l.id;
            const off = [0, 1, 1.4, 1, 0, -1, -1.4, -1][j % 8];
            return `<button class="node ${done ? 'done' : open ? 'open' : 'locked'} ${isNext ? 'next' : ''}" data-lesson="${l.id}" ${open ? '' : 'data-locked'} style="--off:${off}">
              <span class="disc">${done ? '✓' : open ? i + 1 : '🔒'}</span>
              <span class="nlabel">${l.title}${done ? UI.starsHTML(Store.data.lessons[l.id].stars || 0) : ''}</span></button>`;
          }).join('')}</div>
        </section>`).join('')}
      </div>
    </div>`;
    root.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => {
      if (b.hasAttribute('data-locked')) return UI.toast('🔒 Finish the lesson before this one to unlock it');
      App.go('lesson', { id: b.dataset.lesson });
    });
    root.querySelector('[data-help]').onclick = () => App.go('help');
    const off = Input.on('status', () => { if (App.current === 'home') App.go('home'); });
    App.onLeave(off);
  }
};

// ---------- LESSON ----------
Screens.lesson = {
  activity: true, tab: 'home',
  render(root, { id }) {
    const L = Lessons.byId[id]; let i = 0, cleanup = null; const stars = [];
    root.innerHTML = `<div class="lesson" style="--u:${L.unit.color}">
      <div class="lesson-top"><button class="btn-icon" data-x aria-label="Close">✕</button><div class="lprog"><i></i></div><div class="ltitle">${L.title}</div></div>
      <div class="lesson-body"></div></div>`;
    const body = root.querySelector('.lesson-body'), bar = root.querySelector('.lprog i');
    const run = () => {
      cleanup?.(); cleanup = null;
      bar.style.width = (i / L.steps.length * 100) + '%';
      if (i >= L.steps.length) return finish();
      const st = L.steps[i];
      body.innerHTML = ''; body.className = 'lesson-body step-' + st.type;
      const next = (r = {}) => { if (r.stars) stars.push(r.stars); i++; run(); };
      if (st.type === 'song') {
        const song = Songs.byId[st.song];
        const p = new SongPlayer(body, song, { hands: st.hands, mode: st.mode || 'wait', tempo: st.tempo || 1, lockHands: true,
          onFinish: (r, pl) => {
            Store.songResult(song.id, r.stars);
            const btns = r.stars > 0 ? [['Continue →', () => next(r), 'primary'], ['Try again', () => pl.reset()]] : [['Try again', () => pl.reset(), 'primary'], ['Skip for now', () => next({ stars: 1 })]];
            pl.showResult(r, btns, 0);
          } });
        cleanup = () => p.destroy();
      } else cleanup = Steps[st.type](body, st, next);
    };
    const finish = () => {
      const avg = stars.length ? Math.round(stars.reduce((a, b) => a + b, 0) / stars.length) : 3;
      const first = !Store.data.lessons[id]?.done;
      const lvl0 = Store.level();
      Store.lessonDone(id, avg);
      const xp = first ? 20 + avg * 5 : 5 + avg * 2;
      Store.addXP(xp);
      const streakUp = Store.touchStreak();
      const nxt = Prog.next();
      UI.confetti(); Sound.fanfare();
      body.className = 'lesson-body';
      body.innerHTML = `<div class="celebrate">
        <div class="big-emoji">🎉</div>
        <h1>Lesson complete!</h1>
        ${UI.starsHTML(avg, true)}
        <div class="rewards">
          <div><b>+${xp}</b><small>XP</small></div>
          <div><b>🔥 ${Store.streak()}</b><small>${streakUp ? 'streak +1!' : 'day streak'}</small></div>
          ${Store.level() > lvl0 ? `<div><b>Lv ${Store.level()}</b><small>level up!</small></div>` : ''}
        </div>
        ${first ? songUnlockMsg(L.id) : ''}
        <div class="over-btns">
          ${nxt ? `<button class="btn primary big" data-next>Next: ${nxt.title} →</button>` : ''}
          <button class="btn" data-home>Back to map</button>
        </div></div>`;
      body.querySelector('[data-next]')?.addEventListener('click', () => App.go('lesson', { id: nxt.id }));
      body.querySelector('[data-home]').onclick = () => App.go('home');
    };
    root.querySelector('[data-x]').onclick = () => App.go('home');
    App.onLeave(() => cleanup?.());
    run();
  }
};
function songUnlockMsg(lessonId) {
  const nextL = Lessons.flat[Prog.idx(lessonId) + 1]; if (!nextL) return '';
  const ss = Songs.list.filter(s => s.unlock === nextL.id && !/Exercise/.test(s.composer));
  return ss.length ? `<p class="unlock">🔓 New in your library: <b>${ss.map(s => s.title).join(', ')}</b></p>` : '';
}

// ---------- SONG LIBRARY ----------
Screens.songs = {
  render(root) {
    const lvls = ['', 'Beginner', 'Beginner+', 'Hands together', 'Intermediate', 'Challenge'];
    const list = Songs.list.filter(s => !/Exercise/.test(s.composer));
    root.innerHTML = `<div class="page"><header class="page-head"><h1>Songs</h1><p>Every song you unlock stays here to practice and perfect.</p></header>
      <div class="song-list">${list.map(s => {
        const open = Prog.songUnlocked(s), p = Store.data.songs[s.id];
        return `<button class="song-card ${open ? '' : 'locked'}" data-song="${s.id}">
          <div class="song-ico" style="--h:${(s.title.length * 37) % 360}">${open ? '♪' : '🔒'}</div>
          <div class="song-txt"><b>${s.title}</b><small>${s.composer}</small>
            <span class="tags"><em>${lvls[s.level]}</em>${s.hasL && s.hasR ? '<em>2 hands</em>' : ''}</span></div>
          <div class="song-stars">${open ? UI.starsHTML(p?.stars || 0) : `<small>Lesson ${Prog.idx(s.unlock) + 1}</small>`}</div></button>`;
      }).join('')}</div></div>`;
    root.querySelectorAll('[data-song]').forEach(b => b.onclick = () => {
      const s = Songs.byId[b.dataset.song];
      if (!Prog.songUnlocked(s)) return UI.toast(`🔒 Unlocks at Lesson ${Prog.idx(s.unlock) + 1}: ${Lessons.byId[s.unlock].title}`);
      App.go('song', { id: s.id });
    });
  }
};
Screens.song = {
  activity: true, tab: 'songs',
  render(root, { id }) {
    root.innerHTML = `<div class="lesson"><div class="lesson-top"><button class="btn-icon" data-x aria-label="Back">‹</button><div class="ltitle">Song library</div></div><div class="lesson-body step-song"></div></div>`;
    const p = new SongPlayer(root.querySelector('.lesson-body'), Songs.byId[id], {});
    root.querySelector('[data-x]').onclick = () => App.go('songs');
    App.onLeave(() => p.destroy());
  }
};

// ---------- PRACTICE ----------
const QUESTS = {
  treble: { title: 'Treble Notes', desc: 'Right-hand notes, Middle C up to G', pool: [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79], clef: 't', emoji: '🎼', unlock: 'l5' },
  bass: { title: 'Bass Notes', desc: 'Left-hand notes, low F up to Middle C', pool: [41, 43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60], clef: 'b', emoji: '🎵', unlock: 'l9' },
  both: { title: 'Grand Staff Mix', desc: 'Both clefs, shuffled', pool: [43, 45, 47, 48, 50, 52, 53, 55, 57, 60, 62, 64, 65, 67, 69, 71, 72], clef: 'auto', emoji: '🌈', unlock: 'l10' },
  sharps: { title: 'Sharps Too', desc: 'Treble notes with black keys', pool: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72], clef: 't', emoji: '♯', unlock: 'l18' }
};
Screens.practice = {
  render(root) {
    root.innerHTML = `<div class="page"><header class="page-head"><h1>Practice</h1><p>Quick games to sharpen your note reading. A few minutes a day adds up fast!</p></header>
      <h3 class="sec">⚡ Note Quest — 60 seconds</h3>
      <div class="quest-grid">${Object.entries(QUESTS).map(([k, q]) => {
        const open = Prog.unlocked(Prog.idx(q.unlock)), best = Store.data.questBest[k] || 0;
        return `<button class="quest ${open ? '' : 'locked'}" data-q="${k}"><span class="q-emoji">${open ? q.emoji : '🔒'}</span><b>${q.title}</b><small>${q.desc}</small><span class="best">${open ? (best ? `Best: <b>${best}</b>` : 'Not played yet') : `Lesson ${Prog.idx(q.unlock) + 1}`}</span></button>`;
      }).join('')}</div>
      <h3 class="sec">🎹 Free play</h3>
      <button class="card wide" data-free><b>Free play</b><span>Just play — see every note's name and where it sits on the staff.</span></button>
    </div>`;
    root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const q = QUESTS[b.dataset.q];
      if (!Prog.unlocked(Prog.idx(q.unlock))) return UI.toast(`🔒 Unlocks at Lesson ${Prog.idx(q.unlock) + 1}`);
      App.go('quest', { key: b.dataset.q });
    });
    root.querySelector('[data-free]').onclick = () => App.go('free');
  }
};
Screens.quest = {
  activity: true, tab: 'practice',
  render(root, { key }) {
    const q = QUESTS[key];
    root.innerHTML = `<div class="lesson"><div class="lesson-top"><button class="btn-icon" data-x aria-label="Back">‹</button><div class="ltitle">${q.title}</div></div><div class="lesson-body"></div></div>`;
    const body = root.querySelector('.lesson-body');
    let d = null;
    const intro = () => {
      body.innerHTML = `<div class="celebrate"><div class="big-emoji">${q.emoji}</div><h1>${q.title}</h1><p>Play as many notes as you can in 60 seconds. Streaks earn bonus points!</p>
        <p class="acc">Best: <b>${Store.data.questBest[key] || 0}</b></p><div class="over-btns"><button class="btn primary big" data-go>Start</button></div></div>`;
      body.querySelector('[data-go]').onclick = start;
    };
    const start = () => {
      body.innerHTML = '';
      d = new NoteDrill(body, { pool: q.pool, clef: q.clef, timed: 60, onDone: r => {
        const prev = Store.data.questBest[key] || 0, rec = r.score > prev;
        if (rec) Store.data.questBest[key] = r.score;
        Store.addXP(Math.round(r.score / 20)); Store.touchStreak();
        d.destroy(); d = null;
        if (rec) { UI.confetti(); Sound.fanfare(); } else Sound.chime();
        body.innerHTML = `<div class="celebrate"><div class="big-emoji">${rec ? '🏆' : '⭐'}</div><h1>${rec ? 'New record!' : 'Time!'}</h1>
          <div class="rewards"><div><b>${r.score}</b><small>points</small></div><div><b>${r.count}</b><small>notes</small></div><div><b>${Math.round(r.acc * 100)}%</b><small>first try</small></div></div>
          <div class="over-btns"><button class="btn primary big" data-go>Play again</button><button class="btn" data-x2>Done</button></div></div>`;
        body.querySelector('[data-go]').onclick = start;
        body.querySelector('[data-x2]').onclick = () => App.go('practice');
      } });
    };
    intro();
    root.querySelector('[data-x]').onclick = () => App.go('practice');
    App.onLeave(() => d?.destroy());
  }
};
Screens.free = {
  activity: true, tab: 'practice',
  render(root) {
    root.innerHTML = `<div class="lesson"><div class="lesson-top"><button class="btn-icon" data-x aria-label="Back">‹</button><div class="ltitle">Free play</div></div>
      <div class="lesson-body free"><div class="free-name">Play any key</div><div class="free-staff"></div><div class="free-kb"></div></div></div>`;
    const staff = new Staff.View(root.querySelector('.free-staff'), { center: true, noBand: true });
    const kb = new PianoKeyboard(root.querySelector('.free-kb'), { lo: 36, hi: 84 });
    const nm = root.querySelector('.free-name');
    const off = Input.on('noteon', () => {
      const ms = [...Input.held()].sort((a, b) => a - b);
      nm.innerHTML = ms.map(m => `<b>${Songs.nameOf(m)}</b><sub>${Math.floor(m / 12) - 1}</sub>`).join(' ');
      staff.setScore({ items: ms.map((m, i) => ({ id: 'f' + i, ...Songs.fromMidi(m), t: 0, d: 4, h: m < 60 ? 'L' : 'R' })), ppb: 100, names: false });
      staff.setOffset(0);
    });
    root.querySelector('[data-x]').onclick = () => App.go('practice');
    App.onLeave(() => { off(); staff.destroy(); kb.destroy(); });
  }
};

// ---------- SETTINGS ----------
Screens.settings = {
  render(root) {
    const s = Store.settings, st = Input.status();
    const tog = (k, label, sub) => `<label class="row"><div><b>${label}</b><small>${sub}</small></div><input type="checkbox" class="sw" data-k="${k}" ${s[k] ? 'checked' : ''}></label>`;
    root.innerHTML = `<div class="page"><header class="page-head"><h1>Settings</h1></header>
      <div class="card list">
        <label class="row"><div><b>Your name</b><small>For a friendly hello</small></div><input type="text" class="txt" data-name value="${UI.esc(s.name)}" placeholder="Name" maxlength="20"></label>
        <label class="row"><div><b>Daily goal</b><small>Minutes of practice per day</small></div>
          <select data-goal>${[5, 10, 15, 20, 30].map(m => `<option ${m === s.goalMin ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      </div>
      <h3 class="sec">Learning</h3>
      <div class="card list">
        ${tog('names', 'Show note names', 'Letters inside the notes and on the keys. Try turning it off as you improve!')}
        ${tog('metronome', 'Metronome in Play mode', 'Clicks on every beat')}
        ${tog('keepAwake', 'Keep screen awake', Awake.supported ? 'Stops the screen dimming while Ivory is open' : 'Not supported in this browser — turn off Auto-Lock in your device settings instead')}
      </div>
      <h3 class="sec">Keyboard & sound</h3>
      <div class="card list">
        <button class="row" data-help><div><b>Keyboard</b><small>${st.devices.length ? UI.esc(st.devices.join(', ')) + ' connected' : st.midiSupported ? 'None detected' : 'Not supported in this browser'}</small></div><span class="chev">How to connect ›</span></button>
        ${tog('synthOnMidi', 'App sound for keyboard', 'Turn on if your keyboard has no speakers or you\'re using headphones through the iPad')}
        <label class="row"><div><b>Use microphone</b><small>For a real piano without a cable. Works best for single notes.</small></div><input type="checkbox" class="sw" data-mic ${st.mic ? 'checked' : ''}></label>
      </div>
      <h3 class="sec">Progress</h3>
      <div class="card list">
        ${tog('unlockAll', 'Unlock everything', 'Open all lessons and songs')}
        <button class="row danger" data-reset><div><b>Reset progress</b><small>Clear stars, streak and XP</small></div></button>
      </div>
      <p class="foot">Ivory · ${Lessons.flat.length} lessons · ${Songs.list.length} pieces · all music public domain<br>On a computer you can also play with keys A W S E D F T G Y H U J K (Z/X change octave)</p>
    </div>`;
    root.querySelectorAll('[data-k]').forEach(c => c.onchange = () => {
      s[c.dataset.k] = c.checked; Store.save();
      if (c.dataset.k === 'keepAwake') c.checked ? Awake.acquire() : Awake.release();
    });
    root.querySelector('[data-name]').oninput = e => { s.name = e.target.value.trim(); Store.save(); };
    root.querySelector('[data-goal]').onchange = e => { s.goalMin = +e.target.value; Store.save(); };
    root.querySelector('[data-help]').onclick = () => App.go('help');
    root.querySelector('[data-mic]').onchange = async e => {
      if (e.target.checked) { try { await Input.startMic(); UI.toast('🎤 Listening'); } catch (err) { e.target.checked = false; UI.toast('Microphone permission was denied'); } }
      else Input.stopMic();
    };
    root.querySelector('[data-reset]').onclick = () => { if (confirm('Reset all progress? This cannot be undone.')) { Store.reset(); UI.toast('Progress reset'); App.go('home'); } };
  }
};
Screens.help = {
  tab: 'settings',
  render(root) {
    const st = Input.status();
    root.innerHTML = `<div class="page"><header class="page-head"><button class="back" data-back>‹ Back</button><h1>Connect your keyboard</h1>
      <p>${st.devices.length ? `✅ <b>${UI.esc(st.devices.join(', '))}</b> is connected and ready.` : 'With a cable connection the app hears every note and chord perfectly.'}</p></header>
      <div class="card help">
        <h3>📱 On iPad or iPhone</h3>
        <ol><li>Install the free <b>Web MIDI Browser</b> app from the App Store (Safari can't talk to keyboards).</li>
        <li>Connect the keyboard's <b>USB port</b> to the iPad with a USB cable — plus Apple's <b>USB-C</b> or <b>Lightning to USB Camera Adapter</b> if needed.</li>
        <li>Open this app's web address inside Web MIDI Browser and bookmark it. Your progress is saved in that browser.</li></ol>
        <h3>🤖 On Android or a computer</h3>
        <ol><li>Use <b>Chrome</b> or <b>Edge</b>.</li><li>Plug the keyboard in by USB. When asked, allow access to MIDI devices.</li></ol>
        <h3>🎤 No cable?</h3>
        <p>Turn on <b>Use microphone</b> in Settings. It works well for single-note melodies; chords are more reliable with a cable.</p>
        <h3>🔊 Sound</h3>
        <p>Your keyboard makes its own sound. If you'd rather hear the app (e.g. through headphones on the iPad), turn on <b>App sound for keyboard</b> in Settings.</p>
      </div>
      <div class="card list"><div class="row"><div><b>Test it</b><small>Press a few keys on your keyboard</small></div><span class="test-out">—</span></div></div>
    </div>`;
    root.querySelector('[data-back]').onclick = () => history.length > 1 ? App.go('settings') : App.go('home');
    const out = root.querySelector('.test-out');
    const off = Input.on('noteon', (m, v, src) => { out.innerHTML = `<b>${Songs.nameOf(m)}${Math.floor(m / 12) - 1}</b> <small>via ${src === 'midi' ? 'keyboard ✅' : src}</small>`; });
    const off2 = Input.on('status', () => { if (App.current === 'help') App.go('help'); });
    App.onLeave(() => { off(); off2(); });
  }
};

// ---------- keep the screen awake while the app is open ----------
const Awake = (() => {
  let lock = null;
  async function acquire() {
    if (!Store.settings.keepAwake || lock || document.hidden || !('wakeLock' in navigator)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch (e) { lock = null; }
  }
  async function release() { try { await lock?.release(); } catch (e) {} lock = null; }
  // the OS drops the lock when the app is hidden; grab it again on return / on any tap
  document.addEventListener('visibilitychange', () => { if (!document.hidden) acquire(); });
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, acquire, { passive: true }));
  Input.on('noteon', () => { if (!lock) acquire(); });
  return { acquire, release, supported: 'wakeLock' in navigator };
})();

// ---------- boot ----------
Input.initMIDI();
App.go('home');
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
