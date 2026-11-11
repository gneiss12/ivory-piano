// Song library (all public domain) + a tiny text notation parser.
// Token: <pitch>[+<pitch>...]<dur>[.][fingers]   e.g.  E4q3   C3+E3+G3h531   G4e.1   rq (rest)
// Durations: w=4 h=2 q=1 e=1/2 s=1/4 beats; '.' = dotted. Chord shorthand: [C]w [G7]h [F]h.
const Songs = (() => {
  const LET = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }, SEMI = [0, 2, 4, 5, 7, 9, 11];
  const DUR = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };
  const CH = { C: ['C3+E3+G3', '531'], G7: ['B2+F3+G3', '521'], F: ['C3+F3+A3', '521'] };
  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

  function pitch(s) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    if (!m) throw new Error('Bad pitch ' + s);
    const L = LET[m[1]], o = +m[3], acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return { step: o * 7 + L, acc, midi: (o + 1) * 12 + SEMI[L] + acc, letter: m[1], name: m[1] + (acc > 0 ? '♯' : acc < 0 ? '♭' : '') };
  }
  const nameOf = m => SHARP[((m % 12) + 12) % 12];
  function fromMidi(m) { const n = SHARP[((m % 12) + 12) % 12]; return pitch(n[0] + (n.length > 1 ? '#' : '') + (Math.floor(m / 12) - 1)); }

  let uid = 0;
  function voice(str, h) {
    const out = []; let t = 0;
    for (const tok of str.trim().split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const m = /^(r|\[\w+\]|[A-G][#b]?\d(?:\+[A-G][#b]?\d)*)([whqes])(\.?)(\d*)$/.exec(tok);
      if (!m) throw new Error('Bad token ' + tok);
      let d = DUR[m[2]]; const dot = !!m[3]; if (dot) d *= 1.5;
      let p = m[1], fs = m[4];
      if (p === 'r') out.push({ id: 'n' + (uid++), rest: true, t, d, h, dot });
      else {
        if (p[0] === '[') { const c = CH[p.slice(1, -1)]; p = c[0]; fs = fs || c[1]; }
        p.split('+').forEach((ps, i) => out.push({ id: 'n' + (uid++), ...pitch(ps), t, d, h, dot, f: fs[i] ? +fs[i] : 0 }));
      }
      t += d;
    }
    return { items: out, len: t };
  }
  function compile(s) {
    const r = s.rh ? voice(s.rh, 'R') : { items: [], len: 0 };
    const l = s.lh ? voice(s.lh, 'L') : { items: [], len: 0 };
    s.items = [...r.items, ...l.items].sort((a, b) => a.t - b.t);
    s.notes = s.items.filter(n => !n.rest);
    s.len = Math.max(r.len, l.len);
    s.hasR = r.items.some(n => !n.rest); s.hasL = l.items.some(n => !n.rest);
    s.beats = s.beats || 4; s.pickup = s.pickup || 0; s.bpm = s.bpm || 90;
    if (s.ts === undefined) s.ts = s.beats + '/4';
    const minD = Math.min(...s.notes.map(n => n.d));
    s.ppb = Math.max(70, 36 / minD);
    s.lo = Math.min(...s.notes.map(n => n.midi)); s.hi = Math.max(...s.notes.map(n => n.midi));
    return s;
  }

  const LIST = [
    { id: 'cwarm', title: 'C Position Warm-up', composer: 'Exercise', level: 1, bpm: 80, unlock: 'l2',
      rh: 'C4q1 D4q2 E4q3 F4q4 | G4q5 F4q4 E4q3 D4q2 | C4w1' },
    { id: 'hcb', title: 'Hot Cross Buns', composer: 'Traditional', level: 1, bpm: 90, unlock: 'l3',
      rh: 'E4q3 D4q2 C4h1 | E4q3 D4q2 C4h1 | C4e1 C4e1 C4e1 C4e1 D4e2 D4e2 D4e2 D4e2 | E4q3 D4q2 C4h1' },
    { id: 'mary', title: 'Mary Had a Little Lamb', composer: 'Traditional', level: 1, bpm: 96, unlock: 'l4',
      rh: 'E4q3 D4q2 C4q1 D4q2 | E4q3 E4q3 E4h3 | D4q2 D4q2 D4h2 | E4q3 G4q5 G4h5 | E4q3 D4q2 C4q1 D4q2 | E4q3 E4q3 E4q3 E4q3 | D4q2 D4q2 E4q3 D4q2 | C4w1' },
    { id: 'auclair', title: 'Au Clair de la Lune', composer: 'French folk song', level: 1, bpm: 90, unlock: 'l5',
      rh: 'C4q1 C4q1 C4q1 D4q2 | E4h3 D4h2 | C4q1 E4q3 D4q2 D4q2 | C4w1 | C4q1 C4q1 C4q1 D4q2 | E4h3 D4h2 | C4q1 E4q3 D4q2 D4q2 | C4w1' },
    { id: 'ode', title: 'Ode to Joy', composer: 'Ludwig van Beethoven', level: 2, bpm: 100, unlock: 'l7',
      rh: 'E4q3 E4q3 F4q4 G4q5 | G4q5 F4q4 E4q3 D4q2 | C4q1 C4q1 D4q2 E4q3 | E4q.3 D4e2 D4h2 | E4q3 E4q3 F4q4 G4q5 | G4q5 F4q4 E4q3 D4q2 | C4q1 C4q1 D4q2 E4q3 | D4q.2 C4e1 C4h1',
      lh: '[C]w | [G7]w | [C]w | [G7]w | [C]w | [G7]w | [C]w | [G7]h [C]h' },
    { id: 'twinkle', title: 'Twinkle, Twinkle, Little Star', composer: 'Traditional', level: 2, bpm: 100, unlock: 'l8',
      rh: 'C4q1 C4q1 G4q5 G4q5 | A4q5 A4q5 G4h5 | F4q4 F4q4 E4q3 E4q3 | D4q2 D4q2 C4h1 | G4q5 G4q5 F4q4 F4q4 | E4q3 E4q3 D4h2 | G4q5 G4q5 F4q4 F4q4 | E4q3 E4q3 D4h2 | C4q1 C4q1 G4q5 G4q5 | A4q5 A4q5 G4h5 | F4q4 F4q4 E4q3 E4q3 | D4q2 D4q2 C4h1' },
    { id: 'lhwarm', title: 'Left Hand Warm-up', composer: 'Exercise', level: 2, bpm: 80, unlock: 'l9',
      lh: 'C3q5 D3q4 E3q3 F3q2 | G3q1 F3q2 E3q3 D3q4 | C3w5' },
    { id: 'hcblh', title: 'Hot Cross Buns (left hand)', composer: 'Traditional', level: 2, bpm: 90, unlock: 'l10',
      lh: 'E3q3 D3q4 C3h5 | E3q3 D3q4 C3h5 | C3e5 C3e5 C3e5 C3e5 D3e4 D3e4 D3e4 D3e4 | E3q3 D3q4 C3h5' },
    { id: 'frere', title: 'Frère Jacques', composer: 'French round', level: 2, bpm: 100, unlock: 'l10',
      rh: 'C4q1 D4q2 E4q3 C4q1 | C4q1 D4q2 E4q3 C4q1 | E4q3 F4q4 G4h5 | E4q3 F4q4 G4h5 | G4e4 A4e5 G4e4 F4e3 E4q2 C4q1 | G4e4 A4e5 G4e4 F4e3 E4q2 C4q1 | C4q1 G3q1 C4h1 | C4q1 G3q1 C4h1' },
    { id: 'chords1', title: 'Chord Steps: C & G7', composer: 'Exercise', level: 2, bpm: 80, unlock: 'l11',
      lh: '[C]h [C]h | [G7]h [G7]h | [C]h [G7]h | [C]w' },
    { id: 'chords2', title: 'Chord Steps: C, F & G7', composer: 'Exercise', level: 2, bpm: 80, unlock: 'l12',
      lh: '[C]h [C]h | [F]h [F]h | [C]h [G7]h | [C]w' },
    { id: 'jingle', title: 'Jingle Bells', composer: 'James Lord Pierpont', level: 3, bpm: 110, unlock: 'l14',
      rh: 'E4q3 E4q3 E4h3 | E4q3 E4q3 E4h3 | E4q3 G4q5 C4q.1 D4e2 | E4w3 | F4q4 F4q4 F4q.4 F4e4 | F4q4 E4q3 E4q3 E4e3 E4e3 | E4q3 D4q2 D4q2 E4q3 | D4h2 G4h5 | E4q3 E4q3 E4h3 | E4q3 E4q3 E4h3 | E4q3 G4q5 C4q.1 D4e2 | E4w3 | F4q4 F4q4 F4q.4 F4e4 | F4q4 E4q3 E4q3 E4e3 E4e3 | G4q5 G4q5 F4q4 D4q2 | C4w1',
      lh: '[C]w | [C]w | [C]w | [C]w | [F]w | [C]w | [G7]w | [G7]w | [C]w | [C]w | [C]w | [C]w | [F]w | [C]w | [G7]w | [C]w' },
    { id: 'bday', title: 'Happy Birthday', composer: 'Mildred & Patty Hill', level: 3, bpm: 100, beats: 3, pickup: 1, unlock: 'l15',
      rh: 'G4e.1 G4s1 | A4q2 G4q1 C5q4 | B4h3 G4e.1 G4s1 | A4q2 G4q1 D5q5 | C5h4 G4e.1 G4s1 | G5q E5q C5q | B4q A4q F5e. F5s | E5q C5q D5q | C5h.',
      lh: 'rq | [C]h. | [G7]h. | [G7]h. | [C]h. | [C]h. | [F]h. | [C]h [G7]q | [C]h.' },
    { id: 'amazing', title: 'Amazing Grace', composer: 'Traditional (J. Newton)', level: 3, bpm: 84, beats: 3, pickup: 1, unlock: 'l16',
      rh: 'G4q1 | C5h3 E5e5 C5e3 | E5h5 D5q4 | C5h3 A4q2 | G4h1 G4q1 | C5h3 E5e5 C5e3 | E5h5 D5q4 | G5h. | rh E5q | G5h E5e C5e | E5h5 D5q4 | C5h3 A4q2 | G4h1 G4q1 | C5h3 E5e5 C5e3 | E5h5 D5q4 | C5h.3',
      lh: 'rq | [C]h. | [C]h. | [F]h. | [C]h. | [C]h. | [G7]h. | [G7]h. | [G7]h. | [C]h. | [C]h. | [F]h. | [C]h. | [C]h. | [G7]h. | [C]h.' },
    { id: 'saints', title: 'When the Saints Go Marching In', composer: 'Traditional', level: 3, bpm: 110, pickup: 3, unlock: 'l17',
      rh: 'C4q1 E4q3 F4q4 | G4w5 | rq C4q1 E4q3 F4q4 | G4w5 | rq C4q1 E4q3 F4q4 | G4h5 E4h3 | C4h1 E4h3 | D4w2 | rq E4q3 E4q3 D4q2 | C4h.1 C4q1 | E4h3 G4h5 | G4q5 F4h.4 | rh E4q3 F4q4 | G4h5 E4h3 | C4h1 D4h2 | C4w1',
      lh: 'rh. | [C]w | [C]w | [C]w | [C]w | [C]w | [C]w | [G7]w | [G7]w | [C]w | [C]w | [F]w | [C]w | [C]w | [G7]w | [C]w' },
    { id: 'canon', title: 'Canon (easy, in C)', composer: 'Johann Pachelbel', level: 4, bpm: 72, unlock: 'l19',
      rh: 'E5w | D5w | C5w | B4w | A4w | G4w | A4w | B4w | C5w | B4w | A4w | G4w | F4w | E4w | F4w | D4w | E5h C5h | D5h B4h | C5h A4h | B4h G4h | A4h F4h | G4h E4h | F4h A4h | G4h B4h | C5w',
      lh: 'C3w | G2w | A2w | E2w | F2w | C3w | F2w | G2w | '.repeat(3) + 'C3w' },
    { id: 'minuet', title: 'Minuet in G', composer: 'Christian Petzold (Anna Magdalena Bach Notebook)', level: 4, bpm: 104, beats: 3, unlock: 'l20',
      rh: 'D5q5 G4e1 A4e2 B4e3 C5e4 | D5q5 G4q1 G4q1 | E5q5 C5e1 D5e2 E5e3 F#5e4 | G5q5 G4q1 G4q1 | C5q4 D5e5 C5e4 B4e3 A4e2 | B4q3 C5e4 B4e3 A4e2 G4e1 | F#4q1 G4e2 A4e3 B4e4 G4e2 | A4h.3 | D5q5 G4e1 A4e2 B4e3 C5e4 | D5q5 G4q1 G4q1 | E5q5 C5e1 D5e2 E5e3 F#5e4 | G5q5 G4q1 G4q1 | C5q4 D5e5 C5e4 B4e3 A4e2 | B4q3 C5e4 B4e3 A4e2 G4e1 | A4q3 B4e4 A4e3 G4e2 F#4e1 | G4h.2',
      lh: 'G3h. | B3h. | C4h. | B3h. | A3h. | G3h. | D3h. | D3h. | G3h. | B3h. | C4h. | B3h. | A3h. | G3h. | D3h. | G2h.' },
    { id: 'furelise', title: 'Für Elise (opening)', composer: 'Ludwig van Beethoven', level: 5, bpm: 60, beats: 1.5, ts: '3/8', pickup: 0.5, unlock: 'l21',
      rh: 'E5s5 D#5s4 | E5s5 D#5s4 E5s5 B4s2 D5s4 C5s3 | A4e1 rs C4s1 E4s2 A4s3 | B4e4 rs E4s1 G#4s3 B4s4 | C5e5 rs E4s1 E5s5 D#5s4 | E5s5 D#5s4 E5s5 B4s2 D5s4 C5s3 | A4e1 rs C4s1 E4s2 A4s3 | B4e4 rs E4s1 C5s4 B4s3 | A4q.2',
      lh: 're | rq. | A2s5 E3s2 A3s1 rs re | E2s5 E3s2 G#3s1 rs re | A2s5 E3s2 A3s1 rs re | rq. | A2s5 E3s2 A3s1 rs re | E2s5 E3s2 G#3s1 rs re | A2s5 E3s2 A3s1 rs re' }
  ];
  LIST.forEach(compile);
  const byId = Object.fromEntries(LIST.map(s => [s.id, s]));

  // small inline example scores for lesson cards
  function mini(spec) { return compile({ id: 'mini' + (uid++), rh: spec.rh, lh: spec.lh, beats: spec.beats || 4, ts: '' }); }

  return { list: LIST, byId, pitch, fromMidi, nameOf, mini };
})();
