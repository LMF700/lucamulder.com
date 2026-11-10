/* Fill The Sea item, machine and recipe registry.
 * Edit this file to add content without changing the simulation code.
 */
(() => {
  'use strict';

  const items = {
    // Starting tools and existing infrastructure.
    compass: ['Compass','tool','tools/compass.png','✥'],
    stonePickaxe: ['Stone Pickaxe','tool','tools/stone-pickaxe.png','⚒'],
    stoneAxe: ['Stone Axe','tool','tools/stone-axe.png','⚒'],
    iron: ['Iron Channel','infrastructure','infrastructure/iron-channel.png','▰'],
    concrete: ['Concrete Channel','infrastructure','infrastructure/concrete-channel.png','▰'],
    glass: ['Glass Channel','infrastructure','infrastructure/glass-channel.png','◇'],
    chute: ['Chute','infrastructure','infrastructure/chute.png','▥'],
    hygrometer: ['Hygrometer','device','infrastructure/hygrometer.png','◉'],
    remoteDisplay: ['Remote Display','device','infrastructure/remote-display.png','▣'],
    woodPole: ['Wood Pole','building','infrastructure/wood-pole.png','╱'],
    pump: ['Water Pump','machine','machines/water-pump.png','◈'],
    x4: ['High-flow Multiplier','module','items/x4-multiplier.png','×4'],
    x2: ['Balanced Multiplier','module','items/x2-multiplier.png','×2'],

    // Raw materials and processed materials.
    stone: ['Stone','material','items/stone.png','◆'],
    polishedStone: ['Polished Stone','material','items/polished-stone.png','◇'],
    stonePowder: ['Stone Powder','material','items/stone-powder.png','▪'],
    ironOre: ['Iron Ore','material','items/iron-ore.png','Fe'],
    ironIngot: ['Iron Ingot','material','items/iron-ingot.png','Fe'],
    ironPlate: ['Iron Plate','material','items/iron-plate.png','▱'],
    copperOre: ['Copper Ore','material','items/copper-ore.png','Cu'],
    copperIngot: ['Copper Ingot','material','items/copper-ingot.png','Cu'],
    zincOre: ['Zinc Ore','material','items/zinc-ore.png','Zn'],
    zincIngot: ['Zinc Ingot','material','items/zinc-ingot.png','Zn'],
    brassIngot: ['Brass Ingot','material','items/brass-ingot.png','Br'],
    brassPlate: ['Brass Plate','material','items/brass-plate.png','▱'],
    sand: ['Sand','material','items/sand.png','·'],
    glassPane: ['Glass','material','items/glass.png','◇'],
    silicon: ['Silicon','material','items/silicon.png','Si'],
    clay: ['Clay','material','items/clay.png','■'],
    castingSand: ['Casting Sand','material','items/casting-sand.png','░'],
    wood: ['Wood','material','items/wood.png','▰'],
    treeSap: ['Tree Sap','material','items/tree-sap.png','●'],
    rubber: ['Rubber','material','items/rubber.png','●'],
    voltite: ['Voltite','material','items/voltite.png','ϟ'],
    copperCoil: ['Copper Coil','component','items/copper-coil.png','◎'],
    logicBoard: ['Logic Board','component','items/logic-board.png','▦'],
    blankBoard: ['Blank Board','component','items/blank-board.png','▤'],
    transistor: ['Transistor','component','items/transistor.png','▣'],
    transformerCore: ['Transformer Core','component','items/transformer-core.png','◈'],
    transformer: ['Transformer','component','items/transformer.png','ϟ'],
    mainsSupply: ['Mains Supply','machine','machines/mains-supply.png','ϟ'],
    battery: ['Battery','component','items/battery.png','▣'],
    metal: ['Metal Plate','component','items/metal-plate.png','▱'],
    wire: ['Wire','component','items/wire.png','⌁'],
    shaft: ['Shaft','component','items/shaft.png','━'],
    tungstenShaft: ['Tungsten Shaft','component','items/tungsten-shaft.png','━'],
    drillBit: ['Drill Bit','component','items/drill-bit.png','⌁'],
    belt: ['Belt','component','items/belt.png','▰'],
    conveyorChassis: ['Conveyor Chassis','component','items/conveyor-chassis.png','▱'],
    conveyorBelt: ['Conveyor Belt','infrastructure','infrastructure/conveyor-belt.png','▰'],
    mainsCable: ['Mains Cable','infrastructure','infrastructure/mains-cable.png','⌁'],

    // Placeable machines.
    drill: ['Drill','machine','machines/drill.png','⚙'],
    waterwheel: ['Waterwheel','machine','machines/waterwheel.png','☸'],
    crusher: ['Crusher','machine','machines/crusher.png','◉'],
    furnace: ['Furnace','machine','machines/furnace.png','▥'],
    flattener: ['Flattener','machine','machines/flattener.png','▤'],
    condenser: ['Condenser','machine','machines/condenser.png','▤'],
    coilingDevice: ['Coiling Device','machine','machines/coiling-device.png','◎'],
    brassKiln: ['Brass Kiln','machine','machines/brass-kiln.png','♨'],
    castingMachine: ['Casting Machine','machine','machines/casting-machine.png','▥'],
    boardAssemblyDevice: ['Board Assembly Device','machine','machines/board-assembly-device.png','▦'],
    transistorFabricator: ['Transistor Fabricator','machine','machines/transistor-fabricator.png','▣'],
    blastBurner: ['Blast Burner','machine','machines/blast-burner.png','♨'],
    accumulator: ['Accumulator','machine','machines/accumulator.png','▤'],

    // Casts are reusable patterns; the machine holds one active cast.
    castIron: ['Iron Cast','cast','items/cast-iron.png','▥'],
    castBrass: ['Brass Cast','cast','items/cast-brass.png','▥'],
    castCopper: ['Copper Cast','cast','items/cast-copper.png','▥'],
    castTransformer: ['Transformer Cast','cast','items/cast-transformer.png','▥'],
    ironFlattener: ['Iron Flattener','component','items/iron-flattener.png','▤'],
    kilnPart: ['Kiln Part','component','items/kiln-part.png','▱'],
    condenserFrame: ['Condenser Frame','component','items/condenser-frame.png','▤'],
    blastFrame: ['Blasting Frame','component','items/blasting-frame.png','▥'],
    smokestack: ['Smokestack','component','items/smokestack.png','▥'],
    tungstenIngot: ['Tungsten Ingot','material','items/tungsten-ingot.png','W']
  };

  // Process fluids are internal machine-buffer values, not pickup items.
  // They have no inventory icon and can only travel through a Tungsten Shaft feed.
  const fluids = {
    moltenIron: { id: 'moltenIron', name: 'Molten Iron', color: '#ff7438', transport: 'tungstenShaft', collectible: false },
    moltenBrass: { id: 'moltenBrass', name: 'Molten Brass', color: '#ffd45a', transport: 'tungstenShaft', collectible: false },
    moltenCopper: { id: 'moltenCopper', name: 'Molten Copper', color: '#ff9a4d', transport: 'tungstenShaft', collectible: false }
  };

  const itemRegistry = {};
  for (const [id, value] of Object.entries(items)) {
    const [name, category, image, glyph] = value;
    itemRegistry[id] = {
      id, name, category, image: `assets/${image}`, glyph,
      stackable: !['machine','tool','device','building','infrastructure'].includes(category),
      placeable: ['machine','infrastructure','building','device'].includes(category),
      footprint: category === 'machine' ? [72, 66] : category === 'infrastructure' ? [48, 30] : [32, 32]
    };
  }

  const machines = {
    drill: { item: 'drill', sprite: 'assets/machines/drill.png', size: [82, 88], worldScale: 1, inputs: [], outputs: ['ironOre'], mechanicalInput: true, recipeIds: [] },
    waterwheel: { item: 'waterwheel', sprite: 'assets/machines/waterwheel.png', size: [100, 110], maxFlow: 180, waterInput: true, mechanicalOutput: true, recipeIds: [] },
    crusher: { item: 'crusher', sprite: 'assets/machines/crusher.png', size: [104, 96], recipeIds: ['crush-stone'] },
    furnace: { item: 'furnace', sprite: 'assets/machines/furnace.png', size: [110, 112], recipeIds: ['make-sand','smelt-sand','smelt-iron','smelt-copper','smelt-zinc','melt-iron','melt-copper','melt-brass'] },
    flattener: { item: 'flattener', sprite: 'assets/machines/flattener.png', size: [110, 86], recipeIds: ['press-iron-plate','press-brass-plate','press-belt','press-kiln-part','press-condenser-frame','polish-stone','make-blank-board','make-conveyor-chassis'] },
    condenser: { item: 'condenser', sprite: 'assets/machines/condenser.png', size: [94, 104], recipeIds: ['condense-rubber'] },
    coilingDevice: { item: 'coilingDevice', sprite: 'assets/machines/coiling-device.png', size: [92, 84], manualCrank: true, recipeIds: ['coil-copper'] },
    brassKiln: { item: 'brassKiln', sprite: 'assets/machines/brass-kiln.png', size: [118, 116], recipeIds: ['smelt-brass'] },
    castingMachine: { item: 'castingMachine', sprite: 'assets/machines/casting-machine.png', size: [116, 110], recipeIds: ['cast-iron','cast-brass','cast-copper','cast-transformer'] },
    boardAssemblyDevice: { item: 'boardAssemblyDevice', sprite: 'assets/machines/board-assembly-device.png', size: [122, 94], recipeIds: ['assemble-logic-board'] },
    transistorFabricator: { item: 'transistorFabricator', sprite: 'assets/machines/transistor-fabricator.png', size: [104, 92], recipeIds: ['fabricate-transistor'] },
    blastBurner: { item: 'blastBurner', sprite: 'assets/machines/blast-burner.png', size: [100, 112], recipeIds: [] },
    accumulator: { item: 'accumulator', sprite: 'assets/machines/accumulator.png', size: [112, 112], electricalInput: true, waterMultiplier: 10, recipeIds: [] },
    mainsSupply: { item: 'mainsSupply', sprite: 'assets/machines/mains-supply.png', size: [110, 96], electricalSource: true, recipeIds: [] }
  };

  const handRecipes = {
    shaft: { name: 'Shaft', inputs: { stone: 2 }, output: { shaft: 1 }, station: 'inventory', seconds: 0 },
    tungstenShaft: { name: 'Tungsten Shaft', inputs: { tungstenIngot: 2 }, output: { tungstenShaft: 1 }, station: 'inventory', seconds: 0 },
    drillBit: { name: 'Drill Bit', inputs: { polishedStone: 2, shaft: 1 }, output: { drillBit: 1 }, station: 'inventory', seconds: 0 },
    castingSand: { name: 'Casting Sand', inputs: { stonePowder: 2, clay: 1 }, output: { castingSand: 3 }, station: 'inventory', seconds: 0 },
    polishedStone: { name: 'Polished Stone', inputs: { stone: 2 }, output: { polishedStone: 1 }, station: 'inventory', seconds: 0 },
    ironFlattener: { name: 'Iron Flattener', inputs: { ironIngot: 4, shaft: 1 }, output: { ironFlattener: 1 }, station: 'inventory', seconds: 0 },
    castIron: { name: 'Iron Cast', inputs: { ironIngot: 2, castingSand: 2 }, output: { castIron: 1 }, station: 'inventory', seconds: 0 },
    castBrass: { name: 'Brass Cast', inputs: { brassIngot: 2, castingSand: 2 }, output: { castBrass: 1 }, station: 'inventory', seconds: 0 },
    castCopper: { name: 'Copper Cast', inputs: { copperIngot: 2, castingSand: 2 }, output: { castCopper: 1 }, station: 'inventory', seconds: 0 },
    castTransformer: { name: 'Transformer Cast', inputs: { copperIngot: 3, castingSand: 2 }, output: { castTransformer: 1 }, station: 'inventory', seconds: 0 },
    blastFrame: { name: 'Blasting Frame', inputs: { ironPlate: 4 }, output: { blastFrame: 1 }, station: 'inventory', seconds: 0 },
    smokestack: { name: 'Smokestack', inputs: { ironPlate: 3, stone: 2 }, output: { smokestack: 1 }, station: 'inventory', seconds: 0 },
    transformerCore: { name: 'Transformer Core', inputs: { ironIngot: 4, silicon: 2 }, output: { transformerCore: 1 }, station: 'inventory', seconds: 0 },
    battery: { name: 'Battery', inputs: { copperIngot: 1, zincIngot: 1, glassPane: 1 }, output: { battery: 1 }, station: 'inventory', seconds: 0 },
    mainsCable: { name: 'Mains Cable', inputs: { copperCoil: 1, rubber: 1 }, output: { mainsCable: 3 }, station: 'inventory', seconds: 0 },
    iron: { name: 'Iron Channel', inputs: { ironPlate: 1 }, output: { iron: 25 }, station: 'inventory', seconds: 0 },
    concrete: {name: 'Concrete Channel', inputs: {StonePowder: 10}, output: {concrete: 50}, station: 'inventory', seconds: 0 },
    glass: {name: 'Glass Channel', inputs: {glassPane: 3}, output: {glass: 33}, station: 'inventory', seconds: 0 },
    wire: {name: "Wire", inputs: {copperIngot: 1, silicon: 1 }, output: {wire: 10}, station: 'inventory', seconds: 0 },
  };

  const machineRecipes = {
    'crush-stone': { name: 'Crush Stone', machine: 'crusher', inputs: { stone: 1 }, outputs: { stonePowder: 2 }, seconds: 2.5 },
    'make-sand': { name: 'Bake Stone into Sand', machine: 'furnace', inputs: { stone: 1 }, outputs: { sand: 1 }, seconds: 3 },
    'smelt-sand': { name: 'Melt Sand into Glass', machine: 'furnace', inputs: { sand: 1 }, outputs: { glassPane: 1 }, seconds: 5 },
    'smelt-iron': { name: 'Smelt Iron', machine: 'furnace', inputs: { ironOre: 1 }, outputs: { ironIngot: 1 }, seconds: 4 },
    'smelt-copper': { name: 'Smelt Copper', machine: 'furnace', inputs: { copperOre: 1 }, outputs: { copperIngot: 1 }, seconds: 4 },
    'smelt-zinc': { name: 'Smelt Zinc', machine: 'furnace', inputs: { zincOre: 1 }, outputs: { zincIngot: 1 }, seconds: 4 },
    'melt-iron': { name: 'Melt Iron', machine: 'furnace', inputs: { ironIngot: 1 }, outputs: { moltenIron: 1 }, seconds: 3 },
    'melt-copper': { name: 'Melt Copper', machine: 'furnace', inputs: { copperIngot: 1 }, outputs: { moltenCopper: 1 }, seconds: 3 },
    'melt-brass': { name: 'Melt Brass', machine: 'furnace', inputs: { brassIngot: 1 }, outputs: { moltenBrass: 1 }, seconds: 3 },
    'press-iron-plate': { name: 'Press Iron Plate', machine: 'flattener', inputs: { ironIngot: 1 }, outputs: { ironPlate: 1 }, seconds: 3 },
    'press-brass-plate': { name: 'Press Brass Plate', machine: 'flattener', inputs: { brassIngot: 1 }, outputs: { brassPlate: 1 }, seconds: 3 },
    'press-belt': { name: 'Flatten Rubber into Belt', machine: 'flattener', inputs: { rubber: 1 }, outputs: { belt: 1 }, seconds: 2 },
    'press-kiln-part': { name: 'Press Kiln Part', machine: 'flattener', inputs: { ironIngot: 2 }, outputs: { kilnPart: 1 }, seconds: 4 },
    'press-condenser-frame': { name: 'Press Condenser Frame', machine: 'flattener', inputs: { ironIngot: 6 }, outputs: { condenserFrame: 1 }, seconds: 7 },
    'polish-stone': { name: 'Polish Stone', machine: 'flattener', inputs: { stone: 2 }, outputs: { polishedStone: 1 }, seconds: 3 },
    'make-blank-board': { name: 'Make Blank Board', machine: 'flattener', inputs: { silicon: 3 }, outputs: { blankBoard: 1 }, seconds: 5 },
    'make-conveyor-chassis': { name: 'Make Conveyor Chassis', machine: 'flattener', inputs: { ironPlate: 2, shaft: 1 }, outputs: { conveyorChassis: 1 }, seconds: 5 },
    'condense-rubber': { name: 'Condense Rubber', machine: 'condenser', inputs: { treeSap: 5 }, outputs: { rubber: 1 }, seconds: 7 },
    'coil-copper': { name: 'Wind Copper Coil', machine: 'coilingDevice', inputs: { copperIngot: 5 }, outputs: { copperCoil: 1 }, cranks: 36 },
    'smelt-brass': { name: 'Smelt Brass', machine: 'brassKiln', inputs: { copperIngot: 2, zincIngot: 1 }, outputs: { brassIngot: 3 }, seconds: 8 },
    'fabricate-transistor': { name: 'Fabricate Transistor', machine: 'transistorFabricator', inputs: { silicon: 1, copperIngot: 1 }, outputs: { transistor: 4 }, seconds: 5 },
    'assemble-logic-board': { name: 'Assemble Logic Board', machine: 'boardAssemblyDevice', inputs: { blankBoard: 1, transistor: 24, glassPane: 2 }, outputs: { logicBoard: 1 }, seconds: 12 },
    'cast-iron': { name: 'Cast Iron Part', machine: 'castingMachine', inputs: { moltenIron: 1, castingSand: 1 }, outputs: { ironIngot: 1 }, seconds: 8, requiresCast: 'castIron', requiresTungstenShaft: true },
    'cast-brass': { name: 'Cast Brass Part', machine: 'castingMachine', inputs: { moltenBrass: 1, castingSand: 1 }, outputs: { brassIngot: 1 }, seconds: 8, requiresCast: 'castBrass', requiresTungstenShaft: true },
    'cast-copper': { name: 'Cast Copper Part', machine: 'castingMachine', inputs: { moltenCopper: 1, castingSand: 1 }, outputs: { copperIngot: 1 }, seconds: 8, requiresCast: 'castCopper', requiresTungstenShaft: true },
    'cast-transformer': { name: 'Cast Transformer', machine: 'castingMachine', inputs: { moltenCopper: 2, castingSand: 2 }, outputs: { transformer: 1 }, seconds: 14, requiresCast: 'castTransformer', requiresTungstenShaft: true },
  };

  // Machine construction recipes. Several component recipes are explicit prototype assumptions
  // where the design specification did not define a precise cost.
  const machineBuildRecipes = {
    drill: { name: 'Drill', inputs: { drillBit: 1, polishedStone: 6, shaft: 1 }, output: { drill: 1 } },
    waterwheel: { name: 'Waterwheel', inputs: { shaft: 2, wood: 6, stone: 4 }, output: { waterwheel: 1 } },
    crusher: { name: 'Crusher', inputs: { stone: 8, shaft: 1, wood: 4 }, output: { crusher: 1 } },
    furnace: { name: 'Furnace', inputs: { stone: 8, shaft: 1, wood: 3 }, output: { furnace: 1 } },
    flattener: { name: 'Flattener', inputs: { ironFlattener: 1, ironIngot: 2, shaft: 1 }, output: { flattener: 1 } },
    condenser: { name: 'Condenser', inputs: { condenserFrame: 1, glassPane: 5 }, output: { condenser: 1 } },
    coilingDevice: { name: 'Coiling Device', inputs: { brassIngot: 2, shaft: 1 }, output: { coilingDevice: 1 } },
    brassKiln: { name: 'Brass Kiln', inputs: { blastBurner: 1, kilnPart: 4 }, output: { brassKiln: 1 } },
    castingMachine: { name: 'Casting Machine', inputs: { brassPlate: 2, ironPlate: 4 }, output: { castingMachine: 1 } },
    boardAssemblyDevice: { name: 'Board Assembly Device', inputs: { ironPlate: 4, shaft: 2 }, output: { boardAssemblyDevice: 1 } },
    transistorFabricator: { name: 'Transistor Fabricator', inputs: { ironPlate: 3, silicon: 2, copperCoil: 1 }, output: { transistorFabricator: 1 } },
    blastBurner: { name: 'Blast Burner', inputs: { furnace: 1, blastFrame: 1, smokestack: 1 }, output: { blastBurner: 1 } },
    accumulator: { name: 'Accumulator', inputs: { ironPlate: 5, copperCoil: 1, logicBoard: 1 }, output: { accumulator: 1 } },
    mainsSupply: { name: 'Mains Supply', inputs: { copperCoil: 1, logicBoard: 1, transformer: 1 }, output: { mainsSupply: 1 } },
    conveyorBelt: { name: 'Conveyor Belt', inputs: { belt: 1, conveyorChassis: 1 }, output: { conveyorBelt: 1 } },
    waterPump: { name: 'Water Pump', inputs: { ironPlate: 3, shaft: 1 }, output: { pump: 1 } },
    ironFlattener: { name: 'Iron Flattener', inputs: { ironIngot: 3, shaft: 1 }, output: { ironFlattener: 1 } }
  };

  const worldAssets = {
    resources: {
      stoneDeposit: 'assets/resources/stone-deposit.png',
      ironDeposit: 'assets/resources/iron-deposit.png',
      copperDeposit: 'assets/resources/copper-deposit.png',
      zincDeposit: 'assets/resources/zinc-deposit.png',
      siliconDeposit: 'assets/resources/silicon-deposit.png',
      clayDeposit: 'assets/resources/clay-deposit.png',
      voltiteDeposit: 'assets/resources/voltite-deposit.png',
      tree: 'assets/resources/tree.png',
      waterSource: 'assets/resources/water-source.png'
    },
    characters: {
      idle: 'assets/characters/stickman.png',
      walking: 'assets/characters/stickman-walking.png',
      jumping: 'assets/characters/stickman-jumping.png',
      crouching: 'assets/characters/stickman-crouching.png'
    },
    infrastructure: {
      woodenShelter: 'assets/infrastructure/wooden-shelter.png',
      hygrometer: 'assets/infrastructure/hygrometer.png',
      remoteDisplay: 'assets/infrastructure/remote-display.png',
      conveyorBelt: 'assets/infrastructure/conveyor-belt.png',
      chute: 'assets/infrastructure/chute.png'
    },
    effects: {
      waterFlow: 'assets/effects/water-flow.png',
      lightning: 'assets/effects/lightning.png',
      steam: 'assets/effects/steam.png',
      smoke: 'assets/effects/smoke.png',
      sparks: 'assets/effects/sparks.png'
    }
  };

  window.FTSRegistry = Object.freeze({ items: itemRegistry, fluids, machines, handRecipes, machineRecipes, machineBuildRecipes, worldAssets });
})();
