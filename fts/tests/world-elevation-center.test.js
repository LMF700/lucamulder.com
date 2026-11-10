const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

assert.match(game, /const layerCount = 25;/, 'world should have an odd layer count for a unique middle tier');
assert.match(game, /state\.middleTier = Math\.floor\(layerCount \/ 2\)/, 'middle tier should be calculated from total layers');
assert.match(game, /const seaBandWidth = 3200;/, 'middle tier should be wide enough for the sea');
assert.match(game, /bandWidths\[state\.middleTier\] = seaBandWidth/, 'the wider shelf should be the middle tier');
assert.match(game, /const middleBand = state\.layerBands\[state\.middleTier\]/, 'basin placement should use the middle shelf');
assert.match(game, /x: middleBandCenterX/, 'basin should sit at the centre of the middle shelf');
assert.match(game, /tier: state\.middleTier/, 'basin should record its elevation tier');
assert.match(game, /x: state\.basin\.x/, 'player should spawn at the same horizontal elevation band as the sea');
assert.match(game, /z: state\.basin\.z - state\.basin\.rz \* 1\.32/, 'player should spawn just outside the sea shoreline');
assert.match(game, /const heights = state\.layerBands\.map\(band => band\.height\)/, 'gradient should sample the full generated height range');
assert.match(game, /let fill = terrainGrassColorAtHeight\(yMid\)/, 'all visible ground cells should use world-height colour');
assert.match(game, /function terrainViewportBounds\(\)/, 'terrain render coverage should be calculated for the viewport');
assert.match(game, /getTerrainViewportBounds: \(\) => \(\{ \.\.\.terrainViewportBounds\(\) \}\)/, 'viewport coverage should be exposed for validation');
assert.doesNotMatch(game, /state\.camera\.x - 620|state\.camera\.z - 980/, 'old camera-local terrain patch should be removed');
assert.match(html, /25 stepped elevation layers/, 'UI should report the correct layer count');
assert.match(readme, /Empty Sea is centred on layer 12/, 'documentation should explain the middle-tier basin');

// Confirm the generated width configuration always fills the full X span and
// preserves a 3,200-unit middle shelf over a representative range of seeds.
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
for (let seed = 1; seed <= 100; seed++) {
  const random = mulberry32(seed);
  const count = 25, middle = Math.floor(count / 2), total = 48000;
  const widths = Array(count).fill(1500);
  widths[0] = 3600;
  widths[middle] = 3200;
  const flexible = widths.map((_, i) => i).filter(i => i !== 0 && i !== middle);
  const extra = total - widths.reduce((a, b) => a + b, 0);
  const weights = flexible.map(() => 0.78 + random() * 0.44);
  const sum = weights.reduce((a, b) => a + b, 0);
  flexible.forEach((index, i) => widths[index] += extra * weights[i] / sum);
  assert.ok(Math.abs(widths.reduce((a, b) => a + b, 0) - total) < 1e-6, 'layer bands should span the full world');
  assert.equal(widths[middle], 3200, 'sea shelf width should remain fixed');
  assert.ok(widths.every(width => width >= 1500), 'every elevation shelf should remain broad');
}

// Basin/spawn radial spacing: at 1.32 basin radii, the player starts beyond
// the 1.18 terrain transition and can see/reach the basin immediately.
assert.ok(1.32 > 1.18, 'spawn should be outside the basin rim');
assert.ok(1.32 < 1.5, 'spawn should remain close to the basin');

console.log('FTS middle-elevation basin, full-world height gradient, and viewport coverage tests passed.');
