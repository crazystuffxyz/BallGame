// js/Player.js
import * as THREE from 'three';

export class Player {
    constructor(scene, sound) {
        this.scene = scene;
        this.sound = sound;

        // Base Dimensions & Hitboxes
        this.radius = 0.78;
        this.hazardRadius = this.radius * 1.1;           // 0.858 for obstacle collisions
        this.groundRadius = this.radius * 0.85;          // 0.663 for solid ground contact

        this.pos = new THREE.Vector3(0, this.radius, 0);
        this.velY = 0;
        this.isGrounded = true;
        this.isJumping = false;
        this.isFallingIntoVoid = false;
        this.isDead = false;
        this.speedSqS = 11;

        // Debounce lock for speed/tempo tiles
        this.lastTileEffectKey = null;

        // Lateral velocity controller
        this.targetX = 0;
        this.velX = 0;

        // Physics-based Jump Pad state
        this.isPadJumping = false;
        this.jumpStartZ = 0;
        this.jumpTargetZ = 0;
        this.jumpTotalDistance = 1.0;
        this.jumpPeakHeight = 3.2;
        this.jumpTargetRow = 0;

        this.mesh = this.createBallMesh();
        this.scene.add(this.mesh);

        this.shadow = this.createShadow();
        this.scene.add(this.shadow);
    }

    createBallMesh() {
        const group = new THREE.Group();
        const geo = new THREE.SphereGeometry(this.radius, 32, 32);

        const cv = document.createElement('canvas');
        cv.width = 128; cv.height = 64;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 64);
        ctx.fillStyle = '#ff0055'; ctx.fillRect(0, 0, 64, 32); ctx.fillRect(64, 32, 64, 32);
        const tex = new THREE.CanvasTexture(cv);

        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.2,
            metalness: 0.3
        });
        this.sphereMesh = new THREE.Mesh(geo, mat);
        group.add(this.sphereMesh);
        return group;
    }

    createShadow() {
        const geo = new THREE.CircleGeometry(this.groundRadius, 24);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.45
        });
        return new THREE.Mesh(geo, mat);
    }

    reset(startRow = 0, baseTempo = 11) {
        const z = -startRow * 2.0;
        this.pos.set(0, this.radius, z);
        this.targetX = 0;
        this.velX = 0;
        this.velY = 0;
        this.isGrounded = true;
        this.isJumping = false;
        this.isPadJumping = false;
        this.isFallingIntoVoid = false;
        this.isDead = false;
        this.lastTileEffectKey = null;

        this.speedSqS = Math.max(
            2,
            Math.min(
                40,
                typeof baseTempo === 'number' && !isNaN(baseTempo) ? baseTempo : 11
            )
        );

        this.mesh.visible = true;
        this.shadow.visible = true;
        this.mesh.position.copy(this.pos);
    }

    startPadJump(launchRow, jumpTileCount = 4, height = 3.2) {
        if (this.isFallingIntoVoid || this.isDead) return;

        this.isPadJumping = true;
        this.isJumping = false;
        this.isGrounded = false;

        this.jumpTargetRow = launchRow + jumpTileCount;
        this.jumpStartZ = this.pos.z;
        // Target is locked to the exact half-depth (center) of the landing row
        this.jumpTargetZ = -this.jumpTargetRow * 2.0;
        this.jumpTotalDistance = Math.max(0.1, this.jumpStartZ - this.jumpTargetZ);
        this.jumpPeakHeight = height;

        this.sound.playJump();
    }

    applyTempoTile(targetSqS) {
        this.speedSqS = Math.max(2, Math.min(40, targetSqS));
        this.sound.playSpeed();
    }

    update(delta, level) {
        if (this.isDead) return;

        const TILE_SIZE = 2.0;
        const TILE_HALF = 1.0;
        const groundRadius = this.groundRadius;

        // 1. Forward Motion: STOP advancing along depth if falling into void
        if (!this.isFallingIntoVoid) {
            const fwdDist = this.speedSqS * TILE_SIZE * delta;
            this.pos.z -= fwdDist;
            this.sphereMesh.rotation.x -= fwdDist / this.radius;
        }

        // 2. Lateral Velocity Controller
        const deltaS = this.speedSqS * delta;
        const V_MAX = 5.0;
        const Kp = 1.0;
        const RESPONSE = 30.0;

        if (deltaS > 1e-6 && !this.isFallingIntoVoid) {
            const subSteps = Math.max(1, Math.ceil(deltaS / 0.02));
            const ds = deltaS / subSteps;
            const alpha = 1.0 - Math.exp(-RESPONSE * ds);

            let curX = this.pos.x / TILE_SIZE;
            const tgtX = this.targetX / TILE_SIZE;

            for (let i = 0; i < subSteps; i++) {
                const err = tgtX - curX;
                if (Math.abs(err) < 0.0003 && Math.abs(this.velX) < 0.0003) {
                    this.velX = 0;
                    curX = tgtX;
                    break;
                }
                const desiredVel = Math.max(-V_MAX, Math.min(V_MAX, Kp * err));
                this.velX += (desiredVel - this.velX) * alpha;
                curX += this.velX * ds;
            }
            this.pos.x = Math.max(-7.0, Math.min(7.0, curX * TILE_SIZE));
        }

        this.sphereMesh.rotation.z = -this.velX * 0.04;

        // 3. Tile & Jump Pad Collision Detection
        let onSolidGround = false;
        let primaryTileType = 0;
        let closestDistSq = Infinity;
        let touchedRow = -1;
        let touchedCol = -1;
        let jumpPadCandidate = null;

        // Glass Slabs Check
        for (let slab of level.glassSlabs) {
            const clampX = Math.max(slab.minX, Math.min(this.pos.x, slab.maxX));
            const clampZ = Math.max(slab.minZ, Math.min(this.pos.z, slab.maxZ));
            const dx = this.pos.x - clampX;
            const dz = this.pos.z - clampZ;
            const distSq = dx * dx + dz * dz;

            if (distSq <= groundRadius * groundRadius) {
                if (!slab.triggered) {
                    slab.triggered = true;
                    slab.entryZ = this.pos.z;
                }
                if (slab.entryZ !== null) {
                    const depthTraveledOnSlab = Math.abs(this.pos.z - slab.entryZ);
                    if (depthTraveledOnSlab > (TILE_SIZE + groundRadius * 0.5)) {
                        slab.isSolid = false;
                    }
                }
                if (slab.isSolid) {
                    onSolidGround = true;
                    if (distSq < closestDistSq) {
                        closestDistSq = distSq;
                        primaryTileType = 4;
                        touchedRow = slab.startRow;
                        touchedCol = slab.startCol;
                    }
                }
            }
        }

        // Regular Grid Tiles & Jump Pad Detection
        if (level.levelData && level.levelData.rows && level.levelData.rows.length > 0) {
            const rowsLen = level.levelData.rows.length;
            const rMin = Math.max(0, Math.floor((-this.pos.z - this.radius + TILE_HALF) / TILE_SIZE));
            const rMax = Math.min(rowsLen - 1, Math.floor((-this.pos.z + this.radius + TILE_HALF) / TILE_SIZE));
            const cMin = Math.max(0, Math.floor((this.pos.x - this.radius + 7.0) / TILE_SIZE));
            const cMax = Math.min(6, Math.floor((this.pos.x + this.radius + 7.0) / TILE_SIZE));

            for (let r = rMin; r <= rMax; r++) {
                const row = level.levelData.rows[r];
                if (!row || !row.tiles) continue;
                const tileZ = -r * TILE_SIZE;
                const minZ = tileZ - TILE_HALF;
                const maxZ = tileZ + TILE_HALF;

                for (let c = cMin; c <= cMax; c++) {
                    const tileType = row.tiles[c];
                    if (tileType === 0 || tileType === 4) continue;

                    const tileX = (c - 3) * TILE_SIZE;
                    const minX = tileX - TILE_HALF;
                    const maxX = tileX + TILE_HALF;

                    const clampX = Math.max(minX, Math.min(this.pos.x, maxX));
                    const clampZ = Math.max(minZ, Math.min(this.pos.z, maxZ));
                    const dx = this.pos.x - clampX;
                    const dz = this.pos.z - clampZ;
                    const distSq = dx * dx + dz * dz;

                    // Touching ANY part of a Jump Pad triggers it immediately
                    if (tileType === 2 || tileType === 3) {
                        const touchMargin = this.radius * 0.9;
                        if (
                            this.pos.x >= minX - touchMargin &&
                            this.pos.x <= maxX + touchMargin &&
                            this.pos.z <= maxZ + touchMargin &&
                            this.pos.z >= minZ - touchMargin
                        ) {
                            jumpPadCandidate = { type: tileType, row: r, col: c };
                            onSolidGround = true;
                        }
                    }

                    if (distSq <= groundRadius * groundRadius) {
                        const tileIsSolid = (tileType !== 7 || level.fadeOpacity > 0.4);
                        if (tileIsSolid) {
                            onSolidGround = true;
                            if (distSq < closestDistSq) {
                                closestDistSq = distSq;
                                primaryTileType = tileType;
                                touchedRow = r;
                                touchedCol = c;
                            }
                        }
                    }
                }
            }

            const finishZ = -(rowsLen - 1) * TILE_SIZE;
            if (this.pos.z <= finishZ && !onSolidGround) {
                const lastRow = level.levelData.rows[rowsLen - 1];
                if (lastRow && lastRow.tiles.some(t => t > 0)) {
                    onSolidGround = true;
                }
            }
        }

        // Prioritize jump pad if one was touched
        if (jumpPadCandidate) {
            primaryTileType = jumpPadCandidate.type;
            touchedRow = jumpPadCandidate.row;
            touchedCol = jumpPadCandidate.col;
        }

        const applyTileEffects = (type, r, c) => {
            if (type <= 0 || r < 0 || c < 0) {
                this.lastTileEffectKey = null;
                return;
            }

            // Normal Jump = 4 tiles forward, Big Jump = 8 tiles forward
            if (type === 2) {
                this.startPadJump(r, 4, 3.2);
                return;
            }
            if (type === 3) {
                this.startPadJump(r, 8, 4.8);
                return;
            }

            const effectKey = `${r}:${c}:${type}`;
            if (this.lastTileEffectKey === effectKey) return;
            this.lastTileEffectKey = effectKey;

            if (type === 5) {
                this.speedSqS = Math.max(2, Math.min(40, this.speedSqS * 1.45));
                this.sound.playSpeed();
            } else if (type === 6) {
                this.speedSqS = Math.max(2, Math.min(40, this.speedSqS * 0.85));
                this.sound.playSpeed();
            } else if (type === 8) {
                const row = level.levelData.rows[r];
                const target = row?.tileTempo?.[c] || level.levelData.baseTempo || 11;
                this.applyTempoTile(target);
            }
        };

        // 4. Parabolic Jump Trajectory in Depth Space
        if (this.isPadJumping) {
            const distanceTraveled = this.jumpStartZ - this.pos.z;
            const progress = Math.max(0, Math.min(1.0, distanceTraveled / this.jumpTotalDistance));

            if (progress >= 1.0) {
                // Land exactly at the center depth of the target row
                this.pos.z = this.jumpTargetZ;
                this.pos.y = this.radius;
                this.velY = 0;
                this.isPadJumping = false;

                const landRow = this.jumpTargetRow;
                const landCol = Math.max(0, Math.min(6, Math.round((this.pos.x + 7.0) / 2.0)));
                const rowData = level.levelData.rows[landRow];
                const landType = rowData?.tiles ? rowData.tiles[landCol] : 0;

                // If landed on another jump pad, trigger the chain jump immediately
                if (landType === 2 || landType === 3) {
                    this.isGrounded = true;
                    applyTileEffects(landType, landRow, landCol);
                } else if (landType > 0) {
                    this.isGrounded = true;
                    applyTileEffects(landType, landRow, landCol);
                } else if (onSolidGround) {
                    this.isGrounded = true;
                    applyTileEffects(primaryTileType, touchedRow, touchedCol);
                } else {
                    this.isFallingIntoVoid = true;
                    this.lastTileEffectKey = null;
                }
            } else {
                // Smooth, continuous parabolic curve: 4 * H * p * (1 - p)
                const arcY = 4.0 * this.jumpPeakHeight * progress * (1.0 - progress);
                this.pos.y = this.radius + Math.max(0, arcY);
            }
        } else if (this.isFallingIntoVoid) {
            this.isGrounded = false;
            this.velY -= 42.0 * delta;
            this.pos.y += this.velY * delta;
        } else if (!onSolidGround) {
            this.isFallingIntoVoid = true;
            this.isGrounded = false;
            this.lastTileEffectKey = null;
        } else {
            this.pos.y = this.radius;
            this.velY = 0;
            this.isGrounded = true;
            applyTileEffects(primaryTileType, touchedRow, touchedCol);
        }

        // Void Fall Death Check
        if (this.pos.y < -3.5) {
            this.crash("fall");
        }

        this.mesh.position.copy(this.pos);
        this.shadow.position.set(this.pos.x, 0.02, this.pos.z);
        const shadowScale = Math.max(0.2, 1.0 - (this.pos.y - this.radius) * 0.15);
        this.shadow.scale.set(shadowScale, shadowScale, shadowScale);
        this.shadow.visible = !this.isFallingIntoVoid && this.pos.y > -1.0;
    }

    crash(reason = "obstacle") {
        if (this.isDead) return;
        this.isDead = true;
        this.sound.playCrash();
        this.mesh.visible = false;
        this.shadow.visible = false;
        window.game.onPlayerDeath(reason);
    }
}
