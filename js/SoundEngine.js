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
