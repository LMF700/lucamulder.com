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

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/asset-manifest.json'), 'utf8'));
const manifestPaths = new Set(manifest.files.map(entry => entry.path));
assert.equal(manifestPaths.size, manifest.files.length, 'asset manifest paths must be unique');

for (const item of Object.values(registry.items)) {
  assert.ok(manifestPaths.has(item.image), `missing manifest entry for item image ${item.image}`);
}
for (const [machineId, machine] of Object.entries(registry.machines)) {
  assert.ok(registry.items[machine.item], `machine ${machineId} references unknown item ${machine.item}`);
  assert.ok(manifestPaths.has(machine.sprite), `missing manifest entry for machine sprite ${machine.sprite}`);
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
  for (const assetPath of Object.values(assets)) assert.ok(manifestPaths.has(assetPath), `world sprite is missing from manifest: ${assetPath}`);
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [, scriptPath] of html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)) {
  assert.ok(fs.existsSync(path.join(root, scriptPath)), `index.html references missing script ${scriptPath}`);
}
for (const [, cssPath] of html.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/g)) {
  assert.ok(fs.existsSync(path.join(root, cssPath)), `index.html references missing stylesheet ${cssPath}`);
}

assert.ok(!Object.values(registry.handRecipes).some(recipe => recipe.output?.transistor), 'player must not hand-craft Transistors');
assert.equal(registry.machines.drill.outputs[0], 'ironOre', 'Drill should mine ore, not finished ingots');

console.log(`FTS project smoke tests passed (${Object.keys(registry.items).length} collectible items, ${Object.keys(registry.fluids).length} process fluids, ${Object.keys(registry.machines).length} machines, ${manifest.files.length} art paths).`);
