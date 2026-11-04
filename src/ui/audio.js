import { state } from '../state.js';

state.getAudioCtx = function getAudioCtx() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioCtx;
};

state.playSound = function playSound(type) {
  if (!state.audioEnabled) return;
  try {
    const ctx = state.getAudioCtx();
    const now = ctx.currentTime;

    if (type === 'hover') {
      // Short high pip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(2000, now);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    if (type === 'moveX') {
      // Higher chime — two quick notes
      [1200, 1600].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.12, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.15);
      });
    }

    if (type === 'moveO') {
      // Resonant saw wave
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.15);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }

    if (type === 'moveTri') {
      // Resonant crystal pulse - two quick harmonics
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.12, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.18);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.18);
      });
    }

    if (type === 'win') {
      // Ascending arpeggio
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const dist = ctx.createWaveShaper();

        // Distortion curve
        const curve = new Float32Array(256);
        for (let j = 0; j < 256; j++) {
          const x = (j * 2) / 256 - 1;
          curve[j] = ((Math.PI + 4) * x) / (Math.PI + 4 * Math.abs(x));
        }
        dist.curve = curve;

        osc.connect(dist);
        dist.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        osc.type = i % 2 === 0 ? 'square' : 'triangle';
        gain.gain.setValueAtTime(0.1, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.4);
      });
    }

    if (type === 'draw') {
      // Low bass slide down
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.5);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  } catch (e) {
    // Audio context may not be available
  }
};

state.toggleAudio = function toggleAudio() {
  state.audioEnabled = !state.audioEnabled;
  document.getElementById('btnAudio').textContent = state.audioEnabled
    ? '🔊'
    : '🔇';
};
