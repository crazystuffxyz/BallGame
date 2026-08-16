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
