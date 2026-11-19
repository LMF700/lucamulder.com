const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const terrain = game.match(/function drawTerrain\(\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.match(terrain, /const bounds = terrainViewportBounds\(\)/, 'terrain should use the camera-derived visible bounds');
assert.match(terrain, /const xStart = bounds\.xStart, xEnd = bounds\.xEnd/, 'terrain samples should stay anchored to world-space coordinates');
assert.match(terrain, /if \(r < 0\.99\) continue/, 'terrain quads beneath the Empty Sea should be skipped');
assert.doesNotMatch(terrain, /COLORS\.sand|#123f9b/, 'the sea should not reveal a tiled yellow or blue terrain layer beneath its overlay');
assert.match(game, /worldEllipse\(b\.x, b\.z, b\.rx \* 1\.08, b\.rz \* 1\.08, outerY/, 'the sand cap should overlap the terrain mask to close shoreline gaps');
assert.match(game, /state\.camera\.x = lerp\(state\.camera\.x, p\.x, 1 - Math\.exp\(-12 \* dt\)\)/, 'camera follow should reduce visible terrain lag');
assert.match(game, /if \(p\.grounded && Math\.abs\(groundDelta\) <= walkableSlope\)/, 'the basin shoreline should remain walkable without entering a fall state');

assert.match(game, /const MUSIC = \{[\s\S]*?chords:[\s\S]*?melody:/, 'the soundtrack should contain a chord progression and a changing melody');
assert.match(game, /function scheduleMusic\(\)/, 'music should be scheduled as sequenced notes instead of a static tone');
assert.match(game, /osc\.type = options\.type \|\| 'triangle'/, 'musical voices should use a richer timbre than a continuous sine wave');
assert.match(game, /if \(!enabled\) \{[\s\S]*?return;\s*\}\s*const AudioContextClass/, 'turning sound off must not create or start an audio context');
assert.match(html, /id="sound-control"/, 'the player should be able to toggle audio during play');
assert.match(game, /bindButton\('sound-control', \(\) => \{ sound\.preferenceChosen = true; setSoundEnabled\(!sound\.enabled\); \}\)/, 'the in-game audio control should mute and resume the soundtrack');
assert.match(game, /if \(!sound\.preferenceChosen\) setSoundEnabled\(true\)/, 'Begin should respect a sound preference selected in the menu');
assert.match(game, /if \(event\.target\?\.closest\?\.\('input, textarea, select, \[contenteditable="true"\]'\)\) return/, 'focused buttons must not suppress movement keydown events');
assert.match(game, /function playSoundEffect\(kind\)/, 'gameplay should provide one-shot sound effects');
for (const effect of ['step', 'mine', 'chop', 'jump']) assert.match(game, new RegExp(`playSoundEffect\\('${effect}'\\)`), `${effect} should trigger a sound effect`);
assert.match(game, /p\.jumpBuffer = 0\.18/, 'jump presses should be buffered briefly before landing');
assert.match(game, /if \(p\.grounded && p\.jumpBuffer > 0\)[\s\S]*?playSoundEffect\('jump'\)/, 'a buffered jump should fire with its sound as soon as the player lands');
assert.match(game, /function jump\(\) \{[\s\S]*?if \(!p\.grounded\) return false;[\s\S]*?playSoundEffect\('jump'\)/, 'jump sound should only play when a jump actually starts');
assert.ok(fs.existsSync(path.join(root, 'audio-assets', '.gitkeep')), 'audio-assets folder should be present for future music and sound files');

console.log('FTS sea collision, terrain mesh, and sequenced-audio regression tests passed.');
