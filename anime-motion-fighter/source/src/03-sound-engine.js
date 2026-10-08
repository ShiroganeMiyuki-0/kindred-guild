// ===================== SOUND ENGINE =====================
class SoundEngine {
  constructor() { this.ctx = null; this.muted = false; this._resumeBound = false; }
  init() {
    if (!this.ctx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (A) this.ctx = new A();
    }
    // Mobile browsers suspend AudioContext until a user gesture occurs.
    // Resume on the next pointer/key interaction if needed.
    if (this.ctx && this.ctx.state === 'suspended' && !this._resumeBound) {
      this._resumeBound = true;
      const resume = () => { this.ctx.resume().catch(() => {}); };
      document.addEventListener('pointerdown', resume, { once: true });
      document.addEventListener('keydown', resume, { once: true });
    }
  }
  tone(type, f0, f1, t, g = 0.5) {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), this.ctx.currentTime + t);
      gain.gain.setValueAtTime(g, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + t);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(); osc.stop(this.ctx.currentTime + t);
    } catch(e) {}
  }
  playPunch()  { this.tone('sine', 260, 30, 0.13, 0.5); }
  playKick()   { this.tone('triangle', 170, 20, 0.22, 0.7); }
  playHit()    { this.tone('sawtooth', 380, 40, 0.22, 0.6); }
  playBlock()  { this.tone('square', 600, 140, 0.09, 0.35); }
  playCharge() { this.tone('sine', 90, 220, 0.08, 0.12); }
  playBeam() {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1400, this.ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.7);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(); osc.stop(this.ctx.currentTime + 0.7);
    } catch(e) {}
  }
  playKO()     { this.tone('sawtooth', 500, 20, 0.9, 0.5); }
  playCombo(n) { this.tone('sine', 400 + n * 60, 200, 0.15, 0.3); }
  playRoundStart() {
    this.tone('sine', 440, 880, 0.3, 0.2);
    setTimeout(() => this.tone('sine', 660, 1320, 0.2, 0.15), 150);
  }
  playVictory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.tone('sine', f, f * 0.5, 0.4, 0.2), i * 120));
  }
  playDefeat() {
    this.tone('sawtooth', 300, 80, 0.6, 0.3);
    setTimeout(() => this.tone('sawtooth', 200, 50, 0.5, 0.2), 200);
  }
  // Ambient drone — subtle background atmosphere
  startAmbient() {
    if (!this.ctx || this._ambientRunning) return;
    this._ambientRunning = true;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc1.type = 'sine'; osc1.frequency.value = 55;
    osc2.type = 'sine'; osc2.frequency.value = 82.5;
    filter.type = 'lowpass'; filter.frequency.value = 200;
    gain.gain.value = 0.04;
    osc1.connect(filter); osc2.connect(filter);
    filter.connect(gain); gain.connect(this.ctx.destination);
    osc1.start(); osc2.start();
    this._ambientOsc = [osc1, osc2];
    this._ambientGain = gain;
  }
  stopAmbient() {
    this._ambientRunning = false;
    this._ambientOsc?.forEach(o => { try { o.stop(); } catch(e) {} });
    this._ambientOsc = null;
  }
}
const sound = new SoundEngine();
