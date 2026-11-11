// Standard MIDI File (.mid) -> Ivory song. Quantizes to a 16th-note grid and splits into right/left hand.
const MidiImport = (() => {
  function parse(buf) {
    const d = new DataView(buf); let p = 0;
    const str = n => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p + i)); p += n; return s; };
    const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
    const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
    const u8 = () => d.getUint8(p++);
    const vlq = () => { let v = 0, b; do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
    if (d.byteLength < 14 || str(4) !== 'MThd') throw new Error('That doesn\'t look like a MIDI file (.mid)');
    const hl = u32(); u16(); const ntr = u16(), div = u16(); p += hl - 6;
    if (div & 0x8000) throw new Error('This MIDI file uses a timing format that isn\'t supported');
    const tracks = []; let tempo = null, ts = null, name = null;
    for (let t = 0; t < ntr && p + 8 <= d.byteLength; t++) {
      const id = str(4), len = u32(), end = Math.min(d.byteLength, p + len);
      if (id !== 'MTrk') { p = end; continue; }
      let tick = 0, rs = 0, tname = '';
      const on = new Map(), notes = [];
      while (p < end) {
        tick += vlq();
        let st = d.getUint8(p);
        if (st & 0x80) { p++; if (st < 0xF0) rs = st; } else st = rs;
        if (st === 0xFF) {
          const type = u8(), l = vlq();
          if (type === 0x51 && tempo == null) tempo = (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2);
          else if (type === 0x58 && !ts) ts = [d.getUint8(p), 2 ** d.getUint8(p + 1)];
          else if (type === 0x03) { let s = ''; for (let i = 0; i < l; i++) s += String.fromCharCode(d.getUint8(p + i)); tname = s.trim(); if (!name && t === 0) name = tname; }
          p += l;
        } else if (st === 0xF0 || st === 0xF7) { p += vlq(); }
        else {
          const cmd = st & 0xF0, ch = st & 0x0F, a = u8(), b = (cmd === 0xC0 || cmd === 0xD0) ? 0 : u8();
          if (ch === 9) continue; // drums
          const k = ch * 128 + a;
          if (cmd === 0x90 && b > 0) { if (!on.has(k)) on.set(k, []); on.get(k).push(tick); }
          else if (cmd === 0x80 || (cmd === 0x90 && b === 0)) { const arr = on.get(k); if (arr && arr.length) notes.push({ s: arr.shift(), e: tick, m: a }); }
        }
      }
      p = end;
      if (notes.length) tracks.push({ name: tname, notes });
    }
    return { div, tempo, ts, name, tracks };
  }

  const DURS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];
  function toRecord(P, title) {
    if (!P.tracks.length) throw new Error('No piano notes were found in this file');
    const q = x => Math.round(x * 4) / 4;
    const tr = P.tracks.map(t => ({ notes: t.notes.map(n => ({ t: q(n.s / P.div), d: (n.e - n.s) / P.div, m: n.m })) }));
    tr.forEach(t => { t.avg = t.notes.reduce((a, n) => a + n.m, 0) / t.notes.length; });
    let notes = [];
    if (tr.length >= 2) {
      // highest-sounding track = right hand, next = left hand, anything else split by pitch
      const sorted = [...tr].sort((a, b) => b.avg - a.avg);
      sorted.forEach((t, i) => t.notes.forEach(n => notes.push({ ...n, h: i === 0 ? 'R' : i === 1 ? 'L' : (n.m >= 60 ? 'R' : 'L') })));
    } else tr[0].notes.forEach(n => notes.push({ ...n, h: n.m >= 60 ? 'R' : 'L' }));
    // keep it playable: clamp to the 88 keys, de-duplicate, snap lengths to written note values
    const seen = new Set();
    notes = notes.filter(n => n.m >= 21 && n.m <= 108).filter(n => { const k = n.t + '|' + n.m + '|' + n.h; if (seen.has(k)) return false; seen.add(k); return true; });
    notes.forEach(n => { n.d = DURS.find(v => v <= n.d + 0.12) || 0.25; });
    // chords in one hand share one length (the shortest), so the music reads cleanly
    const byStart = new Map();
    notes.forEach(n => { const k = n.t + n.h; byStart.set(k, Math.min(byStart.get(k) ?? 9, n.d)); });
    notes.forEach(n => { n.d = byStart.get(n.t + n.h); });
    const beats = P.ts ? P.ts[0] * 4 / P.ts[1] : 4;
    const first = Math.min(...notes.map(n => n.t)), shift = Math.floor(first / beats) * beats;
    notes.forEach(n => { n.t -= shift; });
    notes.sort((a, b) => a.t - b.t || a.m - b.m);
    if (notes.length > 1500) notes = notes.slice(0, 1500);
    return {
      id: 'my-' + Date.now().toString(36), title: title || P.name || 'My song',
      bpm: Math.round(P.tempo ? 60e6 / P.tempo : 100), beats, ts: P.ts ? P.ts[0] + '/' + P.ts[1] : '4/4',
      notes: notes.map(n => [n.t, n.d, n.m, n.h])
    };
  }
  async function fromFile(file) {
    const buf = await file.arrayBuffer();
    return toRecord(parse(buf), file.name.replace(/\.(mid|midi|kar)$/i, '').replace(/[_-]+/g, ' ').trim());
  }
  return { fromFile, parse, toRecord };
})();
