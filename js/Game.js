import * as THREE from 'three';
import { SoundEngine } from './SoundEngine.js';
import { LevelManager } from './LevelManager.js';
import { Player } from './Player.js';
import { EditorController } from './EditorController.js';
import { THEMES, normalizeLevelData, PRESETS } from './Constants.js';
import { Storage } from './Storage.js';
import { TextureGen } from './TextureGen.js';

export class Game {
    constructor() {
        this.mode = 'play';
        this.clock = new THREE.Clock();
        this.sound = new SoundEngine();

        this.initScene();
        this.initLevel();
        this.initPlayer();
        this.initEditor();
        this.initControls();
        this.initUI();

        this.gemsCollected = 0;
        this.crownsCollected = 0;
        this.totalGems = 10;
        this.totalCrowns = 3;

        this.startLoop();
    }
    initScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
        this.scene.add(this.ambientLight);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
        this.dirLight.position.set(18, 30, 18);
        this.scene.add(this.dirLight);

        this.setTheme('sky');
    }
    setTheme(themeKey) {
        const theme = THEMES[themeKey] || THEMES.sky;
        this.scene.background = TextureGen.createSkyTexture(themeKey);
        this.scene.fog = new THREE.Fog(theme.fogColor, 20, 110);
        this.dirLight.color.setHex(theme.light);
        if (this.level) this.level.updateThemeMaterials(themeKey);
        if (this.levelData) this.levelData.theme = themeKey;
    }
    initLevel() {
        this.level = new LevelManager(this.scene);
        const saved = Storage.load();
        if (saved) {
            this.levelData = normalizeLevelData(saved);
        } else {
            this.levelData = normalizeLevelData(JSON.parse(JSON.stringify(PRESETS.preset_cloud)));
        }
        this.level.loadLevel(this.levelData);
    }
    initPlayer() {
        this.player = new Player(this.scene, this.sound);
    }
    initEditor() {
        this.editor = new EditorController(this);
    }
    initControls() {
        window.keys = {};
        window.addEventListener('keydown', (e) => {
            window.keys[e.code] = true;
            if (e.code === 'Space') {
                if (this.mode === 'editor') this.startPlay(this.editor.currentRow);
            }
            if (e.code === 'KeyR') {
                this.restart();
            }
        });
        window.addEventListener('keyup', (e) => { window.keys[e.code] = false; });

        const canvas = document.getElementById('game-canvas');
        let isDragging = false;

        const updateTargetX = (clientX) => {
            // Absolute touch/mouse map tracking: Map exact screen width to track width [-5.0, 5.0]
            const normalizedX = clientX / window.innerWidth;
            this.player.targetX = normalizedX * 10.0 - 5.0;
            this.player.targetX = Math.max(-5.0, Math.min(5.0, this.player.targetX));
        };

        const onDown = (clientX) => {
            this.sound.init();
            if (this.mode !== 'play') return;
            isDragging = true;
            updateTargetX(clientX);
        };
        
        const onMove = (clientX) => {
            if (!isDragging || this.mode !== 'play') return;
            updateTargetX(clientX);
        };
        
        const onUp = () => { isDragging = false; };

        canvas.addEventListener('mousedown', (e) => onDown(e.clientX));
        window.addEventListener('mousemove', (e) => onMove(e.clientX));
        window.addEventListener('mouseup', onUp);

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) onDown(e.touches[0].clientX);
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) onMove(e.touches[0].clientX);
        }, { passive: true });
        window.addEventListener('touchend', onUp);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    initUI() {
        document.getElementById('mode-toggle-btn').onclick = () => {
            this.setMode(this.mode === 'play' ? 'editor' : 'play');
        };
        document.getElementById('sound-btn').onclick = () => {
            const muted = this.sound.toggleMute();
            document.getElementById('sound-btn').innerHTML = muted ? "🔇 <span class='hide-mobile'>Muted</span>" : "🔊 <span class='hide-mobile'>Sound</span>";
        };
        document.getElementById('restart-btn').onclick = () => this.restart();
        document.getElementById('modal-retry-btn').onclick = () => {
            document.getElementById('game-overlay').classList.remove('active');
            this.restart();
        };
        document.getElementById('modal-edit-btn').onclick = () => {
            document.getElementById('game-overlay').classList.remove('active');
            this.setMode('editor');
        };
    }
    setMode(mode) {
        this.mode = mode;
        if (mode === 'editor') {
            this.sound.stopMusic();
            this.player.mesh.visible = false;
            this.player.shadow.visible = false;
            this.editor.toggle(true);
            document.getElementById('hud-top').style.display = 'none';
            document.getElementById('mode-toggle-btn').innerText = "▶️ Play Level";
        } else {
            this.editor.toggle(false);
            this.player.mesh.visible = true;
            this.player.shadow.visible = true;
            document.getElementById('hud-top').style.display = 'flex';
            document.getElementById('mode-toggle-btn').innerText = "🛠️ Editor";
            this.restart();
        }
    }
    loadPreset(presetKey) {
        if (PRESETS[presetKey]) {
            this.levelData = normalizeLevelData(JSON.parse(JSON.stringify(PRESETS[presetKey])));
            this.level.loadLevel(this.levelData);
            this.setTheme(this.levelData.theme);
            document.getElementById('theme-select').value = this.levelData.theme;
            this.editor.updateScrubber();
            this.editor.syncTopbarFields();
        }
    }
    startPlay(fromRow = 0) {
        this.setMode('play');
        this.player.reset(fromRow, this.levelData.baseTempo || 11);
        this.sound.startMusic();
    }
    restart() {
        document.getElementById('game-overlay').classList.remove('active');
        this.gemsCollected = 0;
        this.crownsCollected = 0;
        this.updateHUDStats();
        this.player.reset(0, this.levelData.baseTempo || 11);
        this.level.rebuildMeshes();
        this.sound.startMusic();
    }
    onPlayerDeath(reason) {
        this.sound.stopMusic();
        setTimeout(() => {
            const overlay = document.getElementById('game-overlay');
            const title = document.getElementById('overlay-title');
            title.className = "modal-title fail";
            title.innerText = reason === "fall" ? "FELL IN THE VOID!" : "CRASHED!";
            this.showEndModal();
        }, 600);
    }
    onLevelComplete() {
        this.sound.stopMusic();
        this.sound.playCrown();
        const overlay = document.getElementById('game-overlay');
        const title = document.getElementById('overlay-title');
        title.className = "modal-title win";
        title.innerText = "LEVEL COMPLETE!";
        this.showEndModal();
    }
    showEndModal() {
        const totalRows = this.levelData.rows.length;
        const currentRow = Math.min(totalRows, Math.round(-this.player.pos.z / 2.0));
        const pct = Math.min(100, Math.floor((currentRow / totalRows) * 100));

        document.getElementById('overlay-gems').innerText = `${this.gemsCollected}/${this.totalGems}`;
        document.getElementById('overlay-crowns').innerText = `${this.crownsCollected}/${this.totalCrowns}`;
        document.getElementById('overlay-progress').innerText = `${pct}%`;
        document.getElementById('game-overlay').classList.add('active');
    }
    updateHUDStats() {
        document.getElementById('gem-count').innerText = `${this.gemsCollected}/${this.totalGems}`;
        document.getElementById('crown-count').innerText = `${this.crownsCollected}/${this.totalCrowns}`;
    }
    checkItemCollisions() {
        const pPos = this.player.pos;
        // Add the radius offset to adjust obstacle collision bounds for the 1.3x bigger ball
        const rOffset = this.player.radius - 0.6; 

        for (let child of this.level.obstacleGroup.children) {
            if (child.userData && !child.userData.collected) {
                const dist = child.position.distanceTo(pPos);
                const hitRadius = child.userData.hitRadius + rOffset;

                if (child.userData.isItem) {
                    if (dist < hitRadius) {
                        child.userData.collected = true;
                        child.visible = false;
                        if (child.userData.isCrown) {
                            this.crownsCollected++;
                            this.sound.playCrown();
                        } else {
                            this.gemsCollected++;
                            this.sound.playGem();
                        }
                        this.updateHUDStats();
                    }
                } else {
                    if (dist < hitRadius && Math.abs(pPos.y - child.position.y) < child.userData.hitHeight) {
                        this.player.crash("obstacle");
                        return;
                    }
                }
            }
        }
    }
    update() {
        const delta = Math.min(0.05, this.clock.getDelta());

        if (this.mode === 'play') {
            if (window.keys) {
                if (window.keys['ArrowLeft'] || window.keys['KeyA']) this.player.targetX -= 14.0 * delta;
                if (window.keys['ArrowRight'] || window.keys['KeyD']) this.player.targetX += 14.0 * delta;
                this.player.targetX = Math.max(-5.0, Math.min(5.0, this.player.targetX));
            }

            this.player.update(delta, this.level);
            this.level.update(delta, this.player.pos.z);
            this.checkItemCollisions();

            // Camera TRANSLATES with the ball perfectly but only 50% (half tracking)
            this.camera.position.x = this.player.pos.x * 0.5;
            this.camera.position.y = Math.max(4.5, this.player.pos.y + 8.0);
            this.camera.position.z = this.player.pos.z + 5.5;
            this.camera.lookAt(
                this.player.pos.x * 0.5, // Look straight ahead from where the translated camera is
                Math.max(0, this.player.pos.y * 0.35),
                this.player.pos.z - 2.5
            );

            const totalRows = this.levelData.rows.length;
            const currentRow = Math.min(totalRows, Math.max(0, -this.player.pos.z / 2.0));
            const pct = Math.min(100, Math.floor((currentRow / (totalRows - 1)) * 100));
            document.getElementById('progress-fill').style.width = `${pct}%`;
            document.getElementById('progress-text').innerText = `${pct}%`;

            if (currentRow >= totalRows - 1 && !this.player.isDead) {
                this.onLevelComplete();
            }
        } else {
            this.level.update(delta, 0);
        }
    }
    startLoop() {
        const animate = () => {
            this.update();
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(animate);
        };
        animate();
    }
}
