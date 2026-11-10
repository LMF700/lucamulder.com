const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = { window: {}, console, Date, Math, Set, Map };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'data/registry.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'systems/industry-engine.js'), 'utf8'), context);
const Engine = context.window.FTSIndustryEngine;
const Registry = context.window.FTSRegistry;

function makeDrillEngine(target) {
  const bag = { drill: 1, waterwheel: 1, shaft: 2 };
  let remaining = 10;
  const engine = new Engine({
    getItemCount: id => bag[id] || 0,
    consumeItem: (id, amount) => {
      if ((bag[id] || 0) < amount) return false;
      bag[id] -= amount;
      return true;
    },
    addItem: (id, amount) => { bag[id] = (bag[id] || 0) + amount; return true; },
    findChannelAt: () => 'channel-1',
    getChannelFlow: () => 120,
    findDepositAt: () => ({ ...target }),
    takeDepositResource: (id, amount, type) => {
      assert.equal(id, target.id);
      assert.equal(type, target.type);
      if (remaining < amount) return false;
      remaining -= amount;
      return true;
    },
    onToast: () => {},
    terrainHeight: () => 0
  });
  return { engine, getRemaining: () => remaining };
}

// Every mineral deposit category can drive the same Drill and produces its matching resource.
for (const target of [
  { id: 'stone-1', type: 'stone', item: 'stone', x: 12, z: 34 },
  { id: 'iron-1', type: 'iron', item: 'ironOre', x: 12, z: 34 },
  { id: 'copper-1', type: 'copper', item: 'copperOre', x: 12, z: 34 },
  { id: 'zinc-1', type: 'zinc', item: 'zincOre', x: 12, z: 34 },
  { id: 'silicon-1', type: 'silicon', item: 'silicon', x: 12, z: 34 },
  { id: 'clay-1', type: 'clay', item: 'clay', x: 12, z: 34 },
  { id: 'voltite-1', type: 'voltite', item: 'voltite', x: 12, z: 34 }
]) {
  assert.ok(Registry.items[target.item], `${target.item} must be a registered collectible output`);
  const { engine, getRemaining } = makeDrillEngine(target);
  const wheel = engine.placeMachine('waterwheel', 0, 0);
  const drill = engine.placeMachine('drill', 180, 0);
  assert.ok(wheel.ok && drill.ok, `${target.type} deposit should accept a Drill`);
  assert.equal(drill.machine.depositId, target.id);
  assert.equal(drill.machine.depositType, target.type);
  assert.equal(drill.machine.depositItem, target.item);
  assert.deepEqual([drill.machine.x, drill.machine.z], [target.x, target.z], 'Drill snaps to deposit centre');
  assert.ok(engine.connectShaft(wheel.machine.id, drill.machine.id).ok);
  engine.tick(1);
  assert.equal(engine.getMachine(drill.machine.id).output[target.item], 6, `${target.type} Drill output type`);
  assert.equal(getRemaining(), 4, `${target.type} deposit stock is consumed`);
}

// Clicking a machine can collect all normal outputs, while fluids remain non-collectible.
{
  const bag = {};
  let accepted = 0;
  let limit = 4;
  const engine = new Engine({
    getItemCount: id => bag[id] || 0,
    consumeItem: () => true,
    addItem: (id, amount) => {
      if (accepted >= limit) return false;
      accepted += amount;
      bag[id] = (bag[id] || 0) + amount;
      return true;
    },
    onToast: () => {}
  });
  const placed = engine.placeMachine('furnace', 0, 0, { free: true });
  const machine = engine.getMachine(placed.machine.id);
  machine.output = { ironOre: 3, copperOre: 2, moltenIron: 4 };
  const first = engine.collectAllOutput(machine.id);
  assert.equal(first.total, 4);
  assert.deepEqual({ ...first.items }, { ironOre: 3, copperOre: 1 });
  assert.equal(first.blocked, true);
  assert.equal(machine.output.copperOre, 1, 'Uncollected output remains in the machine');
  assert.equal(machine.output.moltenIron, 4, 'Process fluids remain in their machine buffer');
  limit = 10;
  const second = engine.collectAllOutput(machine.id);
  assert.equal(second.total, 1);
  assert.equal(machine.output.copperOre, undefined);
  assert.equal(machine.output.moltenIron, 4);
}

// A machine with no output is still inspectable, and output counts are reported in snapshots.
{
  const engine = new Engine({ getItemCount: () => 0, consumeItem: () => true, addItem: () => true });
  const placed = engine.placeMachine('crusher', 0, 0, { free: true });
  const machine = engine.getMachine(placed.machine.id);
  machine.output.stonePowder = 7;
  assert.equal(engine.getMachineSnapshot(machine.id).collectibleOutputCount, 7);
  assert.equal(engine.collectAllOutput('missing-machine').total, 0);
}

console.log('FTS all-deposit drilling and machine click-collection tests passed.');
