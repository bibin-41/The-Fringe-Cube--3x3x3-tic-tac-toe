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
};

// Remote Mode / Game Warning Toast
// ═══════════════════════════════════════════════════════════════

state.showWarning = function showWarning(message, type = 'warning') {
  let toast = document.getElementById('gameWarningToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'gameWarningToast';
    toast.className = 'game-warning-toast';
    document.getElementById('viewport')?.appendChild(toast);
  }

  const icon = type === 'success' ? '✓' : type === 'info' ? 'ℹ' : '⚠';
  toast.className = `game-warning-toast ${type} visible`;
  toast.innerHTML = `<span class="warning-icon">${icon}</span><span class="warning-text">${message}</span>`;

  if (state.warningTimer) clearTimeout(state.warningTimer);
  state.warningTimer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 3500);

  if (type === 'warning' && state.audioEnabled) {
    state.playSound?.('warning');
  }
};

// ═══════════════════════════════════════════════════════════════
