const fs = require('fs'); const path = require('path'); const assert = require('assert');
const root = path.join(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(game.includes('<details class="recipe-group"'), 'Inventory crafting must preserve its original accordion recipe groups');
assert(game.includes('DEVICES & BUILDING') && game.includes('HAND-CRAFTED COMPONENTS'), 'Inventory crafting categories must be preserved');
assert(html.includes('id="crafting-recipes"'), 'Inventory crafting container must exist');
console.log('Inventory crafting preservation tests passed.');
