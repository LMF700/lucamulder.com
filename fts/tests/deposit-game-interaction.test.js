const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const industryUI = fs.readFileSync(path.join(__dirname, '..', 'systems', 'industry-ui.js'), 'utf8');
assert.match(game, /function findAnyMineableDepositHit\(/, 'pickaxe uses one hit picker for every mineral deposit');
assert.match(game, /for \(const deposit of state\.stoneDeposits\) consider\('stone', 'stone'/, 'stone deposits are hand mineable');
assert.match(game, /for \(const deposit of state\.ironDeposits\) consider\('iron', 'ironOre'/, 'iron deposits are hand mineable');
for (const type of ['copper', 'zinc', 'silicon', 'clay', 'voltite']) {
  assert.ok(game.includes(`${type}: '${type === 'copper' ? 'copperOre' : type === 'zinc' ? 'zincOre' : type}'`), `${type} maps to a collectible item`);
}
assert.match(game, /if \(!giveItem\(item, mined\)\) \{ showToast\('Inventory full/, 'mining does not remove deposit stock when inventory is full');
assert.match(game, /findDepositAt: \(x, z\) => findMineableDepositAt\(x, z, 230\)/, 'Drill placement can target any mineral deposit');
assert.match(game, /if \(state\.machineToPlace === 'drill'\) \{[\s\S]*?findAnyMineableDepositHit\(mx, my\)/, 'Drill placement selects the exact clicked deposit sprite');
assert.match(game, /const machinePlacementTools = \['machine','belt','shaftLink','powerLink','moltenLink'/, 'machine collection does not override placement/link interactions');
assert.match(game, /collectAllOutput\(machineHit\.id\)/, 'left-clicking a machine collects its output');
assert.match(industryUI, /data-action=\"take-all\"/, 'machine inspector also provides a Collect All button');
console.log('FTS hand-mining and universal machine collection interaction tests passed.');
