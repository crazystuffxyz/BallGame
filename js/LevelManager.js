// js/LevelManager.js
import * as THREE from 'three';
import { TextureGen } from './TextureGen.js';
import { THEMES, computeEffectiveTempoBefore, tempoDirection, normalizeLevelData } from './Constants.js';

export class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.gridGroup = new THREE.Group();
        this.obstacleGroup = new THREE.Group();
        this.editorGridGroup = new THREE.Group();

        this.scene.add(this.gridGroup);
        this.scene.add(this.obstacleGroup);
        this.scene.add(this.editorGridGroup);

        this.themeKey = 'sky';
        this.materials = {};
        this.geometries = {};
        this.fadeOpacity = 0.8;

        this._tempoMaterials = [];
        this._glassTextures = [];

        this.initAssets();

        this.levelData = null;
        this.glassSlabs = [];
        this.animatedObs = [];
        this.popBricks = [];
    }

    initAssets() {
        this.geometries.tile = new THREE.BoxGeometry(2.0, 0.4, 2.0);
        this.geometries.ball = new THREE.SphereGeometry(0.78, 32, 32);
        this.geometries.pyramid = new THREE.ConeGeometry(0.8, 1.8, 4);
        this.geometries.trunk = new THREE.CylinderGeometry(0.2, 0.3, 0.8, 8);
        this.geometries.foliage = new THREE.ConeGeometry(0.9, 1.6, 6);
        this.geometries.laserPole = new THREE.CylinderGeometry(0.1, 0.1, 2.5, 8);
        this.geometries.laserBeam = new THREE.CylinderGeometry(0.08, 0.08, 2.0, 8);
        this.geometries.hammerHead = new THREE.BoxGeometry(1.6, 0.8, 0.8);
        this.geometries.gem = new THREE.OctahedronGeometry(0.45, 0);
        this.geometries.crown = new THREE.CylinderGeometry(0.5, 0.3, 0.4, 5, 1, true);

        this.geometries.wall = new THREE.BoxGeometry(1.8, 8.0, 1.8);
        this.geometries.overheadWall = new THREE.BoxGeometry(1.8, 6.0, 1.8);
        this.geometries.borderCell = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.0, 0.05, 2.0));

        this.geometries.brick = new THREE.BoxGeometry(1.0, 1.0, 1.0);
        this.geometries.brickPad = new THREE.BoxGeometry(1.4, 0.06, 1.4);

        this.materials.borderCell = new THREE.LineBasicMaterial({
            color: 0x00f2ff,
            transparent: true,
            opacity: 0.18
        });

        this.updateThemeMaterials('sky');
    }

    updateThemeMaterials(themeKey) {
        this.themeKey = themeKey;
        const theme = THEMES[themeKey] || THEMES.sky;

        const customMain = (this.levelData && this.levelData.tileMainColor) ? this.levelData.tileMainColor : theme.tileColors.main;
        const customBorder = (this.levelData && this.levelData.tileBorderColor) ? this.levelData.tileBorderColor : theme.tileColors.border;

        const floorTex = TextureGen.createTileTexture(customMain, theme.tileColors.sub, customBorder);
        floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;

        this.materials.floor = new THREE.MeshStandardMaterial({
            map: floorTex,
            roughness: 0.3,
            metalness: 0.2
        });
        this.materials.jump = new THREE.MeshStandardMaterial({
            map: TextureGen.createJumpTexture('#ff0055', '#ffffff'),
            emissive: 0xff0055,
            emissiveIntensity: 0.6
        });
        this.materials.bigJump = new THREE.MeshStandardMaterial({
            map: TextureGen.createJumpTexture('#ffaa00', '#ffffff'),
            emissive: 0xffaa00,
            emissiveIntensity: 0.8
        });
        this.materials.speedUp = new THREE.MeshStandardMaterial({
            map: TextureGen.createSpeedTexture('#00ff88', '#ffffff'),
            emissive: 0x00ff88,
            emissiveIntensity: 0.5
        });
        this.materials.speedDown = new THREE.MeshStandardMaterial({
            map: TextureGen.createSpeedTexture('#ff2200', '#ffffff'),
            emissive: 0xff2200,
            emissiveIntensity: 0.5
        });
        this.materials.fadeTile = new THREE.MeshStandardMaterial({
            color: theme.accent,
            emissive: theme.accent,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.8
        });

        this.materials.pyramid = new THREE.MeshStandardMaterial({
            color: theme.accent,
            emissive: theme.accent,
            emissiveIntensity: 0.4,
            roughness: 0.2
        });
        this.materials.treeFoliage = new THREE.MeshStandardMaterial({ color: 0x117733, roughness: 0.8 });
        this.materials.treeTrunk = new THREE.MeshStandardMaterial({ color: 0x553311 });
        this.materials.laser = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
        this.materials.hammer = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.8, roughness: 0.3 });
        this.materials.gem = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.8,
            roughness: 0.1,
            metalness: 0.9
        });
        this.materials.crown = new THREE.MeshStandardMaterial({
            color: 0xffbb00,
            emissive: 0xff8800,
            emissiveIntensity: 0.7,
            metalness: 0.8,
            roughness: 0.2,
            side: THREE.DoubleSide
        });

        this.materials.wall = new THREE.MeshStandardMaterial({
            color: new THREE.Color(customMain),
            emissive: new THREE.Color(customBorder),
            emissiveIntensity: 0.15,
            metalness: 0.5,
            roughness: 0.3,
            transparent: true,
            opacity: 0.88
        });
        this.materials.overheadWall = new THREE.MeshStandardMaterial({
            color: new THREE.Color(theme.tileColors.sub),
            emissive: new THREE.Color(customBorder),
            emissiveIntensity: 0.15,
            metalness: 0.5,
            roughness: 0.35,
            transparent: true,
            opacity: 0.88
        });
        this.materials.overheadUnder = new THREE.MeshBasicMaterial({
            color: 0xff0066,
            transparent: true,
            opacity: 0.5
        });

        this.materials.brick = new THREE.MeshStandardMaterial({
            color: 0xbd4622,
            roughness: 0.5,
            metalness: 0.1
        });
        this.materials.brickPad = new THREE.MeshStandardMaterial({
            color: 0x3a221a,
            roughness: 0.7,
            metalness: 0.3
        });
    }

    applyCustomTileColors(mainColor, borderColor) {
        const theme = THEMES[this.themeKey] || THEMES.sky;
        const main = mainColor || (this.levelData && this.levelData.tileMainColor) || theme.tileColors.main;
        const border = borderColor || (this.levelData && this.levelData.tileBorderColor) || theme.tileColors.border;

        if (this.levelData) {
            if (mainColor) this.levelData.tileMainColor = mainColor;
            if (borderColor) this.levelData.tileBorderColor = borderColor;
        }

        const floorTex = TextureGen.createTileTexture(main, theme.tileColors.sub, border);
        floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
        if (this.materials.floor && this.materials.floor.map) {
            this.materials.floor.map.dispose();
        }
        if (this.materials.floor) {
            this.materials.floor.map = floorTex;
            this.materials.floor.needsUpdate = true;
        }

        if (this.materials.wall) {
            this.materials.wall.color.set(new THREE.Color(main));
            this.materials.wall.emissive.set(new THREE.Color(border));
            this.materials.wall.needsUpdate = true;
        }
        if (this.materials.overheadWall) {
            this.materials.overheadWall.emissive.set(new THREE.Color(border));
            this.materials.overheadWall.needsUpdate = true;
        }
    }

    createTempoTileMaterial(direction, value) {
        const tex = TextureGen.createTempoTexture(direction, value);
        const emissiveColor = direction === 'up' ? 0x00cc66 : direction === 'down' ? 0xcc0044 : 0x6677aa;
        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            emissive: emissiveColor,
            emissiveIntensity: 0.55,
            roughness: 0.3
        });
        this._tempoMaterials.push(mat);
        return mat;
    }

    createGlassSlabMaterial(w, d) {
        const cv = document.createElement('canvas');
        cv.width = Math.max(64, Math.round(w * 32));
        cv.height = Math.max(64, Math.round(d * 32));
        const ctx = cv.getContext('2d');
        ctx.fillStyle = 'rgba(180, 230, 255, 0.45)';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(3, 3, cv.width - 6, cv.height - 6);

        const tex = new THREE.CanvasTexture(cv);
        this._glassTextures.push(tex);
        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            transparent: true,
            opacity: 0.75,
            roughness: 0.1
        });
        this._tempoMaterials.push(mat);
        return mat;
    }

    _disposeRebuildResources() {
        for (const mat of this._tempoMaterials) {
            if (mat.map) mat.map.dispose();
            mat.dispose();
        }
        this._tempoMaterials = [];
        for (const tex of this._glassTextures) {
            tex.dispose();
        }
        this._glassTextures = [];
    }

    loadLevel(levelData) {
        this.levelData = normalizeLevelData(levelData);
        this.updateThemeMaterials(this.levelData.theme || 'sky');
        this.rebuildMeshes();
    }

    rebuildMeshes() {
        this._disposeRebuildResources();

        while (this.gridGroup.children.length > 0) {
            this.gridGroup.remove(this.gridGroup.children[0]);
        }
        while (this.obstacleGroup.children.length > 0) {
            this.obstacleGroup.remove(this.obstacleGroup.children[0]);
        }
        while (this.editorGridGroup.children.length > 0) {
            this.editorGridGroup.remove(this.editorGridGroup.children[0]);
        }
        this.animatedObs = [];
        this.popBricks = [];
        this.glassSlabs = [];

        if (!this.levelData || !this.levelData.rows) return;

        const TILE_W = 2.0;
        const TILE_D = 2.0;
        const baseTempo = this.levelData.baseTempo || 11;

        // Phase 1: collect all glass cells grouped by their stored group ID.
        // Cells without a group ID (old data) each get their own unique fallback group.
        const glassGroups = new Map();
        for (let r = 0; r < this.levelData.rows.length; r++) {
            const row = this.levelData.rows[r];
            if (!row || !row.tiles) continue;
            for (let c = 0; c < 7; c++) {
                if (row.tiles[c] !== 4) continue;
                const storedId = (row.tileGlassGroup && row.tileGlassGroup[c]) ? row.tileGlassGroup[c] : null;
                const gid = storedId || `__auto_${r}_${c}`;
                if (!glassGroups.has(gid)) glassGroups.set(gid, []);
                glassGroups.get(gid).push({ r, c });
            }
        }

        // Phase 2: build one slab mesh per group using the bounding box of its cells.
        const visitedGlass = new Set();
        for (const [, cells] of glassGroups) {
            let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
            for (const { r, c } of cells) {
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
                visitedGlass.add(`${r},${c}`);
            }

            const gw = maxC - minC + 1;
            const gd = maxR - minR + 1;

            const centerX = (minC - 3) * TILE_W + ((gw - 1) * TILE_W) / 2;
            const centerZ = -minR * TILE_D - ((gd - 1) * TILE_D) / 2;

            const slabGeo = new THREE.BoxGeometry(gw * TILE_W, 0.4, gd * TILE_D);
            const slabMat = this.createGlassSlabMaterial(gw, gd);
            const slabMesh = new THREE.Mesh(slabGeo, slabMat);
            slabMesh.position.set(centerX, -0.2, centerZ);
            slabMesh.receiveShadow = true;

            const slabData = {
                mesh: slabMesh,
                startRow: minR,
                startCol: minC,
                width: gw,
                depth: gd,
                minX: centerX - (gw * TILE_W) / 2,
                maxX: centerX + (gw * TILE_W) / 2,
                minZ: centerZ - (gd * TILE_D) / 2,
                maxZ: centerZ + (gd * TILE_D) / 2,
                triggered: false,
                entryZ: null,
                isSolid: true
            };

            slabMesh.userData = slabData;
            this.glassSlabs.push(slabData);
            this.gridGroup.add(slabMesh);
        }

        // Phase 3: regular tile and obstacle loop, skipping glass cells already handled.
        for (let r = 0; r < this.levelData.rows.length; r++) {
            const row = this.levelData.rows[r];
            if (!row.tileTempo) row.tileTempo = [0, 0, 0, 0, 0, 0, 0];
            if (!row.obstacles) row.obstacles = [0, 0, 0, 0, 0, 0, 0];
            const z = -r * TILE_D;

            for (let c = 0; c < 7; c++) {
                const lane = c - 3;
                const x = lane * TILE_W;
                const tileType = row.tiles[c];
                const obsType = row.obstacles ? row.obstacles[c] : 0;

                if (visitedGlass.has(`${r},${c}`)) {
                    // Glass slab already built in Phase 2; still place obstacles if any.
                    if (obsType > 0) {
                        const obsObj = this.createObstacleObject(obsType, x, z, r, c);
                        if (obsObj) this.obstacleGroup.add(obsObj);
                    }
                    continue;
                }

                if (tileType > 0) {
                    let mat = this.materials.floor;
                    if (tileType === 2) mat = this.materials.jump;
                    else if (tileType === 3) mat = this.materials.bigJump;
                    else if (tileType === 5) mat = this.materials.speedUp;
                    else if (tileType === 6) mat = this.materials.speedDown;
                    else if (tileType === 7) mat = this.materials.fadeTile;
                    else if (tileType === 8) {
                        const val = row.tileTempo[c] || baseTempo;
                        const prev = computeEffectiveTempoBefore(this.levelData.rows, baseTempo, r);
                        const dir = tempoDirection(val, prev);
                        mat = this.createTempoTileMaterial(dir, val);
                    }

                    const mesh = new THREE.Mesh(this.geometries.tile, mat);
                    mesh.position.set(x, -0.2, z);
                    mesh.receiveShadow = true;
                    mesh.userData = { row: r, lane: c, tileType: tileType, origY: -0.2 };
                    this.gridGroup.add(mesh);
                } else {
                    const borderMesh = new THREE.LineSegments(this.geometries.borderCell, this.materials.borderCell);
                    borderMesh.position.set(x, -0.2, z);
                    this.editorGridGroup.add(borderMesh);
                }

                if (obsType > 0) {
                    const obsObj = this.createObstacleObject(obsType, x, z, r, c);
                    if (obsObj) this.obstacleGroup.add(obsObj);
                }
            }
        }
    }

    createObstacleObject(type, x, z, row, lane) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.userData = { type, row, lane, collected: false };

        if (type === 1) {
            const trunk = new THREE.Mesh(this.geometries.trunk, this.materials.treeTrunk);
            trunk.position.y = 0.4;
            const foliage = new THREE.Mesh(this.geometries.foliage, this.materials.treeFoliage);
            foliage.position.y = 1.4;
            group.add(trunk, foliage);
            group.userData.isTree = true;
        } else if (type === 2) {
            const pyr = new THREE.Mesh(this.geometries.pyramid, this.materials.pyramid);
            pyr.position.y = 0.9;
            pyr.rotation.y = Math.PI / 4;
            group.add(pyr);
            group.userData.isPyramid = true;
            group.userData.halfBase = 0.8;
            group.userData.height = 1.8;
        } else if (type === 3) {
            const poleL = new THREE.Mesh(this.geometries.laserPole, this.materials.hammer);
            poleL.position.set(-0.9, 1.25, 0);
            const poleR = new THREE.Mesh(this.geometries.laserPole, this.materials.hammer);
            poleR.position.set(0.9, 1.25, 0);
            const beam = new THREE.Mesh(this.geometries.laserBeam, this.materials.laser);
            beam.rotation.z = Math.PI / 2;
            beam.position.set(0, 1.2, 0);
            group.add(poleL, poleR, beam);
            group.userData.isLaser = true;
        } else if (type === 4) {
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5), this.materials.hammer);
            stem.position.y = 1.5;
            const head = new THREE.Mesh(this.geometries.hammerHead, this.materials.hammer);
            head.position.y = 2.7;
            group.add(stem, head);
            group.userData.isHammer = true;
            this.animatedObs.push({ obj: group, type: 'hammer', speed: 2.5, phase: row * 0.5 });
        } else if (type === 5) {
            const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.0, 1.6), this.materials.pyramid);
            block.position.y = 1.0;
            group.add(block);
            group.userData.isBox = true;
            group.userData.halfX = 0.8;
            group.userData.minY = 0.0;
            group.userData.maxY = 2.0;
            group.userData.halfZ = 0.8;
        } else if (type === 6) {
            const gem = new THREE.Mesh(this.geometries.gem, this.materials.gem);
            gem.position.y = 0.75;
            group.add(gem);
            group.userData.isItem = true;
            group.userData.hitRadius = 0.8;
            this.animatedObs.push({ obj: group, type: 'spin', speed: 3.0 });
        } else if (type === 7) {
            const crown = new THREE.Mesh(this.geometries.crown, this.materials.crown);
            crown.position.y = 0.75;
            group.add(crown);
            group.userData.isItem = true;
            group.userData.isCrown = true;
            group.userData.hitRadius = 0.9;
            this.animatedObs.push({ obj: group, type: 'spin', speed: 2.0 });
        } else if (type === 8) {
            const wall = new THREE.Mesh(this.geometries.wall, this.materials.wall);
            wall.position.y = 4.0;
            group.add(wall);
            group.userData.isBox = true;
            group.userData.halfX = 0.9;
            group.userData.minY = 0.0;
            group.userData.maxY = 8.0;
            group.userData.halfZ = 0.9;
        } else if (type === 9) {
            const overhead = new THREE.Mesh(this.geometries.overheadWall, this.materials.overheadWall);
            overhead.position.y = 5.0;
            const bottomPlate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.8), this.materials.overheadUnder);
            bottomPlate.position.y = 2.0;
            group.add(overhead, bottomPlate);
            group.userData.isBox = true;
            group.userData.halfX = 0.9;
            group.userData.minY = 1.95;
            group.userData.maxY = 8.0;
            group.userData.halfZ = 0.9;
        } else if (type === 10) {
            const pad = new THREE.Mesh(this.geometries.brickPad, this.materials.brickPad);
            pad.position.y = 0.03;
            const brick = new THREE.Mesh(this.geometries.brick, this.materials.brick);
            brick.position.y = -0.5;
            group.add(pad, brick);

            const brickData = {
                group: group,
                brickMesh: brick,
                zPos: z,
                currentY: -0.5,
                targetY: -0.5,
                popped: false
            };
            group.userData.isBrick = true;
            group.userData.brickData = brickData;
            this.popBricks.push(brickData);
        }
        return group;
    }

    update(delta, playerZ) {
        const time = performance.now() * 0.001;

        for (let item of this.animatedObs) {
            if (item.type === 'spin') {
                item.obj.rotation.y += item.speed * delta;
                item.obj.position.y = Math.sin(time * 3 + item.obj.position.z) * 0.15;
            } else if (item.type === 'hammer') {
                item.obj.rotation.z = Math.sin(time * item.speed + item.phase) * 0.8;
            }
        }

        for (let b of this.popBricks) {
            const distanceToPlayer = playerZ - b.zPos;
            if (distanceToPlayer >= -8.0) {
                b.targetY = 0.5;
            }
            if (b.currentY < b.targetY) {
                b.currentY = Math.min(b.targetY, b.currentY + delta * 8.0);
                b.brickMesh.position.y = b.currentY;
            }
        }

        for (let slab of this.glassSlabs) {
            if (!slab.isSolid) {
                slab.mesh.position.y -= delta * 18.0;
                slab.mesh.rotation.x += delta * 3.0;
            }
        }

        const fadeVal = (Math.sin(time * 4) + 1) / 2;
        this.fadeOpacity = fadeVal > 0.4 ? 0.9 : 0.1;
        this.materials.fadeTile.opacity = this.fadeOpacity;
    }
}
