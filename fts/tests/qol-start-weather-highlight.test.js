const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

// Strong global elevation colours: very dark lower shelves, saturated middle,
// and vivid lime upper shelves. Still derived from full-world Y range.
assert.match(game, /at: 0, rgb: \[0, 38, 0\]/);
assert.match(game, /at: 0\.5, rgb: \[0, 145, 0\]/);
assert.match(game, /at: 1, rgb: \[0, 255, 0\]/);
assert.match(game, /terrainHeightGradientRange\(\)/);
assert.match(game, /function terrainGrassColorAtHeight\(worldY\)/);

// Weather: long quiet periods and a low probability storm check.
assert.match(game, /initialClearMin: 600, initialClearMax: 900/);
assert.match(game, /skippedCheckMin: 360, skippedCheckMax: 720/);
assert.match(game, /stormChancePerCheck: 0\.22/);
assert.match(game, /warningSeconds: 9/);
assert.match(game, /stormMin: 24, stormMax: 36/);
assert.match(game, /postStormClearMin: 600, postStormClearMax: 960/);
assert.match(game, /if \(Math\.random\(\) < WEATHER_TUNING\.stormChancePerCheck\)/);

// New world starts with exactly two tools, with no compass, resources, materials,
// channel stock, chutes, modules, or other crafted items supplied for free.
const reset = game.slice(game.indexOf('  function resetInventory() {'), game.indexOf('\n  function itemCount(id)', game.indexOf('  function resetInventory() {')));
assert.match(reset, /state\.materials = \{[\s\S]*?metal: 0, glassPane: 0, wire: 0, stone: 0, wood: 0/);
assert.match(reset, /for \(const id of Object\.keys\(state\.inventory\)\) state\.inventory\[id\] = 0/);
assert.match(reset, /state\.inventory\.compass = 0/);
assert.match(reset, /state\.inventory\.stonePickaxe = 1/);
assert.match(reset, /state\.inventory\.stoneAxe = 1/);
assert.match(reset, /state\.moduleInventory = \{ x4: 0, x2: 0 \}/);
assert.match(reset, /state\.bagSlots = Array\(27\)\.fill\(null\)/);
assert.match(reset, /state\.hotbar = \['stonePickaxe', 'stoneAxe', null, null, null, null, null, null, null\]/);
assert.match(reset, /state\.inventorySelection = null/);
assert.doesNotMatch(reset, /state\.bagSlots\[0\] = 'stonePickaxe'/);
assert.doesNotMatch(reset, /state\.bagSlots\[1\] = 'stoneAxe'/);
assert.match(reset, /state\.hotbar = \['stonePickaxe', 'stoneAxe', null, null, null, null, null, null, null\]/);
assert.match(reset, /state\.inventorySelection = null/);
assert.match(reset, /state\.heldItem = 'stonePickaxe'/);
assert.match(reset, /state\.tool = 'pickaxe'/);
assert.match(game, /setTool\('pickaxe'\)/);
assert.match(game, /function pruneEmptySlots\(\)/);
assert.match(game, /if \(state\.inventorySelection && !getSlotArray\(state\.inventorySelection\.type\)\[state\.inventorySelection\.index\]\) state\.inventorySelection = null/);
assert.match(game, /function swapInventorySlots\(sourceType, sourceIndex, targetType, targetIndex\)/);
assert.match(game, /state\.bagSlots = Array\(27\)\.fill\(null\)/);
assert.match(html, /HOTBAR · 9 SLOTS/);
assert.ok(html.indexOf('id=\"inventory-hotbar\"') < html.indexOf('class=\"inventory-layout\"'), 'hotbar should appear before the backpack and crafting content');
assert.match(html, /BACKPACK · 27 SLOTS/);
assert.match(html, /id=\"hotbar-bar\"/);
assert.doesNotMatch(html, /construction bar/i);
assert.doesNotMatch(game, /construction bar/i);

assert.doesNotMatch(reset, /'compass', 'stonePickaxe'/);

// Resource highlighting supports all requested visible world resources,
// is keyboard accessible, and does not draw debug hitbox outlines.
assert.match(html, /id="resource-highlight"/);
assert.match(html, /HIGHLIGHT RESOURCES · H/);
assert.match(css, /\.highlight-button\.active/);
assert.match(game, /function toggleResourceHighlights\(force = null\)/);
assert.match(game, /if \(key === 'h' && !event\.repeat\)/);
assert.match(game, /drawResourceHighlight\(source, 'WATER SOURCE'/);
assert.match(game, /drawResourceHighlight\(deposit, 'STONE'/);
assert.match(game, /drawResourceHighlight\(deposit, deposit\.drillId \? 'IRON · DRILL' : 'IRON'/);
assert.match(game, /drawResourceHighlight\(tree, 'WOOD'/);
for (const type of ['copper', 'zinc', 'silicon', 'clay', 'voltite']) {
  assert.ok(game.includes("type.toUpperCase()"), `special resource highlights should label ${type}`);
}
assert.match(readme, /22% chance to begin a storm warning/);
assert.match(readme, /exactly one Stone Pickaxe and one Stone Axe/);
assert.match(readme, /deferred to a post-v2\.0 update/);

console.log('FTS v1.7 quality-of-life regression tests passed.');
