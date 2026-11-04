import { state } from '../state.js';

// Ambient Particles
// ═══════════════════════════════════════════════════════════════

state.createParticles = function createParticles() {
  const container = document.getElementById('particles');
  const count = 30;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = 8 + Math.random() * 15 + 's';
    p.style.animationDelay = Math.random() * 10 + 's';
    p.style.width = 1 + Math.random() * 2 + 'px';
    const rand = Math.random();
    if (rand < 0.33) p.style.background = '#00f0ff';
    else if (rand < 0.66) p.style.background = '#ff0055';
    else p.style.background = '#00ff88';
    container.appendChild(p);
  }
}

// ═══════════════════════════════════════════════════════════════
