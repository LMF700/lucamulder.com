
const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = 3000;
const TICK_RATE = 30;

const PLAYER_SIZE = 28;
const MOVE_SPEED = 220;
const GRAVITY = 1200;
const JUMP_SPEED = 460;
const MAX_FALL_SPEED = 750;

const ATTACK_RANGE = 65;
const ATTACK_DAMAGE = 25;
const ATTACK_COOLDOWN = 450;
const ATTACK_DURATION = 180;
const RESPAWN_DELAY = 2000;

const ROOT = path.join(__dirname, "public");

const platforms = [
    { x: 0, y: 420, width: 800, height: 30 },
    { x: 100, y: 340, width: 160, height: 18 },
    { x: 340, y: 280, width: 150, height: 18 },
    { x: 560, y: 340, width: 150, height: 18 }
];

const players = new Map();
let nextPlayerId = 1;

const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav"
};

const server = http.createServer((req, res) => {
    let pathname;

    try {
        pathname = decodeURIComponent(
            new URL(req.url, "http://localhost").pathname
        );
    } catch {
        res.writeHead(400);
        res.end("Bad request");
        return;
    }

    if (pathname === "/") pathname = "/main.html";

    const filePath = path.resolve(ROOT, "." + pathname);

    if (
        filePath !== ROOT &&
        !filePath.startsWith(ROOT + path.sep)
    ) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end("File not found");
            return;
        }

        res.writeHead(200, {
            "Content-Type":
                mimeTypes[path.extname(filePath).toLowerCase()] ||
                "application/octet-stream"
        });

        res.end(data);
    });
});

const wss = new WebSocket.Server({ server });

function broadcastState() {
    const message = JSON.stringify({
        type: "state",
        players: Array.from(players.values(), p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            grounded: p.grounded,
            health: p.health,
            alive: p.alive,
            facing: p.facing,
            attacking: Date.now() < p.attackingUntil
        })),
        platforms
    });

    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function spawnPlayer(player) {
    player.x = 30 + Math.random() * 700;
    player.y = 100;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.health = 100;
    player.alive = true;
    player.respawnAt = 0;
    player.jumpQueued = false;
    player.attackingUntil = 0;
    player.hitPlayers = new Set();

    player.input = {
        left: false,
        right: false,
        jump: false
    };
}

wss.on("connection", socket => {
    const player = {
        id: nextPlayerId++,
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        grounded: false,
        health: 100,
        alive: true,
        facing: 1,
        respawnAt: 0,
        jumpQueued: false,
        attackCooldownUntil: 0,
        attackingUntil: 0,
        hitPlayers: new Set(),
        input: {
            left: false,
            right: false,
            jump: false
        }
    };

    spawnPlayer(player);
    players.set(socket, player);

    console.log(`Player ${player.id} connected.`);

    socket.send(JSON.stringify({
        type: "welcome",
        playerId: player.id
    }));

    broadcastState();

    socket.on("message", rawMessage => {
        try {
            const message = JSON.parse(rawMessage.toString());

            if (message.type === "input") {
                if (!player.alive) return;

                if (
                    typeof message.left === "boolean" &&
                    typeof message.right === "boolean" &&
                    typeof message.jump === "boolean"
                ) {
                    player.input.left = message.left;
                    player.input.right = message.right;

                    if (message.left !== message.right) {
                        player.facing = message.left ? -1 : 1;
                    }

                    if (message.jump && !player.input.jump) {
                        player.jumpQueued = true;
                    }

                    player.input.jump = message.jump;
                }

                return;
            }

            if (message.type === "attack") {
                const now = Date.now();

                if (!player.alive) return;
                if (now < player.attackCooldownUntil) return;

                player.attackCooldownUntil =
                    now + ATTACK_COOLDOWN;
                player.attackingUntil = now + ATTACK_DURATION;
                player.hitPlayers = new Set();

                // The server decides which attacks hit.
                for (const target of players.values()) {
                    if (target === player || !target.alive) continue;
                    if (player.hitPlayers.has(target.id)) continue;

                    const dx =
                        (target.x + PLAYER_SIZE / 2) -
                        (player.x + PLAYER_SIZE / 2);

                    const dy =
                        (target.y + PLAYER_SIZE / 2) -
                        (player.y + PLAYER_SIZE / 2);

                    const inFront = dx * player.facing >= 0;
                    const inRange = Math.abs(dx) <= ATTACK_RANGE;
                    const sameHeight = Math.abs(dy) <= 42;

                    if (inFront && inRange && sameHeight) {
                        target.health -= ATTACK_DAMAGE;
                        target.vx = player.facing * 260;
                        target.vy = -180;
                        target.grounded = false;

                        player.hitPlayers.add(target.id);

                        console.log(
                            `Player ${player.id} hit Player ${target.id}. ` +
                            `HP: ${target.health}`
                        );

                        if (target.health <= 0) {
                            target.health = 0;
                            target.alive = false;
                            target.respawnAt =
                                now + RESPAWN_DELAY;

                            target.input = {
                                left: false,
                                right: false,
                                jump: false
                            };

                            console.log(
                                `Player ${target.id} was defeated.`
                            );
                        }
                    }
                }

                broadcastState();
            }
        } catch {
            // Ignore malformed messages.
        }
    });

    socket.on("close", () => {
        players.delete(socket);
        console.log(`Player ${player.id} disconnected.`);
        broadcastState();
    });

    socket.on("error", error => {
        console.error(`Player ${player.id}:`, error.message);
    });
});

function overlaps(player, platform) {
    return (
        player.x < platform.x + platform.width &&
        player.x + PLAYER_SIZE > platform.x &&
        player.y < platform.y + platform.height &&
        player.y + PLAYER_SIZE > platform.y
    );
}

function updatePlayer(player, dt) {
    if (!player.alive) return;

    player.vx =
        (Number(player.input.right) -
         Number(player.input.left)) * MOVE_SPEED;

    if (player.jumpQueued && player.grounded) {
        player.vy = -JUMP_SPEED;
        player.grounded = false;
    }

    player.jumpQueued = false;

    // Horizontal movement and side collisions.
    player.x += player.vx * dt;

    for (const platform of platforms) {
        if (!overlaps(player, platform)) continue;

        if (player.vx > 0) {
            player.x = platform.x - PLAYER_SIZE;
        } else if (player.vx < 0) {
            player.x = platform.x + platform.width;
        }
    }

    player.x = Math.max(
        0,
        Math.min(800 - PLAYER_SIZE, player.x)
    );

    // Vertical movement and collisions.
    player.vy = Math.min(
        player.vy + GRAVITY * dt,
        MAX_FALL_SPEED
    );

    player.y += player.vy * dt;
    player.grounded = false;

    for (const platform of platforms) {
        if (!overlaps(player, platform)) continue;

        if (player.vy > 0) {
            player.y = platform.y - PLAYER_SIZE;
            player.vy = 0;
            player.grounded = true;
        } else if (player.vy < 0) {
            player.y = platform.y + platform.height;
            player.vy = 0;
        }
    }

    if (player.y < 0) {
        player.y = 0;
        player.vy = 0;
    }
}

let previousTime = Date.now();

setInterval(() => {
    const now = Date.now();
    const dt = Math.min((now - previousTime) / 1000, 0.05);
    previousTime = now;

    for (const player of players.values()) {
        if (!player.alive) {
            if (now >= player.respawnAt) {
                spawnPlayer(player);
                console.log(`Player ${player.id} respawned.`);
            }

            continue;
        }

        updatePlayer(player, dt);
    }

    broadcastState();
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
    console.log(`SW server running at http://localhost:${PORT}`);
});
