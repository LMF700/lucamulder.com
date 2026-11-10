const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const industry = fs.readFileSync(path.join(root, 'systems/industry-engine.js'), 'utf8');

assert.match(game, /const MAX_STACK_SIZE = 64/);
assert.match(game, /bagSlotCounts: Array\(27\)\.fill\(0\)/);
assert.match(game, /hotbarCounts: Array\(9\)\.fill\(0\)/);
assert.match(game, /function addItemToBag\(id, amount = 1\)/);
assert.match(game, /for \(const type of \['hotbar'\]\)/);
assert.match(game, /function moveInventoryStack\(sourceSlot, targetSlot\)/);
assert.match(game, /function distributeInventoryStack\(sourceSlot, targets\)/);
assert.match(game, /function consumeItem\(id, amount = 1\)/);
assert.match(game, /state\.hotbarCounts\[i\]/);
assert.match(game, /state\.bagSlotCounts\[i\]/);
assert.match(game, /container\.addEventListener\('dragenter'/);
assert.match(game, /event\.button === 2/);
assert.match(game, /state\.industryEngine\?\.insert\(machine\.id, itemId, 1\)/);
assert.match(industry, /insert\(machineId, itemId, amount = 1\)/);

console.log('Inventory stack and machine quick-insert regression checks passed.');
