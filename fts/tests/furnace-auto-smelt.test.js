const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const registryCode = fs.readFileSync('data/registry.js', 'utf8');
const engineCode = fs.readFileSync('systems/industry-engine.js', 'utf8');
const context = { window: {}, Date, Math };
vm.createContext(context);
vm.runInContext(registryCode, context);
vm.runInContext(engineCode, context);
const inventory = { furnace: 1, ironOre: 2, copperOre: 1 };
const engine = new context.window.FTSIndustryEngine({
  consumeItem(id, n = 1) { if ((inventory[id] || 0) < n) return false; inventory[id] -= n; return true; },
  addItem(id, n = 1) { inventory[id] = (inventory[id] || 0) + n; return true; }
});
const placed = engine.placeMachine('furnace', 0, 0);
assert.equal(placed.ok, true);
const id = placed.machine.id;
assert.equal(engine.insert(id, 'ironOre', 1), true);
assert.equal(inventory.ironOre, 1);
for (let i = 0; i < 8; i++) engine.tick(0.5);
assert.equal(engine.getMachine(id).output.ironIngot, 1, 'iron ore should automatically become an iron ingot');
assert.equal(engine.getMachine(id).input.ironOre, undefined, 'consumed ore should leave the input buffer');
assert.equal(engine.insert(id, 'copperOre', 1), true);
for (let i = 0; i < 8; i++) engine.tick(0.5);
assert.equal(engine.getMachine(id).output.copperIngot, 1, 'copper ore should automatically become a copper ingot');
console.log('Furnace auto-smelt tests passed.');
