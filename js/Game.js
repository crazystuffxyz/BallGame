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

        this.gemsCollected = 0;
        this.crownsCollected = 0;
        this.totalGems = 0;
        this.totalCrowns = 0;
        this.isLevelComplete = false;

        this.initScene();
        this.initLevel();
        this.initPlayer();
        this.initEditor();
        this.initControls();
        this.initUI();

        this.countCollectibles();
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
        this.countCollectibles();
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

        let isDragging = false;
        let activePointerId = null;

        const updateTargetX = (clientX) => {
            const width = window.innerWidth || 1;
            const normalizedX = Math.max(0, Math.min(1, clientX / width));
            this.player.targetX = normalizedX * 14.0 - 7.0;
        };

        const onPointerDown = (e) => {
            if (this.mode !== 'play' || this.isLevelComplete) return;
            if (e.target.closest('#editor-panel') || e.target.closest('#hud-top')) return;
            
            activePointerId = e.pointerId;
            isDragging = true;
            this.sound.init();
            updateTargetX(e.clientX);
        };

        const onPointerMove = (e) => {
            if (!isDragging || this.mode !== 'play' || this.isLevelComplete) return;
            if (activePointerId !== null && e.pointerId !== activePointerId) return;
            updateTargetX(e.clientX);
        };

        const onPointerUp = (e) => {
            if (e.pointerId === activePointerId) {
                isDragging = false;
                activePointerId = null;
            }
        };

        window.addEventListener('pointerdown', onPointerDown, { passive: true });
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('pointerup', onPointerUp, { passive: true });
        window.addEventListener('pointercancel', onPointerUp, { passive: true });

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
        
        // Custom Music Upload
        const musicFileInput = document.getElementById('music-file-input');
        document.getElementById('music-upload-btn').onclick = () => {
            musicFileInput.click();
        };
        musicFileInput.onchange = (e) => {
            if (e.target.files && e.target.files[0]) {
                this.sound.setCustomAudioFile(e.target.files[0]);
                document.getElementById('music-upload-btn').innerHTML = "🎵 <span class='hide-mobile'>Custom</span>";
                alert("Custom music loaded!");
            }
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
            this.isLevelComplete = false;
            this.player.mesh.visible = false;
            this.player.shadow.visible = false;
            if (this.level.editorGridGroup) this.level.editorGridGroup.visible = true;
            this.editor.toggle(true);
            document.getElementById('hud-top').style.display = 'none';
            document.getElementById('mode-toggle-btn').innerText = "▶️ Play Level";
        } else {
            this.editor.toggle(false);
            if (this.level.editorGridGroup) this.level.editorGridGroup.visible = false;
            this.player.mesh.visible = true;
            this.player.shadow.visible = true;
            document.getElementById('hud-top').style.display = 'flex';
            document.getElementById('mode-toggle-btn').innerText = "🛠️ Editor";
            this.countCollectibles();
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
            this.countCollectibles();
        }
    }
    countCollectibles() {
        let gems = 0;
        let crowns = 0;
        if (this.levelData && Array.isArray(this.levelData.rows)) {
            for (const row of this.levelData.rows) {
                if (row && Array.isArray(row.obstacles)) {
                    for (const obs of row.obstacles) {
                        if (obs === 6) gems++;
                        if (obs === 7) crowns++;
                    }
                }
            }
        }
        this.totalGems = gems;
        this.totalCrowns = crowns;
        this.updateHUDStats();
    }
    getFarthestTileRow() {
        if (!this.levelData || !this.levelData.rows || this.levelData.rows.length === 0) return 0;
        for (let r = this.levelData.rows.length - 1; r >= 0; r--) {
            const row = this.levelData.rows[r];
            if (row && Array.isArray(row.tiles) && row.tiles.some(t => t > 0)) {
                return r;
            }
        }
        return Math.max(0, this.levelData.rows.length - 1);
    }
    startPlay(fromRow = 0) {
        this.setMode('play');
        this.isLevelComplete = false;
        this.countCollectibles();
        this.player.reset(fromRow, this.levelData.baseTempo || 11);
        this.sound.startMusic();
    }
    restart() {
        document.getElementById('game-overlay').classList.remove('active');
        this.isLevelComplete = false;
        this.gemsCollected = 0;
        this.crownsCollected = 0;
        this.countCollectibles();
        this.player.reset(0, this.levelData.baseTempo || 11);
        this.level.rebuildMeshes();
        this.sound.startMusic();
    }
    onPlayerDeath(reason) {
        if (this.isLevelComplete) return;
        this.sound.stopMusic();
        setTimeout(() => {
            if (this.isLevelComplete) return;
            const overlay = document.getElementById('game-overlay');
            const title = document.getElementById('overlay-title');
            title.className = "modal-title fail";
            title.innerText = reason === "fall" ? "FELL IN THE VOID!" : "CRASHED!";
            this.showEndModal();
        }, 600);
    }
    onLevelComplete() {
        if (this.isLevelComplete) return;
        this.isLevelComplete = true;

        this.sound.stopMusic();
        this.sound.playCrown();

        this.player.mesh.visible = false;
        this.player.shadow.visible = false;

        const overlay = document.getElementById('game-overlay');
        const title = document.getElementById('overlay-title');
        title.className = "modal-title win";
        title.innerText = "LEVEL COMPLETE!";
        this.showEndModal();
    }
    showEndModal() {
        const farthestRow = this.getFarthestTileRow();
        const currentRow = Math.max(0, -this.player.pos.z / 2.0);
        const progressTarget = Math.max(1, farthestRow);
        const pct = this.isLevelComplete ? 100 : Math.min(100, Math.floor((currentRow / progressTarget) * 100));

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
        if (this.isLevelComplete) return;
        const pPos = this.player.pos;
        const rOffset = this.player.radius - 0.6; 

        for (let child of this.level.obstacleGroup.children) {
            if (child.userData && !child.userData.collected) {
                const dx = pPos.x - child.position.x;
                const dz = pPos.z - child.position.z;
                const dist2D = Math.sqrt(dx * dx + dz * dz);
                const hitRadius = child.userData.hitRadius + rOffset;

                if (child.userData.isItem) {
                    const dist3D = child.position.distanceTo(pPos);
                    if (dist3D < hitRadius) {
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
                } else if (dist2D < hitRadius) {
                    if (child.userData.isOverhead) {
                        const playerTop = pPos.y + this.player.radius;
                        if (playerTop >= child.userData.minY && pPos.y <= child.userData.maxY) {
                            this.player.crash("obstacle");
                            return;
                        }
                    } else if (child.userData.isWall) {
                        if (pPos.y <= child.userData.maxY && pPos.y >= child.userData.minY) {
                            this.player.crash("obstacle");
                            return;
                        }
                    } else {
                        if (Math.abs(pPos.y - child.position.y) < child.userData.hitHeight) {
                            this.player.crash("obstacle");
                            return;
                        }
                    }
                }
            }
        }
    }
    update() {
        const delta = Math.min(0.05, this.clock.getDelta());

        if (this.mode === 'play') {
            if (this.isLevelComplete) {
                this.level.update(delta, this.player.pos.z);
                return;
            }

            if (window.keys) {
                if (window.keys['ArrowLeft'] || window.keys['KeyA']) this.player.targetX -= 14.0 * delta;
                if (window.keys['ArrowRight'] || window.keys['KeyD']) this.player.targetX += 14.0 * delta;
                this.player.targetX = Math.max(-7.0, Math.min(7.0, this.player.targetX));
            }

            this.player.update(delta, this.level);
            this.level.update(delta, this.player.pos.z);
            this.checkItemCollisions();

            this.camera.position.x = this.player.pos.x * 0.5;
            this.camera.position.y = Math.max(4.5, this.player.pos.y + 8.0);
            this.camera.position.z = this.player.pos.z + 5.5;
            this.camera.lookAt(
                this.player.pos.x * 0.5,
                Math.max(0, this.player.pos.y * 0.35),
                this.player.pos.z - 2.5
            );

            const farthestRow = this.getFarthestTileRow();
            const currentRow = Math.max(0, -this.player.pos.z / 2.0);
            const progressTarget = Math.max(1, farthestRow);
            const pct = Math.min(100, Math.floor((currentRow / progressTarget) * 100));

            document.getElementById('progress-fill').style.width = `${pct}%`;
            document.getElementById('progress-text').innerText = `${pct}%`;

            if (currentRow >= farthestRow + 0.3 && !this.player.isDead && !this.isLevelComplete) {
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
