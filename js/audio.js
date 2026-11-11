// Small Web Audio piano-ish synth + metronome + reward sounds
const Sound = (() => {
  let ctx = null, master = null;
  const held = new Map();

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.8;
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // Unlock audio on first interaction (required on iOS)
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, () => ensure(), { passive: true }));

  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  function voice(m, vel, t) {
    const fr = freq(m);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = fr;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = fr * 2; o2.detune.value = 3;
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = fr;
    const g2 = ctx.createGain(); g2.gain.value = 0.2;
    const g3 = ctx.createGain(); g3.gain.value = 0.55;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); o3.connect(g3); g3.connect(lp);
    lp.connect(g); g.connect(master);
    const peak = 0.26 * (0.35 + 0.65 * vel);
    const dec = Math.max(0.9, Math.min(4, 3.2 - (m - 48) / 22));
    lp.frequency.setValueAtTime(Math.min(12000, fr * 10), t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(8000, fr * 2.5), t + dec * 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    const oscs = [o1, o2, o3];
    oscs.forEach(o => { o.start(t); o.stop(t + dec + 0.1); });
    return { g, oscs };
  }
  function release(v, at) {
    try {
      if (v.g.gain.cancelAndHoldAtTime) v.g.gain.cancelAndHoldAtTime(at); else v.g.gain.cancelScheduledValues(at);
      v.g.gain.setTargetAtTime(0.0001, at, 0.07);
      v.oscs.forEach(o => { try { o.stop(at + 0.5); } catch (e) {} });
    } catch (e) {}
  }
  function noteOn(m, vel = 0.8) {
    if (!ensure()) return;
    const old = held.get(m); if (old) release(old, ctx.currentTime);
    held.set(m, voice(m, vel, ctx.currentTime));
  }
  function noteOff(m) {
    const v = held.get(m); if (!v || !ctx) return;
    held.delete(m); release(v, ctx.currentTime + 0.03);
  }
  function play(m, vel = 0.7, delay = 0, dur = 0.5) {
    if (!ensure()) return;
    const t = ctx.currentTime + Math.max(0, delay);
    release(voice(m, vel, t), t + Math.max(0.08, dur));
  }
  function click(accent) {
    if (!ensure()) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1760 : 1100;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.12, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.06);
  }
  function chime() { [84, 88, 91].forEach((m, i) => play(m, 0.35, i * 0.06, 0.25)); }
  function fanfare() { [72, 76, 79, 84].forEach((m, i) => play(m, 0.55, i * 0.11, i === 3 ? 1.2 : 0.3)); play(60, 0.4, 0.33, 1.2); play(64, 0.35, 0.33, 1.2); }
  return { ensure, noteOn, noteOff, play, click, chime, fanfare, get ctx() { return ensure(); } };
})();
