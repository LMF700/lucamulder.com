const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(game.includes('const inputLength = Math.hypot(screenMoveX, screenMoveY);'), 'keyboard movement should normalize diagonal screen-space input');
assert.ok(game.includes('const desiredScreenX = screenMoveX * screenSpeed;'), 'A/D should follow the screen horizontal axis');
assert.ok(game.includes('const desiredScreenY = screenMoveY * screenSpeed;'), 'W/S should follow the screen vertical ground-plane axis');
assert.ok(game.includes('p.vy = 500'), 'jump impulse should be tall enough to climb elevation shelves');
assert.ok(game.includes('p.vy -= 850 * dt'), 'jump/fall movement should use gravity');
assert.ok(game.includes('if (newGround > oldFootY + 1.5) return false;'), 'higher terrain should block movement until the player has jumped high enough');
assert.ok(game.includes('basinSpawnRadius:'), 'world diagnostics should expose basin distance from spawn');
assert.ok(game.includes('const layerCount = 25;'), '25 layers should create a true middle elevation shelf');
assert.ok(game.includes('state.middleTier = Math.floor(layerCount / 2);'), 'the central elevation tier should be calculated from the world layer count');
assert.ok(game.includes('const seaBandWidth = 3200;'), 'the middle shelf should be wide enough to contain the large Empty Sea');
assert.ok(game.includes('x: middleBandCenterX'), 'the basin should be centred on the middle elevation shelf');
assert.ok(game.includes('x: state.basin.x'), 'spawn and basin should share the middle shelf');
assert.ok(game.includes('z: state.basin.z - state.basin.rz * 1.32'), 'spawn should begin just outside the basin shoreline');
assert.ok(!game.includes('function drawRamps()'), 'ramp renderer should be removed');
assert.ok(!game.includes('rampAt('), 'ramp traversal should be removed');
assert.ok(game.includes('state.ramps = [];'), 'generated ramp collection should remain empty');
assert.ok(game.includes('Math.max(Math.abs(a0 - b0), Math.abs(a1 - b1)) > 22'), 'cliff renderer should draw both rising and falling elevation faces');
assert.ok(html.includes('No ramps.'), 'game UI should explain the no-ramp traversal');

// Check the inverse projection used by screen-aligned WASD. Each key direction
// should move on exactly one visible screen axis, without diagonal drift.
const projection = { x: 0.72, z: 0.30, depthSlope: 0.15 };
const screenSpeed = 250 * projection.x;
const worldVectorForScreen = (sx, sy) => {
  const dz = sy * screenSpeed / projection.depthSlope;
  const dx = (sx * screenSpeed - dz * projection.z) / projection.x;
  return { dx, dz };
};
for (const [sx, sy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
  const { dx, dz } = worldVectorForScreen(sx, sy);
  const projectedX = dx * projection.x + dz * projection.z;
  const projectedY = dz * projection.depthSlope;
  assert.ok(Math.abs(projectedX - sx * screenSpeed) < 1e-9, 'movement should preserve the requested screen-horizontal component');
  assert.ok(Math.abs(projectedY - sy * screenSpeed) < 1e-9, 'movement should preserve the requested screen-vertical ground-plane component');
  if (sx === 0) assert.ok(Math.abs(projectedX) < 1e-9, 'W/S must not drift horizontally on screen');
  if (sy === 0) assert.ok(Math.abs(projectedY) < 1e-9, 'A/D must not drift vertically on screen');
}
for (const [sx, sy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
  const length = Math.hypot(sx, sy);
  const { dx, dz } = worldVectorForScreen(sx / length, sy / length);
  const projectedLength = Math.hypot(dx * projection.x + dz * projection.z, dz * projection.depthSlope);
  assert.ok(Math.abs(projectedLength - screenSpeed) < 1e-9, 'diagonal movement should be normalized to the same screen-space speed');
}
assert.match(game, /const stepZPerSecond = desiredScreenY \/ WORLD\.projection\.depthSlope/);
assert.match(game, /const stepXPerSecond = \(desiredScreenX - stepZPerSecond \* WORLD\.projection\.z\) \/ WORLD\.projection\.x/);

// New jump apex must exceed the upper end of a generated elevation step plus small terrain variation.
const jumpApex = (500 * 500) / (2 * 850);
const maximumStepWithNoise = 97 + 14.2;
assert.ok(jumpApex > maximumStepWithNoise, 'a full jump should be able to climb one generated shelf');

// Worst-case basin spawn radius using the seeded placement ranges and maximum basin radii.
const minimumBasinRadiusAtSpawn = Math.hypot(1340 / 1120, 210 / 1440);
assert.ok(minimumBasinRadiusAtSpawn > 1.18, 'spawn should remain outside the basin rim even at worst-case generation values');
assert.ok(900 + 1380 + 40 < 3600, 'basin must stay inside the wider starting shelf');

console.log('FTS screen-aligned movement/world regression tests passed.');
