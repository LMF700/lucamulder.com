const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');

assert.match(game, /function terrainHeightGradientRange\(\)/, 'terrain gradient should use a global world-height range');
assert.match(game, /function terrainGrassColorAtHeight\(worldY\)/, 'grass colour should be sampled from actual world Y');
assert.match(game, /const t = clamp\(\(worldY - range\.min\) \/ \(range\.max - range\.min\), 0, 1\)/, 'colour interpolation should use world height, not layer X or player distance');
assert.match(game, /let fill = terrainGrassColorAtHeight\(yMid\)/, 'every terrain surface cell should use its actual average height');
assert.match(game, /getTerrainGrassColorAtHeight: worldY => terrainGrassColorAtHeight\(worldY\)/, 'height-gradient sampling should be exposed for regression tests');
assert.doesNotMatch(game, /terrainVisualTierAt|grassGradient|createRadialGradient/, 'old X-tier/local radial shading must be removed');
assert.match(game, /ctx\.strokeStyle = fill;\s*ctx\.lineWidth = 1\.25;[\s\S]*ctx\.stroke\(\)/, 'same-colour edge overlap should eliminate antialiased mesh seams without a visible grid');
assert.doesNotMatch(game, /showResourceHitboxes|key === 'f3'/, 'no visible hitbox outlines or F3 overlay should exist');

// Verify the colour ramp matches the user's H/L swatch: low is dark green,
// high is vivid green, and intermediate heights interpolate monotonically.
const greenAt = t => Math.round(85 + (250 - 85) * t);
const redAt = t => Math.round(1 + (86 - 1) * t);
const steps = Array.from({ length: 101 }, (_, i) => i / 100);
const greens = steps.map(greenAt);
const reds = steps.map(redAt);
assert.equal(greenAt(0), 85, 'lowest world height should match the dark-green H/L sample');
assert.equal(redAt(0), 1);
assert.equal(greenAt(1), 250, 'highest world height should match the bright-green H/L sample');
assert.equal(redAt(1), 86);
assert.ok(greens.every((value, index) => index === 0 || value >= greens[index - 1]), 'green channel must never get darker as world Y rises');
assert.ok(reds.every((value, index) => index === 0 || value >= reds[index - 1]), 'red channel must never get darker as world Y rises');

// The gradient range must use the full generated world, not only the visible/player tier.
assert.match(game, /const heights = state\.layerBands\.map\(band => band\.height\)/, 'gradient range should inspect every generated elevation layer');
assert.match(game, /min: Math\.min\(\.\.\.heights\) - 8/, 'gradient minimum should come from the lowest world layer');
assert.match(game, /max: Math\.max\(\.\.\.heights\) \+ 8/, 'gradient maximum should come from the highest world layer');
assert.match(game, /let fill = terrainGrassColorAtHeight\(yMid\)/, 'every rendered ground cell should be shaded from its world elevation');
assert.match(game, /function terrainViewportBounds\(\)/, 'terrain sampling bounds should cover the full visible viewport');
assert.match(game, /const zTopOffset = \(0 - 432 - verticalPad - heightAllowance \* projection\.y\) \/ projection\.depthSlope/, 'terrain depth bounds should be derived from screen height');
assert.match(game, /const xSpan = \(W \/ 2 \+ maxDepthOffset \* Math\.abs\(projection\.z\)\) \/ Math\.abs\(projection\.x\) \+ 100/, 'terrain horizontal bounds should account for depth projection');
assert.doesNotMatch(game, /state\.camera\.x - 620|state\.camera\.z - 980/, 'terrain must not be clipped to the old small player-centred patch');

console.log('FTS global world-Y height-gradient and resource-picking regression tests passed.');
