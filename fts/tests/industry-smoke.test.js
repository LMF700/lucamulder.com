const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = { window: {}, console, Date, Math, Set, Map };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'data/registry.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'systems/industry-engine.js'), 'utf8'), context);
const Registry = context.window.FTSRegistry;
const Engine = context.window.FTSIndustryEngine;
assert.ok(Registry && Engine, 'registry and engine should load');

function makeEngine(overrides = {}) {
  const bag = Object.create(null);
  const add = (id, n) => { bag[id] = (bag[id] || 0) + n; return true; };
  const consume = (id, n) => { if ((bag[id] || 0) < n) return false; bag[id] -= n; return true; };
  Object.assign(bag, {
    drill: 1, waterwheel: 1, shaft: 4, furnace: 2, ironOre: 4,
    coilingDevice: 1, copperIngot: 5, mainsSupply: 1,
    accumulator: 1, mainsCable: 1, battery: 1,
    conveyorBelt: 1, brassKiln: 1
  });
  const state = { bag, flow: 120, depositRemaining: 20, voltite: true, hazards: 0 };
  const adapter = {
    getItemCount: id => bag[id] || 0,
    consumeItem: consume,
    addItem: add,
    onToast: () => {},
    getChannelFlow: () => state.flow,
    findChannelAt: () => 'channel-1',
    findIronDeposit: () => 'iron-1',
    takeDepositResource: () => state.depositRemaining-- > 0,
    isNearVoltite: () => state.voltite,
    onCastingHazard: () => { state.hazards++; },
    terrainHeight: () => 0,
    ...overrides
  };
  return { engine: new Engine(adapter), state, bag };
}

// Drill + waterwheel: at 120 L/s => 30 RPM, 60 force, 300 Power/s.
{
  const { engine, state } = makeEngine();
  const wheel = engine.placeMachine('waterwheel', 0, 0);
  const drill = engine.placeMachine('drill', 180, 0);
  assert.ok(wheel.ok && drill.ok);
  assert.equal(engine.getMachine(wheel.machine.id).channelId, 'channel-1');
  assert.ok(engine.connectShaft(wheel.machine.id, drill.machine.id).ok);
  engine.tick(1);
  const w = engine.getMachine(wheel.machine.id);
  const d = engine.getMachine(drill.machine.id);
  assert.equal(w.rpm, 30);
  assert.equal(w.force, 60);
  assert.equal(w.mechanicalPower, 300);
  assert.equal(d.output.ironOre, 6);
  assert.equal(state.depositRemaining, 14);
}

// Furnace: iron ore is converted into an iron ingot after the recipe duration.
{
  const { engine } = makeEngine();
  const furnace = engine.placeMachine('furnace', 0, 0);
  assert.ok(furnace.ok);
  assert.ok(engine.setRecipe(furnace.machine.id, 'smelt-iron'));
  assert.ok(engine.insert(furnace.machine.id, 'ironOre', 1));
  engine.tick(4);
  assert.equal(engine.getMachine(furnace.machine.id).output.ironIngot, 1);
}

// Coiling device: five ingots + thirty-six manual cranks make one copper coil.
{
  const { engine } = makeEngine();
  const machine = engine.placeMachine('coilingDevice', 0, 0);
  assert.ok(machine.ok);
  assert.ok(engine.insert(machine.machine.id, 'copperIngot', 5));
  for (let i = 0; i < 35; i++) assert.ok(engine.crank(machine.machine.id).ok);
  assert.equal(engine.getMachine(machine.machine.id).output.copperCoil || 0, 0);
  assert.equal(engine.crank(machine.machine.id).complete, true);
  assert.equal(engine.getMachine(machine.machine.id).output.copperCoil, 1);
}

// A Voltite-fed transformer can charge an Accumulator; a charged unit applies x10.
{
  const { engine } = makeEngine();
  const transformer = engine.placeMachine('mainsSupply', 0, 0);
  const accumulator = engine.placeMachine('accumulator', 100, 0);
  assert.ok(transformer.ok && accumulator.ok);
  assert.ok(engine.connectPower(transformer.machine.id, accumulator.machine.id).ok);
  engine.tick(30);
  const a = engine.getMachine(accumulator.machine.id);
  assert.equal(a.charge, 100);
  assert.equal(engine.channelMultiplier('channel-1'), 10);
}

// Unsafe molten metal feed into a casting machine is rejected and triggers the hazard callback.
{
  const { engine, state } = makeEngine({ findChannelAt: () => 'channel-1' });
  const casting = engine.placeMachine('castingMachine', 0, 0, { free: true });
  assert.ok(casting.ok);
  assert.equal(engine.insert(casting.machine.id, 'moltenIron', 1), false);
  assert.equal(state.hazards, 1);
}

// Molten metals are machine-only fluids: they cannot be manually inserted or picked up,
// but a completed Tungsten Shaft link transfers them directly between machine buffers.
{
  const { engine, state, bag } = makeEngine();
  bag.tungstenShaft = 1;
  const furnace = engine.placeMachine('furnace', 0, 0, { free: true });
  const casting = engine.placeMachine('castingMachine', 160, 0, { free: true });
  assert.ok(furnace.ok && casting.ok);
  assert.ok(engine.connectMolten(furnace.machine.id, casting.machine.id).ok);
  const f = engine.getMachine(furnace.machine.id);
  const c = engine.getMachine(casting.machine.id);
  f.output.moltenIron = 1;
  assert.equal(engine.take(furnace.machine.id, 'moltenIron'), 0);
  assert.equal(engine.insert(casting.machine.id, 'moltenIron', 1), false);
  engine.updateMoltenTransfers(0.8);
  assert.equal(f.output.moltenIron || 0, 0);
  assert.equal(c.input.moltenIron, 1);
  assert.equal(state.hazards, 0);
}

console.log('FTS industry smoke tests passed.');

// Transistors are machine-produced, never hand-crafted by the player.
assert.ok(!Object.values(Registry.handRecipes).some(r => r.output?.transistor), 'transistors must not have a hand recipe');
assert.equal(JSON.stringify(Registry.machineBuildRecipes.drill.inputs), JSON.stringify({ drillBit: 1, polishedStone: 6, shaft: 1 }));
assert.equal(JSON.stringify(Registry.machineBuildRecipes.conveyorBelt.inputs), JSON.stringify({ belt: 1, conveyorChassis: 1 }));
assert.equal(JSON.stringify(Registry.machineBuildRecipes.castingMachine.inputs), JSON.stringify({ brassPlate: 2, ironPlate: 4 }));
assert.equal(JSON.stringify(Registry.machineBuildRecipes.coilingDevice.inputs), JSON.stringify({ brassIngot: 2, shaft: 1 }));
assert.equal(JSON.stringify(Registry.machineBuildRecipes.brassKiln.inputs), JSON.stringify({ blastBurner: 1, kilnPart: 4 }));
assert.equal(JSON.stringify(Registry.machineBuildRecipes.flattener.inputs), JSON.stringify({ ironFlattener: 1, ironIngot: 2, shaft: 1 }));
assert.equal(JSON.stringify(Registry.machineBuildRecipes.condenser.inputs), JSON.stringify({ condenserFrame: 1, glassPane: 5 }));


// Transistor fabrication is an automated machine recipe, not a player recipe.
{
  const { engine, bag } = makeEngine();
  bag.transistorFabricator = 1; bag.silicon = 1; bag.copperIngot = 1;
  const fabricator = engine.placeMachine('transistorFabricator', 0, 0);
  assert.ok(fabricator.ok);
  assert.ok(engine.setRecipe(fabricator.machine.id, 'fabricate-transistor'));
  assert.ok(engine.insert(fabricator.machine.id, 'silicon', 1));
  assert.ok(engine.insert(fabricator.machine.id, 'copperIngot', 1));
  engine.tick(5.1);
  assert.equal(engine.getMachine(fabricator.machine.id).output.transistor, 4);
}

// Board assembly consumes a blank board, 24 machine-produced transistors and glass.
{
  const { engine, bag } = makeEngine();
  bag.blankBoard = 1; bag.transistor = 24; bag.glassPane = 2;
  const boarder = engine.placeMachine('boardAssemblyDevice', 0, 0, { free: true });
  assert.ok(boarder.ok);
  assert.ok(engine.setRecipe(boarder.machine.id, 'assemble-logic-board'));
  assert.ok(engine.insert(boarder.machine.id, 'blankBoard', 1));
  assert.ok(engine.insert(boarder.machine.id, 'transistor', 24));
  assert.ok(engine.insert(boarder.machine.id, 'glassPane', 2));
  engine.tick(12.1);
  assert.equal(engine.getMachine(boarder.machine.id).output.logicBoard, 1);
}

// Conveyor belts are self-powered and transfer machine outputs to the next machine.
{
  const { engine, bag } = makeEngine();
  bag.flattener = 1;
  const furnace = engine.placeMachine('furnace', 0, 0);
  const flattener = engine.placeMachine('flattener', 162, 0);
  assert.ok(furnace.ok && flattener.ok);
  assert.ok(engine.placeBelt(100, 0, 0).ok);
  assert.ok(engine.setRecipe(furnace.machine.id, 'smelt-iron'));
  assert.ok(engine.setRecipe(flattener.machine.id, 'press-iron-plate'));
  assert.ok(engine.insert(furnace.machine.id, 'ironOre', 1));
  for (let i = 0; i < 70; i++) engine.tick(0.2);
  assert.equal(engine.getMachine(flattener.machine.id).output.ironPlate, 1);
}

// Tungsten Shaft is a dedicated Furnace-to-Casting-Machine molten feed, not a drive shaft.
{
  const { engine, state, bag } = makeEngine();
  bag.furnace = 1;
  bag.castingMachine = 1;
  bag.tungstenShaft = 1;
  bag.castIron = 1;
  bag.castingSand = 1;
  bag.ironIngot = 1;
  const furnace = engine.placeMachine('furnace', 0, 0);
  const casting = engine.placeMachine('castingMachine', 160, 0);
  assert.ok(furnace.ok && casting.ok);
  assert.ok(engine.connectMolten(furnace.machine.id, casting.machine.id).ok);
  assert.ok(engine.installCast(casting.machine.id, 'castIron').ok);
  assert.ok(engine.setRecipe(furnace.machine.id, 'melt-iron'));
  assert.ok(engine.insert(furnace.machine.id, 'ironIngot', 1));
  assert.ok(engine.insert(casting.machine.id, 'castingSand', 1));
  for (let i = 0; i < 70; i++) engine.tick(0.2);
  assert.equal(engine.getMachine(casting.machine.id).output.ironIngot, 1);
  assert.equal(state.hazards, 0);
}

// A mechanical connection cannot be made with a Tungsten Shaft.
{
  const { engine, bag } = makeEngine();
  bag.waterwheel = 1; bag.drill = 1; bag.tungstenShaft = 1;
  const wheel = engine.placeMachine('waterwheel', 0, 0);
  const drill = engine.placeMachine('drill', 180, 0);
  assert.ok(wheel.ok && drill.ok);
  assert.equal(engine.connectShaft(wheel.machine.id, drill.machine.id, 'tungstenShaft').ok, false);
}
