const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

for (const id of ['tutorial-panel','tutorial-progress','tutorial-title','tutorial-copy','tutorial-toggle','tutorial-back','tutorial-next','tutorial-skip']) {
  assert.match(html, new RegExp(`id="${id}"`), `tutorial control ${id} should exist`);
}
for (const topic of ['Explore the shore','Gather the basics','Craft shafts and a Furnace','Place the Furnace','Load the Furnace','Collect Iron Ingots','Craft a Flattener','Place the Flattener','Press Iron Plates','Craft Channels','Build a water route','Craft a Waterwheel','Place the Waterwheel','Craft a Drill','Place the Drill','Power the Drill','Prepare for weather']) {
  assert.ok(game.includes(topic), `tutorial should cover ${topic}`);
}
assert.match(game, /function openTutorial\(\)/);
assert.match(game, /bindButton\('tutorial-next'/);
assert.match(game, /bindButton\('tutorial-skip'/);
assert.match(game, /key === 't'.*openTutorial/);

console.log('FTS tutorial regression tests passed.');
