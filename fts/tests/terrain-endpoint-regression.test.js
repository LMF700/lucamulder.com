const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');

// Grass colour must follow actual world Y, not layer index, X position,
// camera position, or distance from the player. Soil retains layer-based shading.
assert.match(game, /function terrainGrassColorAtHeight\(worldY\)/, 'terrain grass gradient should be world-height based');
assert.match(game, /let fill = terrainGrassColorAtHeight\(yMid\)/, 'surface cells should shade from actual terrain height');
assert.match(game, /soilTop: `rgb\(\$\{channel\(66, 150\)\}/, 'exposed soil should shade with geological elevation');
assert.doesNotMatch(game, /terrainVisualTierAt|grassGradient|createRadialGradient/, 'old shelf-index or local radial grass shading must not remain');
assert.match(game, /ctx\.strokeStyle = fill;\s*ctx\.lineWidth = 1\.25;[\s\S]*ctx\.stroke\(\)/, 'terrain quad seams should be hidden with same-colour overlap');

// The endpoint workflow must support existing connection helpers and free
// terrain locations. Both mouse-down (start) and mouse-up (finish) use it.
assert.match(game, /function findChannelEndpointCandidate\(mx, my\)/, 'channel endpoint resolver should exist');
assert.match(game, /return \{ free: \{ x: point\.x, z: point\.z, y: terrainHeight\(point\.x, point\.z\) \+ 18 \} \}/, 'any terrain click should be eligible as a free endpoint');
assert.match(game, /function materializeChannelEndpoint\(candidate\)/, 'free and snapped endpoints should materialize consistently');
assert.match(game, /return createNode\('junction', candidate\.free\.x, candidate\.free\.y, candidate\.free\.z\)/, 'free endpoints should become reusable junction nodes');
assert.match(game, /const candidate = findChannelEndpointCandidate\(mx, my\);\s*const node = materializeChannelEndpoint\(candidate\);\s*if \(node && node\.id !== state\.anchorNodeId\) completeChannel/, 'mouse-up should complete to a free endpoint');
assert.match(game, /const candidate = findChannelEndpointCandidate\(mx, my\);\s*const node = materializeChannelEndpoint\(candidate\);\s*if \(node\) \{\s*state\.anchorNodeId = node\.id/s, 'mouse-down should allow a free starting endpoint');
assert.match(game, /Yellow dots are optional connection helpers/, 'instructions should describe dots as optional helpers');
assert.match(game, /const cost = targetWorld\s*\? channelCost\(a, targetWorld, state\.channelType\)/, 'preview should calculate material cost from world coordinates');

console.log('FTS terrain-shading and free-channel-endpoint regression tests passed.');
