// FILL THE SEA — 2.25D voxel-ish prototype
// Replace your existing js/main.js with this file.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WORLD = { width: 160, height: 120, seed: 42817 };
const VIEW = { yScale: 0.78, heightScale: 0.78, tileDepth: 0.78 };
const spawn = { x: 76, y: 65 };
const basin = { x: 99, y: 48, rx: 17, ry: 13, floor: 5 };

const player = {
    x: spawn.x, y: spawn.y,
    speed: 8,
    walkTime: 0,
    moving: false
};

const camera = { x: player.x, y: player.y, elevation: 0, zoom: 7.5 };
const waterSources = [
    { x: 18, y: 17, radius: 4 },
    { x: 137, y: 94, radius: 5 },
    { x: 27, y: 103, radius: 3 }
];

const inventory = { pipes: 100 };
const aqueducts = [];
const waterParticles = [];
let basinWater = 0;
let selectedDirection = 1;
let keys = {};
let width = innerWidth;
let height = innerHeight;
let lastFrame = 0;
let toastTimer = null;

const directions = [
    { x: -1, y: -1, name: "Northwest" },
    { x: 0, y: -1, name: "North" },
    { x: 1, y: -1, name: "Northeast" },
    { x: -1, y: 0, name: "West" },
    { x: 1, y: 0, name: "East" },
    { x: -1, y: 1, name: "Southwest" },
    { x: 0, y: 1, name: "South" },
    { x: 1, y: 1, name: "Southeast" }
];

function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ---------- Seeded terrain ----------

function hash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7 + WORLD.seed) * 43758.5453;
    return n - Math.floor(n);
}

function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return (a + (b - a) * sx) +
        ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

function fractalNoise(x, y) {
    return noise(x * .025, y * .025) * .55 +
           noise(x * .065, y * .065) * .30 +
           noise(x * .15, y * .15) * .15;
}

function inBasin(x, y) {
    const dx = (x - basin.x) / basin.rx;
    const dy = (y - basin.y) / basin.ry;
    return Math.sqrt(dx * dx + dy * dy);
}

function terrainHeight(x, y) {
    const n = fractalNoise(x, y);
    let elevation = Math.round(12 + n * 12);

    // Broad, block-stepped hills.
    const hill = Math.max(0, noise(x * .018 + 40, y * .018) - .48);
    elevation += Math.round(hill * hill * 150);

    // A distinct, shallow-sided basin with a flatter floor.
    const d = inBasin(x, y);
    if (d < 1) {
        const wall = Math.max(0, d - .48) / .52;
        const floorNoise = Math.round(noise(x * .12, y * .12) * 1.2);
        elevation = basin.floor + Math.round(wall * 8) + floorNoise;
    }

    return Math.max(0, elevation);
}

function sourceAt(x, y) {
    return waterSources.find(s => Math.hypot(x - s.x, y - s.y) <= s.radius);
}

function isInsideWorld(x, y) {
    return x >= 0 && y >= 0 && x < WORLD.width && y < WORLD.height;
}

// ---------- Projection ----------
// Camera elevation is subtracted too, so the player's feet stay at screen centre.

function project(x, y, elevation) {
    return {
        x: width / 2 + (x - camera.x) * camera.zoom,
        y: height / 2 +
           (y - camera.y) * camera.zoom * VIEW.yScale -
           (elevation - camera.elevation) * camera.zoom * VIEW.heightScale
    };
}

function polygon(points, fill, stroke = null) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.6;
        ctx.stroke();
    }
}

function terrainColor(x, y, h, slope) {
    const v = noise(x * .13, y * .13);
    if (inBasin(x, y) < .52) return v > .5 ? "#b6a77c" : "#aa9a70";
    if (slope > 5) return h > 35 ? "#77796d" : "#62794f";
    if (h > 48) return "#858779";
    if (h > 34) return "#879b70";
    if (v > .78) return "#668c58";
    if (v < .22) return "#789b66";
    return "#70945d";
}

// ---------- Voxel-ish terrain rendering ----------

function renderTerrain() {
    ctx.fillStyle = "#91b7c5";
    ctx.fillRect(0, 0, width, height);

    const z = camera.zoom;
    const cell = 1;
    const rangeX = width / z / 2 + 4;
    const rangeY = height / (z * VIEW.yScale) / 2 + 5;
    const minX = Math.max(0, Math.floor(camera.x - rangeX));
    const maxX = Math.min(WORLD.width - 1, Math.ceil(camera.x + rangeX));
    const minY = Math.max(0, Math.floor(camera.y - rangeY));
    const maxY = Math.min(WORLD.height - 1, Math.ceil(camera.y + rangeY));

    // Draw back-to-front by world Y. Every cell has a top and visible vertical faces.
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const h = terrainHeight(x, y);
            const east = terrainHeight(x + 1, y);
            const south = terrainHeight(x, y + 1);
            const p0 = project(x, y, h);
            const p1 = project(x + 1, y, h);
            const p2 = project(x + 1, y + 1, h);
            const p3 = project(x, y + 1, h);

            const slope = Math.abs(h - east) + Math.abs(h - south);
            const topColor = terrainColor(x + .5, y + .5, h, slope);

            // East-facing vertical wall.
            if (h > east) {
                const low1 = project(x + 1, y, east);
                const low2 = project(x + 1, y + 1, Math.min(east, south));
                polygon([p1, p2, low2, low1], "#536b49");
            }
            // South-facing vertical wall, the main depth cue.
            if (h > south) {
                const low2 = project(x + 1, y + 1, Math.min(south, east));
                const low3 = project(x, y + 1, south);
                polygon([p3, p2, low2, low3], "#465d43");
            }

            polygon([p0, p1, p2, p3], topColor);

            // Sparse surface flecks give the ground a chunky, voxel-like texture.
            if (noise(x * 2.7, y * 2.7) > .91) {
                const c = project(x + .5, y + .5, h);
                ctx.fillStyle = "#ffffff18";
                ctx.fillRect(c.x - z * .10, c.y - z * .10, z * .2, z * .2);
            }
        }
    }
}

function renderBasinWater() {
    if (basinWater <= 0) return;
    const level = Math.min(1, basinWater / 100);
    const rx = basin.rx * (.25 + level * .72);
    const ry = basin.ry * (.25 + level * .72);
    const p = project(basin.x, basin.y, basin.floor + 1 + level * 2);
    ctx.save();
    ctx.globalAlpha = .82;
    ctx.fillStyle = "#43b9d6";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * camera.zoom, ry * camera.zoom * VIEW.yScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a2e7ed";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
}

function renderWaterSources() {
    for (const s of waterSources) {
        const p = project(s.x, s.y, terrainHeight(s.x, s.y) + .5);
        ctx.fillStyle = "#319bc5";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, s.radius * camera.zoom,
            s.radius * camera.zoom * VIEW.yScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#a6e5ed";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#e7f8f3";
        ctx.font = `bold ${Math.max(9, camera.zoom * 1.35)}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText("WATER", p.x, p.y + 3);
    }
}

// ---------- Aqueduct construction and stylized flow ----------

function endpoint() {
    if (aqueducts.length) {
        const last = aqueducts[aqueducts.length - 1];
        return { x: last.x, y: last.y };
    }
    return { x: Math.round(player.x), y: Math.round(player.y) };
}

function placeAqueduct() {
    if (inventory.pipes < 1) return showToast("You need more Pipe.");
    const from = endpoint();
    const dir = directions[selectedDirection];
    const x = from.x + dir.x;
    const y = from.y + dir.y;

    if (!isInsideWorld(x, y)) return showToast("You can't build outside the world.");
    if (aqueducts.some(a => a.x === x && a.y === y)) return showToast("There's already an aqueduct there.");

    const h = terrainHeight(x, y);
    const previous = aqueducts.length ? aqueducts[aqueducts.length - 1] : null;
    const baseHeight = previous ? previous.height : terrainHeight(from.x, from.y) + 2;

    // Aqueducts can bridge modest elevation changes, but not absurd cliffs.
    if (Math.abs(h + 2 - baseHeight) > 12) return showToast("Too steep for this aqueduct segment.");

    aqueducts.push({
        x, y,
        height: Math.max(h + 2, baseHeight - 1),
        water: 0,
        phase: Math.random() * Math.PI * 2
    });
    inventory.pipes--;
    updateInventoryUI();
    showToast("Aqueduct placed. −1 Pipe");
}

function renderAqueducts() {
    for (let i = 0; i < aqueducts.length; i++) {
        const a = aqueducts[i];
        const p = project(a.x + .5, a.y + .5, a.height);
        const z = camera.zoom;

        // Supports
        const ground = project(a.x + .5, a.y + .5, terrainHeight(a.x, a.y));
        ctx.strokeStyle = "#655d49";
        ctx.lineWidth = Math.max(1.5, z * .16);
        ctx.beginPath();
        ctx.moveTo(p.x - z * .22, p.y);
        ctx.lineTo(ground.x - z * .22, ground.y);
        ctx.moveTo(p.x + z * .22, p.y);
        ctx.lineTo(ground.x + z * .22, ground.y);
        ctx.stroke();

        // Trough body
        ctx.fillStyle = "#a8aaa0";
        ctx.fillRect(p.x - z * .42, p.y - z * .10, z * .84, z * .30);
        ctx.fillStyle = "#5b716f";
        ctx.fillRect(p.x - z * .34, p.y - z * .08, z * .68, z * .12);
        ctx.strokeStyle = "#e0dfc7";
        ctx.lineWidth = Math.max(1, z * .07);
        ctx.strokeRect(p.x - z * .42, p.y - z * .10, z * .84, z * .30);

        // Moving blue water in the trough.
        if (a.water > .02) {
            const pulse = (performance.now() / 360 + i * .23) % 1;
            ctx.fillStyle = "#45c7e8";
            ctx.globalAlpha = .65 + a.water * .35;
            ctx.fillRect(p.x - z * .30 + pulse * z * .35, p.y - z * .055, z * .22, z * .07);
            ctx.globalAlpha = 1;
        }
    }
}

function updateFluid(dt) {
    // A source touching the first segment feeds the chain.
    if (!aqueducts.length) return;
    const first = aqueducts[0];
    const fed = waterSources.some(s => Math.hypot(first.x - s.x, first.y - s.y) <= s.radius + 1);

    if (fed) first.water = Math.min(1, first.water + dt * 0.8);

    for (let i = 1; i < aqueducts.length; i++) {
        const previous = aqueducts[i - 1];
        const current = aqueducts[i];
        const connected = Math.max(
            Math.abs(current.x - previous.x),
            Math.abs(current.y - previous.y)
        ) === 1;

        if (connected && previous.water > .18) {
            const transfer = Math.min(previous.water, dt * .7);
            previous.water -= transfer;
            current.water = Math.min(1, current.water + transfer);
        }
    }

    const last = aqueducts[aqueducts.length - 1];
    if (last.water > .15 && inBasin(last.x, last.y) < 1) {
        const amount = Math.min(last.water, dt * .25);
        last.water -= amount;
        basinWater = Math.min(100, basinWater + amount * 12);
    }
}

// ---------- Player and occlusion ----------

function isPlayerOccluded() {
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const playerHeight = terrainHeight(player.x, player.y);

    // Check cells immediately in front of the player. If a higher voxel wall
    // would cover the character, draw the character as a translucent silhouette.
    for (let ox = -1; ox <= 1; ox++) {
        const x = px + ox;
        const y = py + 1;
        if (!isInsideWorld(x, y)) continue;
        if (terrainHeight(x, y) > playerHeight + 5) return true;
    }
    return false;
}

function renderPlayer() {
    const elevation = terrainHeight(player.x, player.y);
    const p = project(player.x, player.y, elevation);
    const z = camera.zoom;
    const occluded = isPlayerOccluded();
    const swing = player.moving ? Math.sin(player.walkTime) * .58 : 0;
    const armSwing = player.moving ? Math.sin(player.walkTime) * .38 : 0;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = occluded ? .42 : 1;

    // Shadow
    ctx.fillStyle = occluded ? "#d9f0ed" : "#17221c66";
    ctx.beginPath();
    ctx.ellipse(0, 0, .55 * z, .22 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // When hidden behind higher ground, use a solid light silhouette.
    const color = occluded ? "#e8f5e9" : "#202725";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.5, .17 * z);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Head
    ctx.beginPath();
    ctx.arc(0, -2.65 * z, .36 * z, 0, Math.PI * 2);
    if (occluded) ctx.fill();
    else ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(0, -2.28 * z);
    ctx.lineTo(0, -1.05 * z);
    ctx.stroke();

    // Arms
    ctx.beginPath();
    ctx.moveTo(0, -2.08 * z);
    ctx.lineTo(-.53 * z, (-1.55 + armSwing) * z);
    ctx.moveTo(0, -2.08 * z);
    ctx.lineTo(.53 * z, (-1.55 - armSwing) * z);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(0, -1.05 * z);
    ctx.lineTo(Math.sin(player.walkTime) * .48 * z, 0);
    ctx.moveTo(0, -1.05 * z);
    ctx.lineTo(-Math.sin(player.walkTime) * .48 * z, 0);
    ctx.stroke();

    ctx.restore();
}

function renderSpawnAndBasin() {
    const b = project(basin.x, basin.y, terrainHeight(basin.x, basin.y));
    ctx.fillStyle = "#574d37";
    ctx.font = `bold ${Math.max(10, camera.zoom * 1.45)}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("EMPTY BASIN", b.x, b.y - camera.zoom * 2);

    const s = project(spawn.x, spawn.y, terrainHeight(spawn.x, spawn.y));
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(2, camera.zoom * .22), 0, Math.PI * 2);
    ctx.fill();
}

// ---------- Camera / movement ----------

function updatePlayer(dt) {
    let dx = 0, dy = 0;
    if (keys.w || keys.arrowup) dy--;
    if (keys.s || keys.arrowdown) dy++;
    if (keys.a || keys.arrowleft) dx--;
    if (keys.d || keys.arrowright) dx++;

    player.moving = dx !== 0 || dy !== 0;
    if (player.moving) {
        const length = Math.hypot(dx, dy);
        dx /= length;
        dy /= length;
        player.x += dx * player.speed * dt;
        player.y += dy * player.speed * dt;
        player.walkTime += dt * 10;
    }

    player.x = Math.max(1, Math.min(WORLD.width - 2, player.x));
    player.y = Math.max(1, Math.min(WORLD.height - 2, player.y));

    // Camera tracks the player's world position and elevation.
    // Projection therefore puts the player's feet exactly at screen centre.
    camera.x = player.x;
    camera.y = player.y;
    camera.elevation = terrainHeight(player.x, player.y);
}

// ---------- Inventory UI ----------

const inventoryPanel = document.getElementById("inventory");
const pipeCount = document.getElementById("pipeCount");
const directionText = document.getElementById("selectedDirection");
const placeButton = document.getElementById("placeButton");

function toggleInventory(force) {
    const open = force === undefined
        ? !inventoryPanel.classList.contains("open")
        : force;
    inventoryPanel.classList.toggle("open", open);
}

function updateInventoryUI() {
    pipeCount.textContent = inventory.pipes;
    placeButton.disabled = inventory.pipes < 1;
    directionText.textContent = `Direction: ${directions[selectedDirection].name}`;
    document.querySelectorAll("[data-dir]").forEach(button => {
        button.classList.toggle("active", Number(button.dataset.dir) === selectedDirection);
    });
}

document.getElementById("inventoryToggle").addEventListener("click", () => toggleInventory());
document.getElementById("closeInventory").addEventListener("click", () => toggleInventory(false));
placeButton.addEventListener("click", placeAqueduct);

document.querySelectorAll("[data-dir]").forEach(button => {
    button.addEventListener("click", () => {
        selectedDirection = Number(button.dataset.dir);
        updateInventoryUI();
    });
});

function showToast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1500);
}

// ---------- Input ----------

window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();

    if (key === "i" && !e.repeat) toggleInventory();
    if (key === "escape") toggleInventory(false);
    keys[key] = true;
});

window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("wheel", e => {
    e.preventDefault();
    camera.zoom *= e.deltaY < 0 ? 1.12 : .89;
    camera.zoom = Math.max(3, Math.min(14, camera.zoom));
}, { passive: false });

// ---------- Main loop ----------

function render() {
    renderTerrain();
    renderBasinWater();
    renderWaterSources();
    renderAqueducts();
    renderSpawnAndBasin();
    renderPlayer();

    document.getElementById("coordinates").textContent =
        `X: ${player.x.toFixed(1)} | Y: ${player.y.toFixed(1)}`;
}

function update(timestamp = 0) {
    const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .05) : 0;
    lastFrame = timestamp;

    updatePlayer(dt);
    updateFluid(dt);
    render();

    requestAnimationFrame(update);
}

updateInventoryUI();
update();
