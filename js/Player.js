import * as THREE from 'three';

export class Player {
    constructor(scene, sound) {
        this.scene = scene;
        this.sound = sound;
        
        // Base Dimensions & Two Distinct Hitboxes
        this.radius = 0.78; 
        this.hazardRadius = this.radius * 1.1;               // 1.1x larger for obstacle damage (0.858)
        this.groundRadius = this.hazardRadius * 0.75;        // 0.75x of hazard hitbox for tiles & diagonals (0.6435)

        this.pos = new THREE.Vector3(0, this.radius, 0);
        this.velY = 0;
        this.isGrounded = true;
        this.isJumping = false;
        this.isFallingIntoVoid = false;
        this.isDead = false;
        this.speedSqS = 11;

        // Smooth Depth-Space Kinematics with Lower Jerk Cap
        this.targetX = 0;
        this.velX = 0;   // width/depth
        this.accelX = 0; // width/depth^2

        // Grid-Locked Parabolic Jump Trajectory in Depth Space
        this.isPadJumping = false;
        this.padLaunchRow = 0;
        this.padJumpDistance = 4.0;
        this.padJumpHeight = 3.2;

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
        // Shadow visual matches the 0.75x ground & diagonal hitbox
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
        this.accelX = 0;
        this.velY = 0;
        this.isGrounded = true;
        this.isJumping = false;
        this.isPadJumping = false;
        this.isFallingIntoVoid = false;
        this.isDead = false;
        this.speedSqS = Math.max(2, Math.min(40, (typeof baseTempo === 'number' && !isNaN(baseTempo)) ? baseTempo : 11));
        this.mesh.visible = true;
        this.shadow.visible = true;
        this.mesh.position.copy(this.pos);
    }
    startPadJump(launchRow, distanceTiles = 4.0, height = 3.2) {
        if (this.isFallingIntoVoid) return;
        this.isPadJumping = true;
        this.isJumping = false;
        this.isGrounded = false;
        this.padLaunchRow = launchRow;
        this.padJumpDistance = distanceTiles;
        this.padJumpHeight = height;
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
        const groundRadius = this.groundRadius; // 0.75x hitbox for diagonals and tiles

        // Forward motion along depth
        const fwdDist = this.speedSqS * TILE_SIZE * delta;
        this.pos.z -= fwdDist;

        // Total depth in tile units traversed this frame
        const deltaS = this.speedSqS * delta;

        // --- Low-Jerk Smooth Kinematic Controller ---
        // Significantly reduced jerk (J_MAX = 45) removes all twitching on small 1-3 block movements
        const V_MAX = 4.5;    // Max lateral speed (width/depth)
        const A_MAX = 14.0;   // Balanced max acceleration (width/depth^2)
        const J_MAX = 45.0;   // Lower jerk cap for smooth micro-adjustments (width/depth^3)
        const TAU_A = A_MAX / J_MAX; // 0.31 depth units time constant

        if (deltaS > 0.000001) {
            const maxSubStep = 0.005;
            const subSteps = Math.max(1, Math.ceil(deltaS / maxSubStep));
            const ds = deltaS / subSteps;

            let currentTileX = this.pos.x / TILE_SIZE;
            const targetTileX = this.targetX / TILE_SIZE;

            for (let i = 0; i < subSteps; i++) {
                const deltaX = targetTileX - currentTileX;

                // Optimal depth-space braking speed profile
                const stoppingSpeed = Math.sqrt(2.0 * A_MAX * Math.abs(deltaX));
                const desiredVel = Math.sign(deltaX) * Math.min(V_MAX, stoppingSpeed);

                // Desired acceleration bounded by A_MAX
                const desiredAccel = Math.max(-A_MAX, Math.min(A_MAX, (desiredVel - this.velX) / TAU_A));

                // Bounded jerk acceleration adjustment
                const maxJerkStep = J_MAX * ds;
                const accelDiff = desiredAccel - this.accelX;
                const jerkStep = Math.max(-maxJerkStep, Math.min(maxJerkStep, accelDiff));

                this.accelX += jerkStep;
                this.accelX = Math.max(-A_MAX, Math.min(A_MAX, this.accelX));

                this.velX += this.accelX * ds;
                this.velX = Math.max(-V_MAX, Math.min(V_MAX, this.velX));

                currentTileX += this.velX * ds;
            }

            this.pos.x = Math.max(-7.0, Math.min(7.0, currentTileX * TILE_SIZE));
        }

        this.sphereMesh.rotation.x -= fwdDist / this.radius;
        this.sphereMesh.rotation.z = -this.velX * 0.08 - this.accelX * 0.002;

        // 7-Lane Collision Detection & Glass Slab Checking
        let onSolidGround = false;
        let primaryTileType = 0;
        let closestDistSq = Infinity;
        let touchedRow = -1;
        let touchedCol = -1;
        let jumpPadCandidate = null;

        // Glass Slabs: 1-Depth Safe Rule
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

        // Regular Grid Tiles
        if (level.levelData && level.levelData.rows && level.levelData.rows.length > 0) {
            const rowsLen = level.levelData.rows.length;
            const rMin = Math.max(0, Math.floor((-this.pos.z - groundRadius + TILE_HALF) / TILE_SIZE));
            const rMax = Math.min(rowsLen - 1, Math.floor((-this.pos.z + groundRadius + TILE_HALF) / TILE_SIZE));
            const cMin = Math.max(0, Math.floor((this.pos.x - groundRadius + 7.0) / TILE_SIZE));
            const cMax = Math.min(6, Math.floor((this.pos.x + groundRadius + 7.0) / TILE_SIZE));

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

                    if (distSq <= groundRadius * groundRadius) {
                        let tileIsSolid = (tileType !== 7 || level.fadeOpacity > 0.4);
                        if (tileIsSolid) {
                            onSolidGround = true;

                            // ALWAYS prioritize Jump Pad (2) and Big Jump (3) so they never get swallowed
                            if (tileType === 2 || tileType === 3) {
                                jumpPadCandidate = { type: tileType, row: r, col: c };
                            }

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

        // Guaranteed Jump Pad Trigger Priority
        if (jumpPadCandidate) {
            primaryTileType = jumpPadCandidate.type;
            touchedRow = jumpPadCandidate.row;
            touchedCol = jumpPadCandidate.col;
        }

        const applyTileEffects = (type, r, c) => {
            if (type === 2) this.startPadJump(r, 4.0, 3.2); // Exact 4-tile jump
            else if (type === 3) this.startPadJump(r, 8.0, 4.8); // Exact 8-tile jump
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
        };

        // --- Grid-Locked Parabolic Trajectory in Depth Space ---
        if (this.isPadJumping) {
            const currentS = -this.pos.z / 2.0;
            const progress = (currentS - this.padLaunchRow) / this.padJumpDistance;

            if (progress >= 1.0) {
                this.pos.y = this.radius;
                this.isPadJumping = false;
                this.velY = 0;

                const landRow = Math.round(this.padLaunchRow + this.padJumpDistance);
                const landCol = Math.max(0, Math.min(6, Math.floor((this.pos.x + 7.0) / 2.0)));
                const rowData = level.levelData.rows[landRow];
                const landType = (rowData && rowData.tiles) ? rowData.tiles[landCol] : 0;

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
                }
            } else {
                const arcY = 4.0 * this.padJumpHeight * progress * (1.0 - progress);
                this.pos.y = this.radius + Math.max(0, arcY);
            }
        } else if (this.isFallingIntoVoid) {
            this.isGrounded = false;
            this.velY -= 42.0 * delta;
            this.pos.y += this.velY * delta;
        } else if (!onSolidGround) {
            this.isFallingIntoVoid = true;
            this.isGrounded = false;
        } else {
            // Rolling on solid ground
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
