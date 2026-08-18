// js/SoundEngine.js
export class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.musicTimer = null;
        this.step = 0;
        this.bpm = 135;
        this.isPlayingMusic = false;
        
        // Custom Audio Player
        this.customAudio = new Audio();
        this.customAudio.loop = true;
        this.hasCustomAudio = false;
    }
    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    setCustomAudioFile(file) {
        if (!file) return;
        const url = URL.createObjectURL(file);
        this.customAudio.src = url;
        this.hasCustomAudio = true;
        if (this.isPlayingMusic && !this.muted) {
            this.stopSynthMusic();
            this.customAudio.play().catch(() => {});
        }
    }
    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this.stopMusic();
        } else if (window.game && window.game.mode === 'play') {
            this.startMusic();
        }
        return this.muted;
    }
    playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.2) {
        if (this.muted || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch(e){}
    }
    playJump() {
        if (this.muted || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.26);
        } catch(e){}
    }
    playGem() {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime;
        [880, 1174.66, 1760].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.05);
            gain.gain.setValueAtTime(0.2, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.2);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.21);
        });
    }
    playCrown() {
        if (this.muted || !this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50];
        const now = this.ctx.currentTime;
        notes.forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, now + i * 0.07);
            gain.gain.setValueAtTime(0.25, now + i * 0.07);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.4);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.07);
            osc.stop(now + i * 0.07 + 0.41);
        });
    }
    playCrash() {
        if (this.muted || !this.ctx) return;
        try {
            const bufSize = this.ctx.sampleRate * 0.35;
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const out = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                out[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.25));
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buf;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, this.ctx.currentTime);
            filter.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.35);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start();
        } catch(e){}
    }
    playSpeed() {
        if (this.muted || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.21);
        } catch(e){}
    }
    startMusic() {
        if (this.muted) return;

        this.init();

        if (this.isPlayingMusic) {
            return;
        }

        this.isPlayingMusic = true;

        if (this.hasCustomAudio) {
            this.customAudio.currentTime = 0;
            this.customAudio.play().catch(() => {});
            return;
        }

        this.startSynthMusic();
    }
    startSynthMusic() {
        this.stopSynthMusic();
        this.step = 0;
        const interval = (60 / this.bpm) * 1000 / 4;
        const bassScale = [110, 110, 130.81, 146.83, 110, 98.00, 110, 164.81];
        const leadScale = [440, 523.25, 587.33, 659.25, 783.99, 880];

        this.musicTimer = setInterval(() => {
            if (this.muted || !this.isPlayingMusic || this.hasCustomAudio) return;
            if (this.step % 4 === 0) {
                this.playTone(120, 'sine', 0.12, 0.35);
            }
            if (this.step % 8 === 4) {
                this.playTone(280, 'triangle', 0.08, 0.18);
            }
            if (this.step % 2 === 0) {
                const note = bassScale[(this.step / 2) % bassScale.length];
                this.playTone(note, 'sawtooth', 0.1, 0.12);
            }
            if (this.step % 4 === 2 && Math.random() > 0.3) {
                const lNote = leadScale[Math.floor(Math.random() * leadScale.length)];
                this.playTone(lNote, 'sine', 0.18, 0.1);
            }
            this.step = (this.step + 1) % 32;
        }, interval);
    }
    stopSynthMusic() {
        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }
    }
    stopMusic() {
        this.isPlayingMusic = false;
        this.stopSynthMusic();
        if (this.hasCustomAudio) {
            this.customAudio.pause();
        }
    }
}
js/TextureGen.js

// js/TextureGen.js
import * as THREE from 'three';

export const TextureGen = {
    createTileTexture(color1 = '#3a88fe', color2 = '#235bb5', border = '#00f2ff') {
        const cv = document.createElement('canvas');
        cv.width = 128; cv.height = 128;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = color1; ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = color2; ctx.fillRect(8, 8, 112, 112);
        ctx.lineWidth = 6;
        ctx.strokeStyle = border;
        ctx.strokeRect(3, 3, 122, 122);
        ctx.fillStyle = border;
        ctx.fillRect(0, 0, 10, 10); ctx.fillRect(118, 0, 10, 10);
        ctx.fillRect(0, 118, 10, 10); ctx.fillRect(118, 118, 10, 10);
        return new THREE.CanvasTexture(cv);
    },
    createJumpTexture(bg = '#ff0055', arrow = '#ffffff') {
        const cv = document.createElement('canvas');
        cv.width = 128; cv.height = 128;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, 128, 128);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(4, 4, 120, 120);
        ctx.fillStyle = arrow;
        for (let y of [80, 50, 20]) {
            ctx.beginPath();
            ctx.moveTo(64, y); ctx.lineTo(96, y + 24); ctx.lineTo(82, y + 24);
            ctx.lineTo(64, y + 10); ctx.lineTo(46, y + 24); ctx.lineTo(32, y + 24);
            ctx.closePath();
            ctx.fill();
        }
        return new THREE.CanvasTexture(cv);
    },
    createSpeedTexture(bg = '#ff9900', arrow = '#ffffff') {
        const cv = document.createElement('canvas');
        cv.width = 128; cv.height = 128;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = arrow;
        ctx.beginPath();
        ctx.moveTo(64, 20); ctx.lineTo(100, 70); ctx.lineTo(76, 70);
        ctx.lineTo(76, 108); ctx.lineTo(52, 108); ctx.lineTo(52, 70);
        ctx.lineTo(28, 70);
        ctx.closePath();
        ctx.fill();
        return new THREE.CanvasTexture(cv);
    },
    createGlassTexture() {
        const cv = document.createElement('canvas');
        cv.width = 128; cv.height = 128;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = 'rgba(180, 230, 255, 0.4)';
        ctx.fillRect(0, 0, 128, 128);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(2, 2, 124, 124);
        ctx.beginPath();
        ctx.moveTo(10, 10); ctx.lineTo(60, 70); ctx.lineTo(110, 40);
        ctx.moveTo(60, 70); ctx.lineTo(50, 120);
        ctx.stroke();
        return new THREE.CanvasTexture(cv);
    },
    createSkyTexture(theme = 'sky') {
        const cv = document.createElement('canvas');
        cv.width = 512; cv.height = 512;
        const ctx = cv.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        if (theme === 'sky') {
            grad.addColorStop(0, '#5fa8ff');
            grad.addColorStop(0.6, '#bde0fe');
            grad.addColorStop(1, '#e8f4f8');
        } else if (theme === 'cyber') {
            grad.addColorStop(0, '#09051d');
            grad.addColorStop(0.5, '#2b0938');
            grad.addColorStop(1, '#ff0077');
        } else if (theme === 'inferno') {
            grad.addColorStop(0, '#1a0505');
            grad.addColorStop(0.6, '#4a0e0e');
            grad.addColorStop(1, '#ff3b00');
        } else {
            grad.addColorStop(0, '#020008');
            grad.addColorStop(0.7, '#0d1333');
            grad.addColorStop(1, '#1b2a6b');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        if (theme === 'cosmos' || theme === 'cyber') {
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 150; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const r = Math.random() * 1.5;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        return new THREE.CanvasTexture(cv);
    },
    createTempoTexture(direction = 'same', value = 0) {
        const cv = document.createElement('canvas');
        cv.width = 128; cv.height = 128;
        const ctx = cv.getContext('2d');
        const bg = direction === 'up' ? '#00aa55' : direction === 'down' ? '#aa0033' : '#4a5a78';
        ctx.fillStyle = bg; ctx.fillRect(0, 0, 128, 128);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(4, 4, 120, 120);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (direction === 'up') {
            ctx.moveTo(26, 26); ctx.lineTo(62, 54); ctx.lineTo(26, 82); ctx.lineTo(40, 54); ctx.closePath();
            ctx.moveTo(56, 26); ctx.lineTo(92, 54); ctx.lineTo(56, 82); ctx.lineTo(70, 54); ctx.closePath();
        } else if (direction === 'down') {
            ctx.moveTo(102, 26); ctx.lineTo(66, 54); ctx.lineTo(102, 82); ctx.lineTo(88, 54); ctx.closePath();
            ctx.moveTo(72, 26); ctx.lineTo(36, 54); ctx.lineTo(72, 82); ctx.lineTo(58, 54); ctx.closePath();
        } else {
            ctx.rect(34, 44, 60, 16);
        }
        ctx.fill();
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#ffffff';
        const label = (Math.round(value * 10) / 10) + ' sq/s';
        ctx.strokeText(label, 64, 108);
        ctx.fillText(label, 64, 108);
        return new THREE.CanvasTexture(cv);
    }
};
