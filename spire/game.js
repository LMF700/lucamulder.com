import * as THREE from "three";

// ============================================================
// THE ABANDONED TOWER v0.4
// More routes, varied geometry, smoother collisions, lethal
// spinners, smaller spikes, and a steadily rising lava hazard.
// ============================================================

// ------------------------------
// Scene
// ------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x303638);
scene.fog = new THREE.Fog(0x303638, 42, 125);

const camera = new THREE.PerspectiveCamera(
    76, window.innerWidth / window.innerHeight, 0.1, 200
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.body.appendChild(renderer.domElement);

// ------------------------------
// Lighting and materials
// ------------------------------

scene.add(new THREE.AmbientLight(0xaab5bb, 0.72));
scene.add(new THREE.HemisphereLight(0xc5d2dc, 0x594331, 0.7));

const sun = new THREE.DirectionalLight(0xffe0bd, 0.8);
sun.position.set(-8, 45, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x555b5b, metalness: 0.68, roughness: 0.84,
    side: THREE.BackSide
});
const beamMaterial = new THREE.MeshStandardMaterial({
    color: 0x70432f, metalness: 0.58, roughness: 0.9
});
const platformMaterial = new THREE.MeshStandardMaterial({
    color: 0x87583e, metalness: 0.48, roughness: 0.88
});
const narrowMaterial = new THREE.MeshStandardMaterial({
    color: 0x647477, metalness: 0.72, roughness: 0.7
});
const padMaterial = new THREE.MeshStandardMaterial({
    color: 0x287e83, emissive: 0x15575b,
    emissiveIntensity: 1.15, metalness: 0.45, roughness: 0.55
});
const spikeMaterial = new THREE.MeshStandardMaterial({
    color: 0xaeb5b5, metalness: 0.82, roughness: 0.32
});
const lavaMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4b0b, emissive: 0xff3100,
    emissiveIntensity: 1.8, roughness: 0.35,
    metalness: 0.05
});
const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xff9b38 });

// ------------------------------
// World
// ------------------------------

const TOWER_RADIUS = 14;
const TOWER_HEIGHT = 112;
const platforms = [];
const hazards = [];
const torches = [];
const movingPlatforms = [];
const checkpointPlatforms = [];

const playerRadius = 0.29;
const playerHeight = 1.7;

const towerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWER_RADIUS, TOWER_RADIUS, TOWER_HEIGHT, 56, 1, true),
    wallMaterial
);
towerWall.position.y = TOWER_HEIGHT / 2;
scene.add(towerWall);

for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2;
    const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, TOWER_HEIGHT, 0.34), beamMaterial
    );
    beam.position.set(Math.cos(a) * 13.72, TOWER_HEIGHT / 2, Math.sin(a) * 13.72);
    beam.castShadow = true;
    scene.add(beam);
}

for (let y = 6; y < TOWER_HEIGHT; y += 9) {
    const brace = new THREE.Mesh(
        new THREE.TorusGeometry(13.64, 0.10, 6, 56), beamMaterial
    );
    brace.rotation.x = Math.PI / 2;
    brace.position.y = y;
    scene.add(brace);
}

// ------------------------------
// Platform factory
// ------------------------------

function addPlatform(spec) {
    const {
        x, y, z, w, d, type = "normal",
        shape = "box", checkpoint = false,
        moveAxis = null, moveDistance = 0, moveSpeed = 0
    } = spec;

    let geometry;
    if (shape === "beam") {
        geometry = new THREE.BoxGeometry(w, 0.42, d);
    } else if (shape === "wedge") {
        geometry = new THREE.CylinderGeometry(w * 0.72, w * 0.72, 0.48, 3);
    } else if (shape === "round") {
        geometry = new THREE.CylinderGeometry(w / 2, w / 2, 0.48, 12);
    } else {
        geometry = new THREE.BoxGeometry(w, 0.5, d);
    }

    const material = type === "pad" ? padMaterial :
        (shape === "beam" ? narrowMaterial : platformMaterial);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const p = {
        x, y, z, w, d, type, shape, checkpoint, mesh,
        baseX: x, baseZ: z,
        moveAxis, moveDistance, moveSpeed,
        phase: Math.random() * Math.PI * 2,
        prevX: x, prevZ: z,
        active: true
    };

    platforms.push(p);

    if (checkpoint) {
        checkpointPlatforms.push(p);
        addCheckpointMarker(x, y + 0.45, z);
    }

    if (moveAxis) movingPlatforms.push(p);
    return p;
}

function addCheckpointMarker(x, y, z) {
    const light = new THREE.PointLight(0x55d9d0, 3.2, 7);
    light.position.set(x, y + 1.1, z);
    scene.add(light);

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.07, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x55d9d0 })
    );
    ring.position.set(x, y + 0.15, z);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
}

// ------------------------------
// Torches
// ------------------------------

function addTorch(x, y, z) {
    const mount = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.5, 0.18), beamMaterial
    );
    mount.position.set(x, y, z);
    scene.add(mount);

    const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 9, 8), flameMaterial
    );
    flame.position.set(x, y + 0.38, z);
    flame.scale.set(0.8, 1.5, 0.8);
    scene.add(flame);

    const light = new THREE.PointLight(0xffa04b, 15, 12, 2);
    light.position.set(x, y + 0.45, z);
    scene.add(light);

    torches.push({ flame, light, offset: Math.random() * 10 });
}

// ------------------------------
// Hazards
// ------------------------------

// Small, individually placed spikes. The smaller hitbox matches
// the visible spike cluster more closely than the old large radius.
function addSpikeCluster(x, y, z, count = 3) {
    const group = new THREE.Group();
    const positions = [
        [-0.28, -0.22], [0.28, -0.22], [0, 0.28],
        [-0.5, 0.35], [0.5, 0.35]
    ];

    for (let i = 0; i < count; i++) {
        const [px, pz] = positions[i];
        const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.13, 0.38, 5),
            spikeMaterial
        );
        spike.position.set(px, 0.19, pz);
        spike.castShadow = true;
        group.add(spike);
    }

    group.position.set(x, y, z);
    scene.add(group);

    hazards.push({
        type: "spikes",
        x, y,
        halfX: 0.66,
        halfZ: 0.66,
        bottom: y,
        top: y + 0.42
    });
}

function addSpinner(x, y, z, length = 4.8, speed = 1.9) {
    const group = new THREE.Group();

    const bar = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.20, 0.25), spikeMaterial
    );
    bar.position.y = 0.78;
    bar.castShadow = true;
    group.add(bar);

    // Short teeth make the spinner visually threatening without
    // making its collision box larger than the actual rotating bar.
    for (const side of [-1, 1]) {
        const tooth = new THREE.Mesh(
            new THREE.ConeGeometry(0.12, 0.28, 5), spikeMaterial
        );
        tooth.rotation.z = Math.PI;
        tooth.position.set(side * (length / 2 - 0.2), 0.56, 0);
        group.add(tooth);
    }

    const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.42, 12), beamMaterial
    );
    hub.position.y = 0.78;
    group.add(hub);

    group.position.set(x, y, z);
    scene.add(group);

    hazards.push({
        type: "spinner",
        x, y,
        group,
        halfLength: length / 2,
        halfWidth: 0.22,
        speed,
        phase: Math.random() * Math.PI * 2
    });
}

// ------------------------------
// Course layout
// ------------------------------

// The route now has more than forty sections, with a mix of:
// broad landings, narrow beams, round platforms, wedges,
// moving platforms, jump pads, checkpoints and hazard sections.

addPlatform({ x: 0, y: 0, z: 0, w: 10, d: 10, checkpoint: true });

const route = [
    [3,-3,2.5,3.4,3.4,"normal","box"],
    [6,-5,5,2.8,2.8,"normal","box"],
    [3,-8,7.5,2.3,2.8,"normal","box"],
    [-1,-7,10,3.2,1.0,"normal","beam"],
    [-5,-5,12.5,2.5,2.5,"pad","box"],
    [-7,-1,15,2.8,2.0,"normal","box"],
    [-5,3,17.5,2.0,2.0,"normal","round"],
    [-1,5,20,3.0,1.0,"normal","beam"],
    [3,3,22.5,2.0,2.0,"normal","box"],
    [6,0,25,2.8,2.8,"normal","box"],
    [5,-4,27.5,2.0,2.0,"pad","round"],
    [1,-7,30,2.4,1.0,"normal","beam"],
    [-3,-5,32.5,2.0,2.0,"normal","box"],
    [-6,-2,35,2.4,2.4,"normal","wedge"],
    [-5,3,37.5,2.0,2.0,"normal","round"],
    [-1,7,40,2.2,2.2,"normal","box"],
    [4,6,42.5,2.4,1.0,"normal","beam"],
    [7,2,45,2.0,2.0,"pad","box"],
    [5,-3,47.5,2.0,2.0,"normal","box"],
    [1,-6,50,2.0,2.0,"normal","round"],
    [-4,-5,52.5,2.6,2.6,"normal","box"],
    [-7,-1,55,2.0,1.0,"normal","beam"],
    [-5,4,57.5,2.0,2.0,"normal","wedge"],
    [-1,7,60,2.0,2.0,"normal","round"],
    [4,6,62.5,2.4,2.0,"normal","box"],
    [7,2,65,2.0,2.0,"normal","box"],
    [5,-3,67.5,2.0,1.0,"normal","beam"],
    [1,-7,70,2.2,2.2,"pad","box"],
    [-4,-6,72.5,2.0,2.0,"normal","round"],
    [-7,-2,75,2.2,2.2,"normal","box"],
    [-5,3,77.5,2.0,1.0,"normal","beam"],
    [-1,7,80,2.0,2.0,"normal","wedge"],
    [4,6,82.5,2.2,2.2,"normal","box"],
    [7,1,85,2.0,2.0,"normal","round"],
    [4,-4,87.5,2.0,2.0,"pad","box"],
    [0,-7,90,2.0,1.0,"normal","beam"],
    [-4,-5,92.5,2.2,2.2,"normal","box"],
    [-7,0,95,2.0,2.0,"normal","round"],
    [-4,5,97.5,2.4,2.4,"normal","box"],
    [1,7,100,2.2,1.0,"normal","beam"],
    [6,5,102.5,2.5,2.5,"normal","box"],
    [7,0,105,3.0,3.0,"normal","box"]
];

route.forEach((a, i) => {
    const [x,z,y,w,d,type,shape] = a;
    const checkpoint = [9, 20, 31, 41].includes(i);

    addPlatform({ x, y, z, w, d, type, shape, checkpoint });

    if ([4, 11, 18, 25, 32, 38].includes(i)) {
        addSpinner(x, y + 0.35, z, i % 2 ? 4.2 : 5.0, i % 2 ? -2.0 : 2.25);
    }

    if ([7, 14, 22, 29, 36].includes(i)) {
        addSpikeCluster(x, y + 0.25, z, 3);
    }

    const angle = Math.atan2(z, x);
    if (i % 2 === 0) {
        addTorch(Math.cos(angle) * 12.55, y + 1.35, Math.sin(angle) * 12.55);
    }
});

// A pair of moving platforms in the upper half.
addPlatform({
    x: 7.0, y: 43.7, z: -0.5, w: 2.4, d: 2.4,
    moveAxis: "z", moveDistance: 1.4, moveSpeed: 0.75
});
addPlatform({
    x: -6.0, y: 73.7, z: -4.0, w: 2.4, d: 2.4,
    moveAxis: "x", moveDistance: 1.4, moveSpeed: 0.9
});

// Finish deck
addPlatform({ x: 2, y: 108, z: -2, w: 8, d: 8, checkpoint: true });

// ------------------------------
// Rising lava
// ------------------------------

const lavaGroup = new THREE.Group();
const lavaSurface = new THREE.Mesh(
    new THREE.CylinderGeometry(13.2, 13.2, 0.35, 64),
    lavaMaterial
);
lavaSurface.position.y = 0;
lavaSurface.receiveShadow = true;
lavaGroup.add(lavaSurface);

const lavaGlow = new THREE.PointLight(0xff4a0b, 28, 38, 2);
lavaGlow.position.set(0, 1.5, 0);
lavaGroup.add(lavaGlow);

const lavaRim = new THREE.Mesh(
    new THREE.TorusGeometry(13.0, 0.22, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xff7a21 })
);
lavaRim.rotation.x = Math.PI / 2;
lavaGroup.add(lavaRim);
scene.add(lavaGroup);

const LAVA_START = -5;
const LAVA_SPEED = 0.105; // metres per second
let lavaHeight = LAVA_START;

// ------------------------------
// Player
// ------------------------------

const player = {
    position: new THREE.Vector3(0, 0.251, 0),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    grounded: true,
    checkpoint: new THREE.Vector3(0, 0.251, 0),
    standingOn: null
};

const keys = Object.create(null);

document.addEventListener("keydown", (event) => {
    keys[event.code] = true;
    if (event.code === "Space") event.preventDefault();
});
document.addEventListener("keyup", (event) => { keys[event.code] = false; });
window.addEventListener("blur", () => {
    for (const key in keys) keys[key] = false;
});

// ------------------------------
// Pointer lock
// ------------------------------

const startScreen = document.getElementById("start");
document.getElementById("play").addEventListener("click", () => {
    renderer.domElement.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
    startScreen.style.display =
        document.pointerLockElement === renderer.domElement ? "none" : "flex";
});

document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    player.yaw -= event.movementX * 0.002;
    player.pitch -= event.movementY * 0.002;
    player.pitch = THREE.MathUtils.clamp(
        player.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02
    );
});

// ------------------------------
// Platform geometry / collision
// ------------------------------

function platformBounds(p) {
    // Round and triangular platforms use a conservative square AABB for
    // collision; their smaller visual footprint remains intentionally tricky.
    return {
        minX: p.x - p.w / 2,
        maxX: p.x + p.w / 2,
        minZ: p.z - p.d / 2,
        maxZ: p.z + p.d / 2
    };
}

function overlapsXZ(p) {
    const b = platformBounds(p);
    return (
        player.position.x + playerRadius > b.minX &&
        player.position.x - playerRadius < b.maxX &&
        player.position.z + playerRadius > b.minZ &&
        player.position.z - playerRadius < b.maxZ
    );
}

function resolveAxis(axis, amount) {
    if (Math.abs(amount) < 0.000001) return;

    // Small movement slices prevent tunnelling and reduce the harsh
    // one-frame snapping of the earlier collision implementation.
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.075));
    const step = amount / steps;

    for (let s = 0; s < steps; s++) {
        const before = player.position[axis];
        player.position[axis] += step;

        for (const p of platforms) {
            if (!p.active) continue;

            const feet = player.position.y;
            const head = feet + playerHeight;
            const bottom = p.y - 0.25;
            const top = p.y + 0.25;

            if (head <= bottom + 0.015 || feet >= top - 0.015) continue;

            const b = platformBounds(p);
            const other = axis === "x" ? "z" : "x";
            const otherMin = other === "x" ? b.minX : b.minZ;
            const otherMax = other === "x" ? b.maxX : b.maxZ;
            const otherPos = player.position[other];

            if (otherPos + playerRadius <= otherMin ||
                otherPos - playerRadius >= otherMax) continue;

            const min = axis === "x" ? b.minX : b.minZ;
            const max = axis === "x" ? b.maxX : b.maxZ;

            const oldOutsideLow = before + playerRadius <= min + 0.001;
            const oldOutsideHigh = before - playerRadius >= max - 0.001;

            if (step > 0 && oldOutsideLow &&
                player.position[axis] + playerRadius > min) {
                player.position[axis] = min - playerRadius - 0.002;
            } else if (step < 0 && oldOutsideHigh &&
                player.position[axis] - playerRadius < max) {
                player.position[axis] = max + playerRadius + 0.002;
            }
        }
    }
}

function resolveVertical(previousY) {
    player.grounded = false;

    if (player.velocity.y <= 0) {
        for (const p of platforms) {
            if (!p.active) continue;
            const top = p.y + 0.25;

            if (previousY >= top - 0.015 &&
                player.position.y <= top &&
                overlapsXZ(p)) {
                player.position.y = top;
                player.velocity.y = 0;
                player.grounded = true;
                player.standingOn = p;

                if (p.checkpoint) {
                    player.checkpoint.set(p.x, top + 0.002, p.z);
                    if (player._lastCheckpoint !== p) {
                        player._lastCheckpoint = p;
                        showMessage("CHECKPOINT REACHED");
                    }
                }

                if (p.type === "pad") {
                    player.velocity.y = 17;
                    player.grounded = false;
                    player.standingOn = null;
                    showMessage("JUMP PAD!");
                }
                break;
            }
        }
    }

    if (player.velocity.y > 0) {
        const oldHead = previousY + playerHeight;
        const newHead = player.position.y + playerHeight;

        for (const p of platforms) {
            if (!p.active) continue;
            const underside = p.y - 0.25;
            if (oldHead <= underside && newHead >= underside && overlapsXZ(p)) {
                player.position.y = underside - playerHeight;
                player.velocity.y = 0;
                break;
            }
        }
    }
}

// ------------------------------
// Moving platforms
// ------------------------------

function updateMovingPlatforms(time) {
    for (const p of movingPlatforms) {
        p.prevX = p.x;
        p.prevZ = p.z;

        const offset = Math.sin(time * p.moveSpeed + p.phase) * p.moveDistance;
        p.x = p.baseX + (p.moveAxis === "x" ? offset : 0);
        p.z = p.baseZ + (p.moveAxis === "z" ? offset : 0);
        p.mesh.position.x = p.x;
        p.mesh.position.z = p.z;

        if (player.standingOn === p && player.grounded) {
            player.position.x += p.x - p.prevX;
            player.position.z += p.z - p.prevZ;
        }
    }
}

// ------------------------------
// Death / respawn
// ------------------------------

let lastDeathTime = -10;
let messageTimeout;

function showMessage(text) {
    const el = document.getElementById("message");
    el.textContent = text;
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => { el.textContent = ""; }, 1400);
}

function respawn(reason = "YOU DIED") {
    const now = performance.now() / 1000;
    if (now - lastDeathTime < 1.0) return;

    lastDeathTime = now;
    player.position.copy(player.checkpoint);
    player.velocity.set(0, 0, 0);
    player.grounded = false;
    player.standingOn = null;
    showMessage(reason);
}

function checkHazards() {
    const px = player.position.x;
    const py = player.position.y;
    const pz = player.position.z;

    for (const h of hazards) {
        if (h.type === "spikes") {
            const dx = Math.max(Math.abs(px - h.x) - h.halfX, 0);
            const dz = Math.max(Math.abs(pz - h.z) - h.halfZ, 0);
            const vertical = py < h.top && py + playerHeight > h.bottom;
            if (Math.hypot(dx, dz) < playerRadius + 0.04 && vertical) {
                respawn("SPIKED");
                return;
            }
        }

        if (h.type === "spinner") {
            const a = h.group.rotation.y;
            const dx = px - h.x;
            const dz = pz - h.z;

            // Transform player into the spinner bar's local coordinates.
            const localX = dx * Math.cos(a) + dz * Math.sin(a);
            const localZ = -dx * Math.sin(a) + dz * Math.cos(a);

            const insideBar =
                Math.abs(localX) < h.halfLength + playerRadius * 0.45 &&
                Math.abs(localZ) < h.halfWidth + playerRadius * 0.55;

            const vertical =
                py + playerHeight > h.y + 0.55 &&
                py < h.y + 1.05;

            if (insideBar && vertical) {
                respawn("HIT BY SPINNER");
                return;
            }
        }
    }

    // Lava is lethal once its surface reaches the player's feet.
    if (py < lavaHeight + 0.65) {
        respawn("THE LAVA GOT YOU");
    }
}

// ------------------------------
// Player movement
// ------------------------------

function updatePlayer(dt) {
    const walkSpeed = 6.8;
    const sprintSpeed = 10.5;
    const gravity = 24;

    const sprinting = keys.ShiftLeft || keys.ShiftRight;
    const speed = sprinting ? sprintSpeed : walkSpeed;

    let forward = 0;
    let sideways = 0;
    if (keys.KeyW) forward++;
    if (keys.KeyS) forward--;
    if (keys.KeyD) sideways++;
    if (keys.KeyA) sideways--;

    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const move = new THREE.Vector3()
        .addScaledVector(fwd, forward)
        .addScaledVector(right, sideways);

    if (move.lengthSq() > 1) move.normalize();

    player.velocity.x = move.x * speed;
    player.velocity.z = move.z * speed;

    if (keys.Space && player.grounded) {
        player.velocity.y = 12.5;
        player.grounded = false;
        player.standingOn = null;
    }

    resolveAxis("x", player.velocity.x * dt);
    resolveAxis("z", player.velocity.z * dt);

    const previousY = player.position.y;
    player.velocity.y -= gravity * dt;
    player.position.y += player.velocity.y * dt;
    resolveVertical(previousY);

    // Keep the player inside the tower. A little tolerance prevents
    // the wall boundary from fighting platform-edge collision.
    const radius = Math.hypot(player.position.x, player.position.z);
    const maxRadius = TOWER_RADIUS - playerRadius - 0.18;
    if (radius > maxRadius) {
        const scale = maxRadius / radius;
        player.position.x *= scale;
        player.position.z *= scale;
    }

    checkHazards();

    if (player.position.y < -15) {
        respawn("FELL INTO THE SHAFT");
    }

    camera.position.set(
        player.position.x,
        player.position.y + playerHeight,
        player.position.z
    );
    camera.rotation.order = "YXZ";
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    document.getElementById("height").textContent =
        `Height: ${Math.max(0, Math.floor(player.position.y))}m`;
    document.getElementById("lava").textContent =
        `Lava: ${lavaHeight.toFixed(1)}m`;
    document.getElementById("status").textContent =
        sprinting ? "SPRINTING" : "WALKING";
}

// ------------------------------
// Main loop
// ------------------------------

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.04);
    const time = clock.elapsedTime;

    // Lava starts rising as soon as the game starts.
    lavaHeight = LAVA_START + time * LAVA_SPEED;
    lavaGroup.position.y = lavaHeight - 0.18;
    lavaRim.position.y = lavaHeight + 0.01;
    lavaGlow.position.y = lavaHeight + 1.4;

    // Subtle animated lava shimmer.
    lavaSurface.scale.x = 1 + Math.sin(time * 2.2) * 0.006;
    lavaSurface.scale.z = 1 + Math.cos(time * 1.8) * 0.006;

    updateMovingPlatforms(time);
    updatePlayer(dt);

    for (const h of hazards) {
        if (h.type === "spinner") {
            h.group.rotation.y = time * h.speed + h.phase;
        }
    }

    for (const torch of torches) {
        torch.light.intensity = 14 + Math.sin(time * 9 + torch.offset) * 2.0;
        torch.flame.scale.y = 1.35 + Math.sin(time * 13 + torch.offset) * 0.18;
    }

    renderer.render(scene, camera);
}

animate();

// ------------------------------
// Resize
// ------------------------------

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
