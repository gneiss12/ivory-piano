// Unified note input: MIDI keyboard, on-screen keys, computer keyboard, microphone
const Input = (() => {
  const listeners = { noteon: [], noteoff: [], status: [] };
  const held = new Set();
  let midiNames = [], midiAccess = null, lastInput = 0, octave = 0;

  function on(ev, fn) { listeners[ev].push(fn); return () => { const a = listeners[ev]; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; }
  function emit(ev, ...args) { for (const fn of [...listeners[ev]]) { try { fn(...args); } catch (e) { console.error(e); } } }

  function noteOn(m, vel = 0.8, src = 'touch') {
    lastInput = Date.now();
    held.add(m);
    if (src === 'touch' || src === 'keys' || (src === 'midi' && Store.settings.synthOnMidi)) Sound.noteOn(m, vel);
    emit('noteon', m, vel, src);
  }
  function noteOff(m, src = 'touch') {
    held.delete(m);
    if (src !== 'mic') Sound.noteOff(m);
    emit('noteoff', m, src);
  }

  // ---------- MIDI ----------
  async function initMIDI() {
    if (!navigator.requestMIDIAccess) { emit('status'); return; }
    try {
      midiAccess = await navigator.requestMIDIAccess();
      midiAccess.onstatechange = bindMIDI;
      bindMIDI();
    } catch (e) { console.warn('MIDI unavailable', e); emit('status'); }
  }
  function bindMIDI() {
    midiNames = [];
    midiAccess.inputs.forEach(inp => {
      inp.onmidimessage = onMIDI;
      if (inp.state !== 'disconnected') midiNames.push(inp.name || 'MIDI keyboard');
    });
    emit('status');
  }
  function onMIDI(e) {
    const [st, d1, d2] = e.data, cmd = st & 0xf0;
    if (cmd === 0x90 && d2 > 0) noteOn(d1, d2 / 127, 'midi');
    else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) noteOff(d1, 'midi');
  }

  // ---------- Computer keyboard (handy on a laptop) ----------
  const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };
  const keyDown = new Map();
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (/input|textarea|select/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'z') { octave = Math.max(-3, octave - 1); return; }
    if (k === 'x') { octave = Math.min(3, octave + 1); return; }
    if (k in KEYMAP && !keyDown.has(k)) { const m = 60 + KEYMAP[k] + octave * 12; keyDown.set(k, m); noteOn(m, 0.8, 'keys'); }
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (keyDown.has(k)) { noteOff(keyDown.get(k), 'keys'); keyDown.delete(k); }
  });

  // ---------- Microphone (single notes) ----------
  let micStream = null, analyser = null, buf = null, micRaf = 0, micNote = null, cand = null, candCount = 0, prevRms = 0, onsetPending = false, frameFlip = false;
  async function startMic() {
    const ctx = Sound.ensure();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const src = ctx.createMediaStreamSource(micStream);
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    src.connect(analyser);
    buf = new Float32Array(analyser.fftSize);
    micLoop(); emit('status');
  }
  function stopMic() {
    cancelAnimationFrame(micRaf);
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    micStream = null; analyser = null;
    if (micNote != null) noteOff(micNote, 'mic');
    micNote = null; emit('status');
  }
  function detectPitch(b, sr) {
    let rms = 0; for (let i = 0; i < b.length; i++) rms += b[i] * b[i];
    rms = Math.sqrt(rms / b.length);
    if (rms < 0.01) return { f: null, rms };
    let r1 = 0, r2 = b.length - 1; const th = 0.2;
    for (let i = 0; i < b.length / 2; i++) if (Math.abs(b[i]) < th) { r1 = i; break; }
    for (let i = 1; i < b.length / 2; i++) if (Math.abs(b[b.length - i]) < th) { r2 = b.length - i; break; }
    const x = b.subarray(r1, r2), n = x.length, maxLag = Math.min(n, Math.ceil(sr / 60));
    const c = new Float32Array(maxLag);
    for (let i = 0; i < maxLag; i++) { let s = 0; for (let j = 0; j < n - i; j++) s += x[j] * x[j + i]; c[i] = s; }
    let d = 0; while (d < maxLag - 1 && c[d] > c[d + 1]) d++;
    let mx = -1, mp = -1; for (let i = d; i < maxLag; i++) if (c[i] > mx) { mx = c[i]; mp = i; }
    if (mp <= 0 || mp >= maxLag - 1) return { f: null, rms };
    const x1 = c[mp - 1], x2 = c[mp], x3 = c[mp + 1], a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
    const T0 = a ? mp - bb / (2 * a) : mp;
    return { f: sr / T0, rms };
  }
  function micLoop() {
    micRaf = requestAnimationFrame(micLoop);
    frameFlip = !frameFlip; if (frameFlip) return; // ~30 fps is plenty
    analyser.getFloatTimeDomainData(buf);
    const { f, rms } = detectPitch(buf, Sound.ctx.sampleRate);
    if (rms > prevRms * 1.7 && rms > 0.02) onsetPending = true;
    prevRms = rms;
    const m = f && f > 50 && f < 2200 ? Math.round(69 + 12 * Math.log2(f / 440)) : null;
    if (m != null && rms > 0.015) {
      if (m === cand) candCount++; else { cand = m; candCount = 1; }
      if (candCount >= 2 && (micNote !== m || onsetPending)) {
        if (micNote != null) noteOff(micNote, 'mic');
        micNote = m; onsetPending = false;
        noteOn(m, Math.min(1, rms * 5), 'mic');
      }
    } else if (rms < 0.008 && micNote != null) {
      noteOff(micNote, 'mic'); micNote = null; cand = null;
    }
  }

  return {
    on, noteOn, noteOff, initMIDI, startMic, stopMic,
    held: () => held,
    micOn: () => !!micStream,
    lastInput: () => lastInput,
    status: () => ({ midiSupported: !!navigator.requestMIDIAccess, devices: midiNames.slice(), mic: !!micStream })
  };
})();
