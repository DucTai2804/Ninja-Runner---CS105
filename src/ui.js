// ==========================================
// KẾT NỐI GIAO DIỆN HTML (UI)
// ==========================================

export const scoreUI = document.getElementById('scoreUI');
export const coinUI = document.getElementById('coinUI');
export const fpsCounter = document.getElementById('fpsCounter');
export const gameOverUI = document.getElementById('gameOverUI');
export const susanooBarContainer = document.getElementById('susanooBarContainer');
export const susanooBarInner = document.getElementById('susanooBarInner');

export const btnPause = document.getElementById('btnPause');
export const btnToggleTrees = document.getElementById('btnToggleTrees');
export const timeModeSelect = document.getElementById('timeMode');
export const practiceModeSelect = document.getElementById('practiceMode');

export function updateFPS(fps) {
    if (fpsCounter) {
        fpsCounter.innerText = `FPS: ${fps}`;
        fpsCounter.style.color = fps >= 50 ? '#00ff00' : (fps >= 30 ? '#ffff00' : '#ff0000');
    }
}
