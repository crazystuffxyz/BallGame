import * as THREE from 'three';

export class Player {
    constructor(scene, sound) {
        this.scene = scene;
        this.sound = sound;
        this.radius = 0.78; // 1.3x ball size
        this.pos = new THREE.Vector3(0, this.radius, 0);
        this.velY = 0;
        this.isGrounded = true;
        this.isJumping = false;
        this.isFallingIntoVoid = false;
        this.isDead = false;
        this.speedSqS = 11;

        // 3rd-order Jerk-Limited Depth Kinematics
        this.targetX = 0;
        this.velX = 0;   // Lateral velocity per depth (dx/ds in width/depth)
        this.accelX = 0; // Lateral acceleration per depth (d^2x/ds^2 in width/depth^2)

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
        const geo = new THREE.CircleGeometry(this.radius * 0.45, 24);
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
        this.accelX = 0;
        this.velY = 0;
        this.isGrounded = true;
        this.isJumping = false;
        this.isFallingIntoVoid = false;
        this.isDead = false;
        this.speedSqS = Math.max(2, Math.min(40, (typeof baseTempo === 'number' && !isNaN(baseTempo)) ? baseTempo : 11));
        this.mesh.visible = true;
        this.shadow.visible = true;
        this.mesh.position.copy(this.pos);
    }
    jump(power = 12.0) {
        if (this.isFallingIntoVoid) return;
        this.velY = power;
        this.isGrounded = false;
        this.isJumping = true;
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
        const shadowRadius = this.radius * 0.45;

        // Forward distance along depth
        const fwdDist = this.speedSqS * TILE_SIZE * delta;
        this.pos.z -= fwdDist;

        // Total depth in tile units traversed this frame
        const deltaS = this.speedSqS * delta;

        // --- 3rd-Order Jerk-Limited S-Curve Kinematic Solver ---
        // Constants analytically derived from 15 swings per 11 depth at width 3
        const V_MAX = 5.0;     // Max speed (width/depth)
        const A_MAX = 75.0;    // Max acceleration (width/depth^2)
        const J_MAX = 1125.0;  // Max jerk (width/depth^3)
        const TAU_A = A_MAX / J_MAX; // 1/15 depth unit acceleration time constant

        if (deltaS > 0.000001) {
            // High-precision sub-stepping ensures zero numerical drift across any frame rate
            const maxSubStep = 0.005;
            const subSteps = Math.max(1, Math.ceil(deltaS / maxSubStep));
            const ds = deltaS / subSteps;

            let currentTileX = this.pos.x / TILE_SIZE;
            const targetTileX = this.targetX / TILE_SIZE;

            for (let i = 0; i < subSteps; i++) {
                const deltaX = targetTileX - currentTileX;

                // Optimal depth-domain braking velocity
                const stoppingSpeed = Math.sqrt(2.0 * A_MAX * Math.abs(deltaX));
                const desiredVel = Math.sign(deltaX) * Math.min(V_MAX, stoppingSpeed);

                // Desired acceleration bounded by A_MAX
                const desiredAccel = Math.max(-A_MAX, Math.min(A_MAX, (desiredVel - this.velX) / TAU_A));

                // Apply bounded jerk to adjust acceleration
                const maxJerkStep = J_MAX * ds;
                const accelDiff = desiredAccel - this.accelX;
                const jerkStep = Math.max(-maxJerkStep, Math.min(maxJerkStep, accelDiff));

                this.accelX += jerkStep;
                this.accelX = Math.max(-A_MAX, Math.min(A_MAX, this.accelX));

                // Integrate velocity and position
                this.velX += this.accelX * ds;
                this.velX = Math.max(-V_MAX, Math.min(V_MAX, this.velX));

                currentTileX += this.velX * ds;
            }

            this.pos.x = Math.max(-7.0, Math.min(7.0, currentTileX * TILE_SIZE));
        }

        // Visual ball roll and organic banking tilt
        this.sphereMesh.rotation.x -= fwdDist / this.radius;
        this.sphereMesh.rotation.z = -this.velX * 0.08 - this.accelX * 0.002;

        // 7-Lane Collision Detection
        let onSolidGround = false;
        let primaryTileType = 0;
        let closestDistSq = Infinity;
        let touchedRow = -1;
        let touchedCol = -1;

        if (level.levelData && level.levelData.rows && level.levelData.rows.length > 0) {
            const rowsLen = level.levelData.rows.length;
            const rMin = Math.max(0, Math.floor((-this.pos.z - shadowRadius + TILE_HALF) / TILE_SIZE));
            const rMax = Math.min(rowsLen - 1, Math.floor((-this.pos.z + shadowRadius + TILE_HALF) / TILE_SIZE));
            const cMin = Math.max(0, Math.floor((this.pos.x - shadowRadius + 7.0) / TILE_SIZE));
            const cMax = Math.min(6, Math.floor((this.pos.x + shadowRadius + 7.0) / TILE_SIZE));

            for (let r = rMin; r <= rMax; r++) {
                const row = level.levelData.rows[r];
                if (!row || !row.tiles) continue;
                const tileZ = -r * TILE_SIZE;
                const minZ = tileZ - TILE_HALF;
                const maxZ = tileZ + TILE_HALF;

                for (let c = cMin; c <= cMax; c++) {
                    const tileType = row.tiles[c];
                    if (tileType === 0) continue; // Void tile

                    const tileX = (c - 3) * TILE_SIZE;
                    const minX = tileX - TILE_HALF;
                    const maxX = tileX + TILE_HALF;

                    const clampX = Math.max(minX, Math.min(this.pos.x, maxX));
                    const clampZ = Math.max(minZ, Math.min(this.pos.z, maxZ));
                    const dx = this.pos.x - clampX;
                    const dz = this.pos.z - clampZ;
                    const distSq = dx * dx + dz * dz;

                    if (distSq <= shadowRadius * shadowRadius) {
                        let tileIsSolid = true;
                        if (tileType === 4) { // Glass tile
                            const glassMesh = level.gridGroup.children.find(
                                m => m.userData.row === r && m.userData.lane === c
                            );
                            if (glassMesh && glassMesh.position.y < -0.3) {
                                tileIsSolid = false;
                            }
                        } else if (tileType === 7) { // Fade tile
                            tileIsSolid = (level.fadeOpacity > 0.4);
                        }

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

        const applyTileEffects = (type, r, c) => {
            if (type === 2) this.jump(13.5);
            else if (type === 3) this.jump(18.0);
            else if (type === 5) {
                this.speedSqS = Math.max(2, Math.min(40, this.speedSqS * 1.45));
                this.sound.playSpeed();
            }
            else if (type === 6) {
                this.speedSqS = Math.max(2, Math.min(40, this.speedSqS * 0.85));
            }
            else if (type === 8) {
                const row = level.levelData.rows[r];
                const target = (row && row.tileTempo && row.tileTempo[c]) || level.levelData.baseTempo || 11;
                this.applyTempoTile(target);
            }
            else if (type === 4) {
                const tm = level.gridGroup.children.find(m => m.userData.row === r && m.userData.lane === c);
                if (tm) level.triggerGlass(tm, this.speedSqS);
            }
        };

        if (!this.isJumping) {
            if (!onSolidGround) {
                this.isFallingIntoVoid = true;
                this.isGrounded = false;
            }
        }

        if (this.isFallingIntoVoid) {
            this.isGrounded = false;
            this.velY -= 42.0 * delta;
            this.pos.y += this.velY * delta;
        } else if (this.isJumping) {
            const gravity = 34.0;
            this.velY -= gravity * delta;
            this.pos.y += this.velY * delta;

            if (this.pos.y <= this.radius && this.velY <= 0) {
                if (onSolidGround) {
                    this.pos.y = this.radius;
                    this.velY = 0;
                    this.isGrounded = true;
                    this.isJumping = false;
                    applyTileEffects(primaryTileType, touchedRow, touchedCol);
                } else {
                    this.isJumping = false;
                    this.isFallingIntoVoid = true;
                }
            }
        } else {
            this.pos.y = this.radius;
            this.velY = 0;
            this.isGrounded = true;
            applyTileEffects(primaryTileType, touchedRow, touchedCol);
        }

        if (this.pos.y < -3.5) {
            this.crash("fall");
        }

        this.mesh.position.copy(this.pos);
        this.shadow.position.set(this.pos.x, 0.02, this.pos.z);
        const shadowScale = Math.max(0.2, 1.0 - (this.pos.y - this.radius) * 0.15);
        this.shadow.scale.set(shadowScale, shadowScale, shadowScale);
        this.shadow.visible = !this.isFallingIntoVoid && this.pos.y > -0.5;
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
