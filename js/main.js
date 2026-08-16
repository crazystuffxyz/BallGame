import { Game } from './Game.js';

// --- Style adjustments applied dynamically based on screen width ---
if (window.innerWidth <= 768) {
    document.getElementById('mobile-play-btns').style.display = 'flex';
}

// Instantiate and start the game!
window.game = new Game();
