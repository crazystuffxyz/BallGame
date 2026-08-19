// js/EditorController.js
import * as THREE from 'three';
import { computeEffectiveTempoBefore, tempoDirection, normalizeLevelData } from './Constants.js';
import { Storage } from './Storage.js';

export class EditorController {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.selectedCategory = 'tile';
        this.selectedVal = 1;
        this.selectedTempoValue = 15;
        this.selectedBgColor = '#ff0077';
        this.currentRow = 0;
        this.isPainting = false;
        this.lastPaintedKey = null;

        this.interactionMode = 'paint';

        this.isPanningTrack = false;
        this.panStartY = 0;
        this.panStartRow = 0;

        this._glassGroupCounter = 0;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoverIndicator = this.createHoverIndicator();
        this.hoverLane = null;
        this.hoverRow = null;
        this.game.scene.add(this.hoverIndicator);

        this.initUI();
        this.initDraggablePalette();
        this.initEvents();
        this.syncTopbarFields();
    }

    createHoverIndicator() {
        const geo = new THREE.BoxGeometry(2.0, 0.45, 2.0);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x00f2ff,
            wireframe: true
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        return mesh;
    }

    isEventOnUI(e) {
        if (!e || !e.target) return false;
        return !!e.target.closest('#editor-topbar, #editor-palette, #editor-bottombar, #hud-top, #game-overlay, #json-modal, button, select, input, textarea');
    }

    initDraggablePalette() {
        const palette = document.getElementById('editor-palette');
        const header = document.getElementById('palette-header');
        const minBtn = document.getElementById('palette-min-btn');
        const body = document.getElementById('palette-body');

        let isDragging = false;
        let startX, startY, initLeft, initTop;

        header.addEventListener('pointerdown', (e) => {
            if (e.target === minBtn) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = palette.getBoundingClientRect();
            initLeft = rect.left;
            initTop = rect.top;
            palette.setPointerCapture(e.pointerId);
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let newLeft = Math.max(0, Math.min(window.innerWidth - palette.offsetWidth, initLeft + dx));
            let newTop = Math.max(0, Math.min(window.innerHeight - palette.offsetHeight, initTop + dy));
            palette.style.left = `${newLeft}px`;
            palette.style.top = `${newTop}px`;
        });

        window.addEventListener('pointerup', () => {
            isDragging = false;
        });

        minBtn.onclick = (e) => {
            e.stopPropagation();
            body.classList.toggle('collapsed');
            minBtn.innerText = body.classList.contains('collapsed') ? '□' : '_';
        };
    }

    initUI() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const target = document.getElementById(btn.dataset.target);
                if (target) target.classList.add('active');
            };
        });

        document.querySelectorAll('.tool-btn[data-category]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.tool-btn[data-category]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedCategory = btn.dataset.category;
                this.selectedVal = parseInt(btn.dataset.val);
                this.updateTempoPreview();
            };
        });

        const slider = document.getElementById('row-slider');
        const onSliderInteraction = (e) => { e.stopPropagation(); this.scrollToRow(parseInt(e.target.value)); };
        slider.addEventListener('input', onSliderInteraction);
        slider.addEventListener('change', onSliderInteraction);
        slider.addEventListener('pointerdown', (e) => e.stopPropagation());

        document.getElementById('step-prev-10').onclick = (e) => { e.stopPropagation(); this.scrollToRow(this.currentRow - 10); };
        document.getElementById('step-prev-1').onclick = (e) => { e.stopPropagation(); this.scrollToRow(this.currentRow - 1); };
        document.getElementById('step-next-1').onclick = (e) => { e.stopPropagation(); this.scrollToRow(this.currentRow + 1); };
        document.getElementById('step-next-10').onclick = (e) => { e.stopPropagation(); this.scrollToRow(this.currentRow + 10); };

        const playFromStart = () => this.game.startPlay(0);
        document.getElementById('ed-play-btn').onclick = playFromStart;
        document.getElementById('ed-play-start-btn').onclick = playFromStart;
        document.getElementById('ed-play-btn-mob').onclick = playFromStart;
        document.getElementById('ed-play-start-btn-mob').onclick = playFromStart;

        document.getElementById('preset-select').onchange = (e) => this.game.loadPreset(e.target.value);
        document.getElementById('theme-select').onchange = (e) => this.game.setTheme(e.target.value);

        const levelBgPicker = document.getElementById('level-bg-picker');
        if (levelBgPicker) {
            levelBgPicker.addEventListener('input', (e) => {
                this.game.setCustomBackgroundColor(e.target.value);
            });
        }

        const bgTileColorInput = document.getElementById('bg-tile-color-input');
        if (bgTileColorInput) {
            bgTileColorInput.addEventListener('input', (e) => {
                this.selectedBgColor = e.target.value;
            });
        }

        const tileFillPicker = document.getElementById('tile-fill-picker');
        if (tileFillPicker) {
            tileFillPicker.addEventListener('input', (e) => {
                this.game.level.applyCustomTileColors(e.target.value, null);
                this.game.level.rebuildMeshes();
            });
        }

        const tileBorderPicker = document.getElementById('tile-border-picker');
        if (tileBorderPicker) {
            tileBorderPicker.addEventListener('input', (e) => {
                this.game.level.applyCustomTileColors(null, e.target.value);
                this.game.level.rebuildMeshes();
            });
        }

        document.getElementById('ed-save-btn').onclick = () => this.save();
        document.getElementById('ed-json-btn').onclick = () => this.openJsonModal();
        document.getElementById('ed-clear-btn').onclick = () => this.clearAll();
        document.getElementById('ed-fill-row-btn').onclick = () => this.fillCurrentRow();
        document.getElementById('ed-clear-row-btn').onclick = () => this.clearCurrentRow();
        document.getElementById('ed-add-10rows-btn').onclick = () => this.add10Rows();
        document.getElementById('ed-dup-row-btn').onclick = () => this.duplicateRowAhead();
        document.getElementById('ed-exit-btn').onclick = () => this.game.setMode('play');

        const baseTempoInput = document.getElementById('base-tempo-input');
        if (baseTempoInput) {
            baseTempoInput.addEventListener('change', (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = 11;
                val = Math.max(2, Math.min(40, val));
                e.target.value = val;
                this.game.levelData.baseTempo = val;
                this.game.level.rebuildMeshes();
                this.updateTempoPreview();
            });
        }

        const tempoValueInput = document.getElementById('tempo-value-input');
        if (tempoValueInput) {
            tempoValueInput.addEventListener('input', () => this.updateTempoPreview());
        }

        const modeToggleBtn = document.getElementById('ed-mode-toggle');
        modeToggleBtn.onclick = (e) => {
            e.stopPropagation();
            this.interactionMode = this.interactionMode === 'paint' ? 'pan' : 'paint';
            if (this.interactionMode === 'paint') {
                modeToggleBtn.innerHTML = '🖌️ Paint Mode';
                modeToggleBtn.className = 'hud-btn primary';
            } else {
                modeToggleBtn.innerHTML = '✋ Pan Mode';
                modeToggleBtn.className = 'hud-btn';
            }
        };
    }

    initEvents() {
        const updatePointerCoords = (clientX, clientY) => {
            this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
            this.updateHover();
        };

        window.addEventListener('pointerdown', (e) => {
            if (!this.active || this.isEventOnUI(e)) return;

            if (e.button === 2 || e.button === 1 || this.interactionMode === 'pan') {
                this.isPanningTrack = true;
                this.panStartY = e.clientY;
                this.panStartRow = this.currentRow;
                return;
            }

            if (e.button === 0 && this.interactionMode === 'paint') {
                this.isPainting = true;
                updatePointerCoords(e.clientX, e.clientY);
                if (this.hoverRow !== null && this.hoverLane !== null) {
                    this.lastPaintedKey = `${this.hoverRow},${this.hoverLane}`;
                    this.paintAtHover(false);
                }
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (!this.active) return;

            if (this.isPanningTrack) {
                const dy = e.clientY - this.panStartY;
                const rowDelta = Math.round(dy / 15);
                this.scrollToRow(this.panStartRow + rowDelta);
                return;
            }

            if (this.isEventOnUI(e)) {
                this.hoverIndicator.visible = false;
                return;
            }

            updatePointerCoords(e.clientX, e.clientY);

            if (this.isPainting && this.hoverRow !== null && this.hoverLane !== null) {
                const currentKey = `${this.hoverRow},${this.hoverLane}`;
                if (currentKey !== this.lastPaintedKey) {
                    this.lastPaintedKey = currentKey;
                    this.paintAtHover(false);
                }
            }
        });

        window.addEventListener('pointerup', () => {
            this.isPainting = false;
            this.isPanningTrack = false;
            this.lastPaintedKey = null;
        });

        window.addEventListener('contextmenu', (e) => {
            if (this.active && !this.isEventOnUI(e)) {
                e.preventDefault();
            }
        });

        window.addEventListener('wheel', (e) => {
            if (!this.active || this.isEventOnUI(e)) return;
            e.preventDefault();
            const delta = Math.sign(e.deltaY) * (e.shiftKey ? 5 : 1);
            this.scrollToRow(this.currentRow + delta);
        }, { passive: false });

        window.addEventListener('keydown', (e) => {
            if (!this.active) return;
            if (e.code === 'KeyW' || e.code === 'ArrowUp') this.scrollToRow(this.currentRow + 1);
            if (e.code === 'KeyS' || e.code === 'ArrowDown') this.scrollToRow(this.currentRow - 1);
            if (e.code === 'PageUp') this.scrollToRow(this.currentRow + 10);
            if (e.code === 'PageDown') this.scrollToRow(this.currentRow - 10);
            if (e.code === 'Backspace' || e.code === 'Delete') {
                const activeTag = document.activeElement ? document.activeElement.tagName : '';
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
                e.preventDefault();
                this.deleteAtHover();
            }
        });
    }

    toggle(active) {
        this.active = active;
        this.hoverIndicator.visible = active;
        document.getElementById('editor-panel').classList.toggle('hidden', !active);

        if (active) {
            this.updateScrubber();
            this.scrollToRow(this.currentRow);
            this.syncTopbarFields();
        }
    }

    scrollToRow(r) {
        const rows = this.game.levelData?.rows || [];
        const maxRow = Math.max(0, rows.length - 1);

        this.currentRow = Math.max(0, Math.min(maxRow, Number(r) || 0));

        const slider = document.getElementById('row-slider');
        const display = document.getElementById('row-display');

        if (slider) slider.value = String(this.currentRow);
        if (display) display.innerText = `Row: ${this.currentRow}/${maxRow}`;

        this.updateTempoPreview();

        const z = -this.currentRow * 2.0;
        this.game.camera.position.set(0, 8.0, z + 5.5);
        this.game.camera.lookAt(0, 0, z - 2.5);
    }

    updateHover() {
        this.raycaster.setFromCamera(this.mouse, this.game.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        const hit = this.raycaster.ray.intersectPlane(plane, target);

        if (hit) {
            const lane = Math.round(target.x / 2.0);
            const row = Math.round(-target.z / 2.0);

            if (lane >= -3 && lane <= 3 && row >= 0 && row < this.game.levelData.rows.length) {
                this.hoverIndicator.visible = true;
                this.hoverIndicator.position.set(lane * 2.0, 0, -row * 2.0);
                this.hoverLane = lane + 3;
                this.hoverRow = row;
                this.updateTempoPreview();
                return;
            }
        }
        this.hoverIndicator.visible = false;
        this.hoverLane = null;
        this.hoverRow = null;
    }

    paintAtHover(isErase = false) {
        if (this.hoverLane === null || this.hoverRow === null) return;
        const levelRows = this.game.level.levelData.rows;
        const row = levelRows[this.hoverRow];
        if (!row) return;
        if (!row.obstacles) row.obstacles = [0, 0, 0, 0, 0, 0, 0];
        if (!row.tileTempo) row.tileTempo = [0, 0, 0, 0, 0, 0, 0];
        if (!row.tileBgColor) row.tileBgColor = ['', '', '', '', '', '', ''];
        if (!row.tileGlassGroup) row.tileGlassGroup = ['', '', '', '', '', '', ''];

        if (this.selectedCategory === 'tile') {
            if (this.selectedVal === 4 && !isErase) {
                const gw = parseInt(document.getElementById('glass-w-input')?.value || 1);
                const gd = parseInt(document.getElementById('glass-d-input')?.value || 1);
                // Assign a unique group ID to the entire painted area so it renders as
                // exactly one slab matching the user's chosen dimensions.
                const gid = 'g' + (++this._glassGroupCounter);
                for (let dr = 0; dr < gd; dr++) {
                    const r = this.hoverRow + dr;
                    if (r >= levelRows.length) break;
                    const targetRow = levelRows[r];
                    if (!targetRow.tileTempo) targetRow.tileTempo = [0, 0, 0, 0, 0, 0, 0];
                    if (!targetRow.tileGlassGroup) targetRow.tileGlassGroup = ['', '', '', '', '', '', ''];
                    for (let dc = 0; dc < gw; dc++) {
                        const c = this.hoverLane + dc;
                        if (c >= 7) break;
                        targetRow.tiles[c] = 4;
                        targetRow.tileTempo[c] = 0;
                        targetRow.tileGlassGroup[c] = gid;
                    }
                }
            } else {
                const val = isErase ? 0 : this.selectedVal;
                row.tiles[this.hoverLane] = val;
                // Always clear the glass group for this cell when painting any non-glass tile.
                row.tileGlassGroup[this.hoverLane] = '';
                if (val === 8 && !isErase) {
                    row.tileTempo[this.hoverLane] = this.selectedTempoValue;
                } else if (val === 9 && !isErase) {
                    const colorInput = document.getElementById('bg-tile-color-input');
                    row.tileBgColor[this.hoverLane] = colorInput ? colorInput.value : this.selectedBgColor;
                } else {
                    row.tileTempo[this.hoverLane] = 0;
                    row.tileBgColor[this.hoverLane] = '';
                }
            }
        } else if (this.selectedCategory === 'obstacle') {
            row.obstacles[this.hoverLane] = isErase ? 0 : this.selectedVal;
        }
        this.game.level.rebuildMeshes();
        this.game.countCollectibles();
    }

    deleteAtHover() {
        if (this.hoverLane === null || this.hoverRow === null) return;
        const levelRows = this.game.level.levelData.rows;
        const row = levelRows[this.hoverRow];
        if (!row) return;
        row.tiles[this.hoverLane] = 0;
        if (!row.obstacles) row.obstacles = [0, 0, 0, 0, 0, 0, 0];
        row.obstacles[this.hoverLane] = 0;
        if (!row.tileTempo) row.tileTempo = [0, 0, 0, 0, 0, 0, 0];
        row.tileTempo[this.hoverLane] = 0;
        if (!row.tileBgColor) row.tileBgColor = ['', '', '', '', '', '', ''];
        row.tileBgColor[this.hoverLane] = '';
        if (!row.tileGlassGroup) row.tileGlassGroup = ['', '', '', '', '', '', ''];
        row.tileGlassGroup[this.hoverLane] = '';
        this.game.level.rebuildMeshes();
        this.game.countCollectibles();
        this.updateTempoPreview();
    }

    updateTempoPreview() {
        const input = document.getElementById('tempo-value-input');
        const icon = document.getElementById('tempo-preview-icon');
        const text = document.getElementById('tempo-preview-text');
        if (!input || !icon || !text) return;
        let val = parseFloat(input.value);
        if (isNaN(val)) val = 15;
        val = Math.max(2, Math.min(40, val));
        this.selectedTempoValue = val;

        const refRow = (this.hoverRow !== null && this.hoverRow !== undefined) ? this.hoverRow : this.currentRow;
        const baseTempo = (this.game.levelData && this.game.levelData.baseTempo) || 11;
        const prev = computeEffectiveTempoBefore(this.game.levelData.rows, baseTempo, refRow);
        const dir = tempoDirection(val, prev);

        if (dir === 'up') {
            icon.textContent = '▶▶';
            icon.style.color = '#00ff88';
            text.textContent = `Speed UP: ${prev.toFixed(1)} → ${val.toFixed(1)} sq/s`;
        } else if (dir === 'down') {
            icon.textContent = '◀◀';
            icon.style.color = '#ff5577';
            text.textContent = `Slow DOWN: ${prev.toFixed(1)} → ${val.toFixed(1)} sq/s`;
        } else {
            icon.textContent = '➖';
            icon.style.color = '#aabbcc';
            text.textContent = `Same tempo: ${val.toFixed(1)} sq/s`;
        }
    }

    fillCurrentRow() {
        const levelRows = this.game.level.levelData.rows;
        const row = levelRows[this.currentRow];
        if (row) {
            row.tiles = [1, 1, 1, 1, 1, 1, 1];
            row.tileTempo = [0, 0, 0, 0, 0, 0, 0];
            row.tileBgColor = ['', '', '', '', '', '', ''];
            row.tileGlassGroup = ['', '', '', '', '', '', ''];
            this.game.level.rebuildMeshes();
        }
    }

    clearCurrentRow() {
        const levelRows = this.game.level.levelData.rows;
        const row = levelRows[this.currentRow];
        if (row) {
            row.tiles = [0, 0, 0, 0, 0, 0, 0];
            row.obstacles = [0, 0, 0, 0, 0, 0, 0];
            row.tileTempo = [0, 0, 0, 0, 0, 0, 0];
            row.tileBgColor = ['', '', '', '', '', '', ''];
            row.tileGlassGroup = ['', '', '', '', '', '', ''];
            this.game.level.rebuildMeshes();
            this.game.countCollectibles();
        }
    }

    duplicateRowAhead() {
        const levelRows = this.game.level.levelData.rows;
        const cur = levelRows[this.currentRow];
        const nextRow = this.currentRow + 1;
        if (cur && nextRow < levelRows.length) {
            levelRows[nextRow] = JSON.parse(JSON.stringify(cur));
            this.game.level.rebuildMeshes();
            this.game.countCollectibles();
            this.scrollToRow(nextRow);
        }
    }

    add10Rows() {
        const levelRows = this.game.level.levelData.rows;
        for (let i = 0; i < 10; i++) {
            levelRows.push({
                tiles: [1, 1, 1, 1, 1, 1, 1],
                obstacles: [0, 0, 0, 0, 0, 0, 0],
                tileTempo: [0, 0, 0, 0, 0, 0, 0],
                tileBgColor: ['', '', '', '', '', '', ''],
                tileGlassGroup: ['', '', '', '', '', '', '']
            });
        }
        this.updateScrubber();
        this.game.level.rebuildMeshes();
    }

    clearAll() {
        if (confirm("Clear all tiles and obstacles in this level?")) {
            for (let r of this.game.level.levelData.rows) {
                r.tiles = [0, 0, 0, 0, 0, 0, 0];
                r.obstacles = [0, 0, 0, 0, 0, 0, 0];
                r.tileTempo = [0, 0, 0, 0, 0, 0, 0];
                r.tileBgColor = ['', '', '', '', '', '', ''];
                r.tileGlassGroup = ['', '', '', '', '', '', ''];
            }
            this.game.level.rebuildMeshes();
            this.game.countCollectibles();
        }
    }

    updateScrubber() {
        const rows = this.game.levelData?.rows || [];
        const maxRow = Math.max(0, rows.length - 1);

        this.currentRow = Math.max(0, Math.min(this.currentRow, maxRow));

        const slider = document.getElementById('row-slider');
        if (slider) {
            slider.min = '0';
            slider.max = String(maxRow);
            slider.value = String(this.currentRow);
        }

        const display = document.getElementById('row-display');
        if (display) {
            display.innerText = `Row: ${this.currentRow}/${maxRow}`;
        }
    }

    syncTopbarFields() {
        const baseTempoInput = document.getElementById('base-tempo-input');
        if (baseTempoInput && this.game.levelData) {
            baseTempoInput.value = this.game.levelData.baseTempo || 11;
        }
        const levelBgPicker = document.getElementById('level-bg-picker');
        if (levelBgPicker && this.game.levelData?.customBgColor) {
            levelBgPicker.value = this.game.levelData.customBgColor;
        }
        const tileFillPicker = document.getElementById('tile-fill-picker');
        if (tileFillPicker && this.game.levelData?.tileMainColor) {
            tileFillPicker.value = this.game.levelData.tileMainColor;
        }
        const tileBorderPicker = document.getElementById('tile-border-picker');
        if (tileBorderPicker && this.game.levelData?.tileBorderColor) {
            tileBorderPicker.value = this.game.levelData.tileBorderColor;
        }
        this.updateTempoPreview();
    }

    save() {
        Storage.save(this.game.level.levelData);
        alert("Level saved successfully to browser storage!");
    }

    openJsonModal() {
        const modal = document.getElementById('json-modal');
        const textarea = document.getElementById('json-textarea');
        textarea.value = JSON.stringify(this.game.level.levelData, null, 2);
        modal.classList.add('active');

        document.getElementById('json-copy-btn').onclick = async () => {
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(textarea.value);
                } else {
                    textarea.select();
                    document.execCommand('copy');
                    textarea.setSelectionRange(0, 0);
                }
                alert('JSON copied to clipboard!');
            } catch (error) {
                alert('Unable to copy automatically. Please copy the text manually.');
            }
        };

        document.getElementById('json-load-btn').onclick = () => {
            try {
                const parsed = JSON.parse(textarea.value);
                if (parsed && Array.isArray(parsed.rows)) {
                    this.game.level.loadLevel(parsed);
                    this.game.levelData = this.game.level.levelData;
                    this.updateScrubber();
                    this.syncTopbarFields();
                    this.game.countCollectibles();
                    modal.classList.remove('active');
                } else {
                    alert("Invalid level JSON: missing 'rows' array!");
                }
            } catch(e) { alert("Invalid JSON format!"); }
        };

        document.getElementById('json-close-btn').onclick = () => {
            modal.classList.remove('active');
        };
    }
}
