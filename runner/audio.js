// 音效與音樂：全部用 Web Audio 合成（沒有音檔）。音樂是簡單的程序化循環，三個場景各一組音階與節奏。
export class GameAudio {
  constructor() { this.ctx = null; this.muted = localStorage.getItem('runner.muted') === '1'; this.music = null; this.volume = 0.5; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.volume; this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    this.mus = this.ctx.createGain(); this.mus.gain.value = 0.35; this.mus.connect(this.master);
    return this.ctx;
  }
  setMuted(m) { this.muted = m; localStorage.setItem('runner.muted', m ? '1' : '0'); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05); }
  tone(f, dur = 0.12, type = 'square', vol = 0.3, slide = 0, dest) {
    const c = this.ensure(); if (!c) return; const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur = 0.2, vol = 0.3, freq = 1200, q = 1) {
    const c = this.ensure(); if (!c) return; const t = c.currentTime;
    const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t);
  }
  // 事件音效
  count(n) { this.tone(n === 0 ? 880 : 440, n === 0 ? 0.5 : 0.15, 'square', 0.25); }
  go() { this.tone(660, 0.1, 'square', 0.25); setTimeout(() => this.tone(880, 0.1, 'square', 0.25), 90); setTimeout(() => this.tone(1320, 0.4, 'square', 0.25), 180); }
  jump() { this.tone(300, 0.18, 'triangle', 0.25, 400); }
  land() { this.noise(0.08, 0.15, 400, 0.8); }
  hit() { this.noise(0.25, 0.4, 700, 0.6); this.tone(200, 0.3, 'sawtooth', 0.2, -150); }
  slip() { this.tone(900, 0.35, 'sine', 0.25, -700); }
  item() { this.tone(660, 0.08, 'square', 0.2); setTimeout(() => this.tone(990, 0.08, 'square', 0.2), 70); setTimeout(() => this.tone(1320, 0.12, 'square', 0.2), 140); }
  use() { this.tone(500, 0.12, 'triangle', 0.25, 300); }
  shove() { this.noise(0.12, 0.3, 300, 0.7); }
  bump() { this.noise(0.06, 0.12, 500, 1); }
  boost() { this.noise(0.5, 0.25, 2000, 0.5); this.tone(400, 0.5, 'sawtooth', 0.12, 900); }
  dashLoop(on) {
    const c = this.ensure(); if (!c) return;
    if (on && !this.dashN) { const n = Math.floor(c.sampleRate * 1), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.12, c.currentTime, 0.1); s.connect(f); f.connect(g); g.connect(this.sfx); s.start(); this.dashN = { s, g }; }
    if (!on && this.dashN) { const d = this.dashN; this.dashN = null; d.g.gain.setTargetAtTime(0, c.currentTime, 0.08); setTimeout(() => { try { d.s.stop(); } catch (e) {} }, 400); }
  }
  lap() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, 'square', 0.22), i * 90)); }
  finish(place) { const seq = place === 1 ? [523, 659, 784, 1047, 784, 1047] : place <= 3 ? [523, 659, 784, 659] : [392, 349, 330, 262]; seq.forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'square', 0.22), i * 160)); }
  wrong() { this.tone(220, 0.25, 'square', 0.15); }
  shield() { this.tone(1200, 0.2, 'sine', 0.2, -400); }
  // 音樂：16 步的循環，低音＋旋律＋打擊
  startMusic(theme = 'osaka') {
    const c = this.ensure(); if (!c) return; this.stopMusic();
    const scales = {
      osaka: { bpm: 150, bass: [0, 0, 7, 7, 5, 5, 7, 9], mel: [0, 4, 7, 12, 9, 7, 4, 2, 0, 4, 7, 9, 12, 9, 7, 4], root: 220, wave: 'square' },
      tokyo:  { bpm: 138, bass: [0, 0, 5, 5, 3, 3, 7, 7], mel: [0, 3, 7, 10, 7, 3, 0, 3, 5, 7, 10, 12, 10, 7, 5, 3], root: 196, wave: 'triangle' },
      kyoto:  { bpm: 120, bass: [0, 0, 5, 5, 7, 7, 5, 3], mel: [0, 2, 5, 7, 9, 7, 5, 2, 0, 2, 5, 9, 12, 9, 7, 5], root: 233, wave: 'sine' },
    };
    const S = scales[theme] || scales.osaka, stepDur = 60 / S.bpm / 2; let step = 0, next = c.currentTime + 0.1;
    const f = (semi) => S.root * Math.pow(2, semi / 12);
    const play = (freq, dur, type, vol, when) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); o.connect(g); g.connect(this.mus); o.start(when); o.stop(when + dur + 0.02); };
    const kick = (when) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, when); o.frequency.exponentialRampToValueAtTime(40, when + 0.12); g.gain.setValueAtTime(0.5, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.15); o.connect(g); g.connect(this.mus); o.start(when); o.stop(when + 0.2); };
    const hat = (when) => { const n = Math.floor(c.sampleRate * 0.04), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(); s.buffer = buf; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000; const g = c.createGain(); g.gain.value = 0.12; s.connect(hp); hp.connect(g); g.connect(this.mus); s.start(when); };
    const tick = () => {
      while (next < c.currentTime + 0.25) {
        const s16 = step % 16;
        if (s16 % 2 === 0) play(f(S.bass[(s16 / 2) % 8]) / 2, stepDur * 1.8, 'sawtooth', 0.12, next);
        if (Math.random() < 0.85) play(f(S.mel[s16]) * 2, stepDur * 0.9, S.wave, 0.08, next);
        if (s16 % 4 === 0) kick(next); if (s16 % 2 === 1) hat(next);
        next += stepDur; step++;
      }
    };
    this.music = setInterval(tick, 100); tick();
  }
  stopMusic() { if (this.music) { clearInterval(this.music); this.music = null; } }
}
