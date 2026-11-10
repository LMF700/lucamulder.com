const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');

// Drawing and hit-testing must share the same sprite sizing, aspect-ratio and
// bottom-centre anchor calculations. This prevents clicks landing below/above
// 32x32 (or larger) artwork when sprites are scaled in-world.
assert.match(game, /function worldAssetGeometry\(/, 'shared sprite geometry helper should exist');
assert.match(game, /function drawWorldAsset\([\s\S]*?worldAssetGeometry\(/, 'sprite drawing must use shared geometry');
assert.match(game, /function getResourceScreenBounds\([\s\S]*?worldAssetGeometry\('resources', key/, 'stone and iron sprite hitboxes should use their real rendered rectangles');
assert.match(game, /worldAssetGeometry\('resources', 'tree'/, 'tree hitboxes should use the actual rendered sprite rectangle');
assert.match(game, /worldAssetGeometry\('resources', `\$\{subtype\}Deposit`/, 'special deposit hitboxes should use actual rendered sprite rectangles');
assert.match(game, /worldAssetGeometry\('resources', 'waterSource'/, 'water source hitboxes should use actual rendered sprite rectangles');

// Fallback vector resource hitboxes must cover the complete drawn geometry,
// not just a small radius around a misleading anchor point.
assert.match(game, /return makeScreenBounds\(c\.x - size, c\.y - size, c\.x \+ size, c\.y \+ 7, 7\)/, 'stone and iron fallback hitboxes should cover their visible rocks');
assert.match(game, /Math\.max\(top\.y \+ size \* 0\.9, trunk\.y \+ 7\)/, 'tree fallback hitbox should include canopy and trunk');
assert.match(game, /function boundsHitScore\([\s\S]*?bounds\.left[\s\S]*?bounds\.bottom/, 'pointer hits should be tested against the rendered bounds');

// All gather/place tools should route through a shared, nearest-visible hit test.
assert.match(game, /function findResourceInList\(/, 'shared resource picker should exist');
assert.match(game, /function findStoneHit\(mx, my\)\s*\{\s*return findResourceInList\(state\.stoneDeposits, 'stone', mx, my\);/, 'stone mining should use shared hit testing');
assert.match(game, /function findIronHit\(mx, my\)\s*\{\s*return findResourceInList\(state\.ironDeposits, 'iron', mx, my\);/, 'drill placement should use shared hit testing');
assert.match(game, /function findTreeHit\(mx, my\)\s*\{\s*return findResourceInList\(state\.trees, 'tree', mx, my\);/, 'tree chopping should use shared hit testing');
assert.match(game, /function findResourceInList\([\s\S]*?for \(const resource of list\) \{[\s\S]*?const bounds = getResourceScreenBounds\(kind, resource, subtype\);/, 'resource picking should check projected bounds for the full world list, not a player-centred radius');
assert.doesNotMatch(game.match(/function findResourceInList\([\s\S]*?\n  function findStoneHit/)[0], /isNearCamera|worldDistance/, 'resource picking itself must not be restricted by camera/player radius');
assert.match(game, /function findSpecialDepositHit\([\s\S]*?if \(deposit\.remaining <= 0\) continue;/, 'special deposits should be picked by screen bounds regardless of player distance');
assert.match(game, /function findSourceScreenHit\([\s\S]*?getResourceScreenBounds\('source'/, 'source interaction should use the same rendered bounds');

// Hit testing helpers are exposed for browser regression tests. No visible debug outlines are part of the game.
assert.match(game, /getResourceScreenBounds: \(kind, resource, subtype = null\) =>/, 'resource bounds should be inspectable');
assert.match(game, /hitTestResource: \(kind, resource, screenX, screenY, subtype = null\) => boundsHitScore\([\s\S]*?\) < Infinity/, 'screen-space resource hit testing should be inspectable');

function hitScore(bounds, x, y) {
  if (!bounds || x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return Infinity;
  const rx = Math.max(1, (bounds.right - bounds.left) / 2);
  const ry = Math.max(1, (bounds.bottom - bounds.top) / 2);
  const nx = (x - bounds.centerX) / rx;
  const ny = (y - bounds.centerY) / ry;
  return nx * nx + ny * ny;
}
const sample = { left: 100, top: 120, right: 180, bottom: 220, centerX: 140, centerY: 170 };
assert.equal(hitScore(sample, 140, 170), 0, 'resource centre should be hittable');
assert.ok(Number.isFinite(hitScore(sample, 102, 122)), 'visible sprite corners should be hittable');
assert.equal(hitScore(sample, 190, 170), Infinity, 'clicks clearly outside sprite bounds should miss');

console.log('FTS resource hitbox regression tests passed.');

assert.doesNotMatch(game, /function drawResourceHitboxes|showResourceHitboxes|key === 'f3'/, 'resource hitbox debug outlines must not be implemented');
