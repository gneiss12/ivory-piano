// Persistent progress + settings (localStorage)
const Store = (() => {
  const KEY = 'ivory.v1';
  const fmt = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => fmt(new Date());
  const dayOffset = n => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };
  const defaults = () => ({
    lessons: {}, songs: {}, xp: 0,
    streak: { count: 0, last: null, best: 0 },
    daily: {}, noteStats: {}, questBest: {},
    settings: { name: '', names: true, synthOnMidi: false, goalMin: 10, unlockAll: false, metronome: true }
  });
  let s = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      s = Object.assign(defaults(), p);
      s.settings = Object.assign(defaults().settings, p.settings || {});
      s.streak = Object.assign(defaults().streak, p.streak || {});
    }
  } catch (e) { /* storage unavailable */ }

  let dirty = false;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} dirty = false; }
  setInterval(() => { if (dirty) save(); }, 5000);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  return {
    get data() { return s; },
    get settings() { return s.settings; },
    save, today, dayOffset,
    touchStreak() {
      const t = today();
      if (s.streak.last === t) return false;
      s.streak.count = s.streak.last === dayOffset(-1) ? s.streak.count + 1 : 1;
      s.streak.last = t;
      s.streak.best = Math.max(s.streak.best, s.streak.count);
      save();
      return true;
    },
    streak() { return (s.streak.last === today() || s.streak.last === dayOffset(-1)) ? s.streak.count : 0; },
    practicedOn(day) { return (s.daily[day] || 0) >= 30 || s.streak.last === day; },
    addXP(n) { s.xp += n; save(); },
    level() { return Math.floor(Math.sqrt(s.xp / 40)) + 1; },
    levelProgress() { const L = Math.floor(Math.sqrt(s.xp / 40)) + 1; const a = 40 * (L - 1) ** 2, b = 40 * L ** 2; return (s.xp - a) / (b - a); },
    addSeconds(n) { const t = today(); s.daily[t] = (s.daily[t] || 0) + n; dirty = true; },
    todaySeconds() { return s.daily[today()] || 0; },
    lessonDone(id, stars) { const p = s.lessons[id] || {}; p.done = true; p.stars = Math.max(p.stars || 0, stars); s.lessons[id] = p; save(); },
    songResult(id, stars) { const p = s.songs[id] || { plays: 0, stars: 0 }; p.plays++; p.stars = Math.max(p.stars, stars); s.songs[id] = p; save(); },
    noteResult(m, ok) { const p = s.noteStats[m] || { seen: 0, wrong: 0 }; p.seen++; if (!ok) p.wrong++; s.noteStats[m] = p; dirty = true; },
    reset() { const keep = s.settings; s = defaults(); s.settings = keep; save(); }
  };
})();
