const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

const context = { window: {}, Object, Math };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'data/registry.js'), 'utf8'), context);
const registry = context.window.FTSRegistry;
assert.ok(registry, 'registry should initialize');

for (const item of Object.values(registry.items)) {
  assert.match(item.image, /^assets\/[\w-]+\/[\w-]+\.png$/, `invalid item image path ${item.image}`);
}
for (const [machineId, machine] of Object.entries(registry.machines)) {
  assert.ok(registry.items[machine.item], `machine ${machineId} references unknown item ${machine.item}`);
  assert.match(machine.sprite, /^assets\/[\w-]+\/[\w-]+\.png$/, `invalid machine sprite path ${machine.sprite}`);
  for (const recipeId of machine.recipeIds || []) assert.ok(registry.machineRecipes[recipeId], `machine ${machineId} references missing recipe ${recipeId}`);
}
for (const [recipeId, recipe] of Object.entries(registry.machineRecipes)) {
  assert.ok(registry.machines[recipe.machine], `recipe ${recipeId} references missing machine ${recipe.machine}`);
  for (const id of [...Object.keys(recipe.inputs), ...Object.keys(recipe.outputs)]) {
    assert.ok(registry.items[id] || registry.fluids[id], `recipe ${recipeId} references unknown item/fluid ${id}`);
  }
}
for (const [id, fluid] of Object.entries(registry.fluids)) {
  assert.equal(fluid.collectible, false, `${id} must not be collectible`);
  assert.equal(fluid.transport, 'tungstenShaft', `${id} must use the Tungsten Shaft network`);
  assert.ok(!registry.items[id], `${id} must not be exposed as an inventory item`);
}

for (const [recipeId, recipe] of Object.entries({...registry.handRecipes, ...registry.machineBuildRecipes})) {
  for (const id of [...Object.keys(recipe.inputs || {}), ...Object.keys(recipe.output || {})]) assert.ok(registry.items[id], `recipe ${recipeId} references unknown item ${id}`);
}
for (const assets of Object.values(registry.worldAssets)) {
  for (const assetPath of Object.values(assets)) assert.match(assetPath, /^assets\/[\w-]+\/[\w-]+\.png$/, `invalid world sprite path: ${assetPath}`);
}
const assetLoader = fs.readFileSync(path.join(root, 'systems/asset-loader.js'), 'utf8');
assert.match(assetLoader, /Missing artwork falls back gracefully/, 'missing artwork should remain supported by the asset loader');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
for (const [, scriptPath] of html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)) {
  assert.ok(fs.existsSync(path.join(root, scriptPath)), `index.html references missing script ${scriptPath}`);
}
for (const [, cssPath] of html.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/g)) {
  assert.ok(fs.existsSync(path.join(root, cssPath)), `index.html references missing stylesheet ${cssPath}`);
}

assert.ok(!Object.values(registry.handRecipes).some(recipe => recipe.output?.transistor), 'player must not hand-craft Transistors');
assert.ok(registry.items.brass, 'Brass Channel recipe output should have an item definition');
assert.match(game, /brass: 'channel'/, 'Brass Channel should select the channel construction tool');
assert.match(game, /\['iron', 'concrete', 'glass', 'brass'\]/, 'Brass Channel should select its matching channel type');
assert.equal(registry.machines.drill.outputs[0], 'ironOre', 'Drill should mine ore, not finished ingots');

console.log(`FTS project smoke tests passed (${Object.keys(registry.items).length} collectible items, ${Object.keys(registry.fluids).length} process fluids, ${Object.keys(registry.machines).length} machines).`);
