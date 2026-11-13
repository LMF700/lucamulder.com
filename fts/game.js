// Totally Not A Game
// Copyright 2026 by PyPower
// Redistributing this is okay! It's a FUCKING WEBSITE


(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    mode: document.getElementById('mode-label'),
    instruction: document.getElementById('instruction'),
    progress: document.getElementById('basin-progress'),
    rate: document.getElementById('basin-rate'),
    progressFill: document.getElementById('progress-fill'),
    flow: document.getElementById('flow-label'),
    iron: document.getElementById('iron-count'),
    concrete: document.getElementById('concrete-count'),
    glass: document.getElementById('glass-count'),
    chute: document.getElementById('chute-count'),
    modules: document.getElementById('module-counts'),
    inspection: document.getElementById('inspection'),
    inspectionTitle: document.getElementById('inspection-title'),
    inspectionContent: document.getElementById('inspection-content'),
    toast: document.getElementById('toast')
  };

  const W = 1000;
  const H = 700;
  const FONT = 'Verdana, Geneva, sans-serif';
  const COLORS = {
    grass: '#00ff00', grassDark: '#00a800', soil: '#805400', soilDark: '#4c3000', soilEdge: '#171717',
    sand: '#e5df20', sandEdge: '#b3aa17', water: '#287cf5', waterDark: '#084bb9', waterEdge: '#0861d6',
    ink: '#080808', white: '#f5f5f5', yellow: '#f4ef00', grey: '#929292', greyDark: '#656565'
  };
  const WORLD = {
    // Coordinate convention: X is screen-horizontal, Y is screen-vertical, Z is depth.
    // The world generator still stores terrain height in Y; Z supplies the depth projection.
    xMin: -48000, xMax: 48000,
    zMin: -28000, zMax: 28000,
    // Renderer sampling step. Coarser than the gameplay grid so the expanded
    // terrain view stays performant while still preserving broad shelves.
    zStep: 84, xStep: 84,
    terrainBase: 100,
    projection: { x: 0.72, z: 0.30, y: 0.72, depthSlope: 0.15 }
  };

  const TERRAIN_RENDER_RADIUS = 6000;
  const SOURCE_RATE = 950; // Each spring has abundant natural output; infrastructure is the bottleneck.
  const BASIN_CAPACITY = 4200000;
  const CHANNEL_TYPES = {
    iron: { name: 'Iron Channel', throughput: 25, stressLimit: 200000, inventory: 194, itemSpacing: 15, blue: '#2478ee', grey: '#8e8e8e' },
    concrete: { name: 'Concrete Channel', throughput: 40, stressLimit: 500000, inventory: 48, itemSpacing: 18, blue: '#3796ed', grey: '#aaa' },
    glass: { name: 'Glass Channel', throughput: 18, stressLimit: 100000, inventory: 72, itemSpacing: 13, blue: '#68ccff', grey: '#b9c2c8' },
    brass: { name: 'Brass Channel', throughput: 80, stressLimit: 1000000, inventory: 0, itemSpacing: 20, blue: '#e6c200', grey: '#b9a200' }
  };
  const MODULE_TYPES = {
    x4: { name: 'High-flow multiplier', water: 4, stress: 8 },
    x2: { name: 'Balanced multiplier', water: 2, stress: 2 }
  };
  // Storms are intentionally uncommon. A clear-weather check happens only after
  // a long calm interval, and most checks simply extend the clear spell.
  const WEATHER_TUNING = Object.freeze({
    initialClearMin: 600, initialClearMax: 900,
    skippedCheckMin: 360, skippedCheckMax: 720,
    postStormClearMin: 600, postStormClearMax: 960,
    stormChancePerCheck: 0.22,
    warningSeconds: 9,
    stormMin: 24, stormMax: 36
  });

  const keys = new Set();
  const state = {
    seed: 0,
    terrainPhases: [],
    layerBands: [],
    middleTier: 12,
    ramps: [],
    rampsByTier: [],
    basin: { x: 0, z: 0, rx: 385, rz: 445, water: 0 },
    source: { id: 'spring-0', x: 0, z: -600, rate: SOURCE_RATE },
    sources: [],
    stoneDeposits: [],
    ironDeposits: [],
    trees: [],
    drills: [],
    shelters: [],
    nextShelterId: 1,
    nextDrillId: 1,
    spawn: { x: WORLD.xMin + 900, z: -260 },
    weather: { phase: 'clear', timeLeft: 720, gust: 0 },
    resourceHighlight: false,
    player: { x: WORLD.xMin + 900, z: -260, y: 0, vy: 0, grounded: true, facing: 1, walkTime: 0, moving: false, jumpOffset: 0, health: 100, crouching: false },
    camera: { x: WORLD.xMin + 900, z: -260, y: 80 },
    nodes: {},
    channels: [],
    nextNodeId: 1,
    nextChannelId: 1,
    nextChuteId: 1,
    inventory: { iron: 0, concrete: 0, glass: 0, chute: 0, hygrometer: 0, remoteDisplay: 0, compass: 0, stonePickaxe: 1, stoneAxe: 1, woodPole: 0, drill: 0, pump: 0 },
    moduleInventory: { x4: 0, x2: 0 },
    materials: { metal: 0, glassPane: 0, wire: 0, stone: 0, wood: 0, ironIngot: 0 },
    bagSlots: Array(27).fill(null),
    bagSlotCounts: Array(27).fill(0),
    hotbar: Array(9).fill(null),
    hotbarCounts: Array(9).fill(0),
    dragSource: null,
    dragTargets: [],
    inventorySelection: null,
    selectedHotbar: -1,
    inventoryOpen: false,
    craftInputId: null,
    selectedCraftId: null,
    openRecipeGroups: new Set(['devices']),
    hygrometers: [],
    nextHygrometerId: 1,
    heldItem: null,
    tool: 'select',
    channelType: 'iron',
    anchorNodeId: null,
    pointer: { x: 0, y: 0, inside: false, down: false },
    selectedChannelId: null,
    selectedObject: null,
    network: { route: [], flow: 0, waterMultiplier: 1, fillRate: 0 },
    elapsed: 0,
    lastTime: 0,
    toastTimer: 0,
    uiTimer: 0,
    selectedDeposit: null,
    specialDeposits: { copper: [], zinc: [], silicon: [], clay: [], voltite: [] },
    industryEngine: null,
    industryUI: null,
    industryLinkStart: null,
    industryLinkType: 'shaft',
    beltRotation: 0,
    machineToPlace: null
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = t => t * t * (3 - 2 * t);
  const distance2D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function mulberry32(seed) {
    return function random() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function newSeed() { return Math.floor(Math.random() * 900000000) + 100000000; }

  function terrainNoise(x, z) {
    // Broad, nearly level grassy shelves like the supplied reference images.
    // Small variation keeps the world organic without turning platforms into hills.
    const [p1, p2, p3, p4, p5] = state.terrainPhases;
    return Math.sin(z / 610 + p1) * 2.4
      + Math.sin(z / 330 + p2 + x / 680) * 1.6
      + Math.cos(x / 420 + p3) * 1.3
      + Math.sin((z + x * 1.15) / 510 + p4) * 1.3
      + Math.sin(z / 230 + x / 250 + p5) * 0.5;
  }

  function layerIndexAt(x) {
    // Binary search keeps terrain queries cheap with two dozen elevation bands.
    let low = 0, high = state.layerBands.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (x > state.layerBands[mid].end) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  // Grass colour is derived from the world's actual vertical Y coordinate.
  // It is global and camera-independent: every point at the same world height
  // gets the same shade, whether it is beside the player or on the far horizon.
  // The endpoints match the supplied height swatch (dark low, vivid high).
  function terrainHeightGradientRange() {
    // Use the full generated world's elevation range, not the currently visible
    // shelf or the player's local height. Include the small procedural surface
    // variation so the lowest and highest terrain still reach the endpoints.
    const heights = state.layerBands.map(band => band.height);
    if (!heights.length) return { min: WORLD.terrainBase - 8, max: WORLD.terrainBase + 8 };
    return {
      min: Math.min(...heights) - 8,
      max: Math.max(...heights) + 8
    };
  }

  function terrainGrassColorAtHeight(worldY) {
    const range = terrainHeightGradientRange();
    const t = clamp((worldY - range.min) / (range.max - range.min), 0, 1);
    // Chromebook-friendly contrast: deep forest green at the bottom, a clearly
    // visible saturated middle, and bright lime at the top. These are global
    // world-height stops, not player- or camera-relative shading.
    const stops = [
      { at: 0, rgb: [0, 38, 0] },
      { at: 0.5, rgb: [0, 145, 0] },
      { at: 1, rgb: [0, 255, 0] }
    ];
    const segment = t <= 0.5 ? [stops[0], stops[1]] : [stops[1], stops[2]];
    const localT = clamp((t - segment[0].at) / (segment[1].at - segment[0].at), 0, 1);
    const rgb = segment[0].rgb.map((value, index) => Math.round(value + (segment[1].rgb[index] - value) * localT));
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  function terrainLayerColors(tier) {
    // Exposed soil also becomes lighter at higher geological layers.
    const maxTier = Math.max(1, state.layerBands.length - 1);
    const t = clamp(tier / maxTier, 0, 1);
    const channel = (low, high) => Math.round(low + (high - low) * t);
    return {
      soilTop: `rgb(${channel(66, 150)}, ${channel(43, 97)}, 0)`,
      soilBottom: `rgb(${channel(42, 96)}, ${channel(27, 61)}, 0)`
    };
  }

  function baseHeight(x, z) {
    if (!state.layerBands.length) return WORLD.terrainBase + terrainNoise(x, z);
    return state.layerBands[layerIndexAt(x)].height + terrainNoise(x, z);
  }

  function basinRadius(x, z) {
    const dx = (x - state.basin.x) / state.basin.rx;
    const dz = (z - state.basin.z) / state.basin.rz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function terrainHeight(x, z) {
    const r = basinRadius(x, z);
    const land = baseHeight(x, z);
    const basinFloor = state.basin.floorY ?? 30;
    const basinRim = state.basin.rimY ?? 88;
    if (r < 0.61) return basinFloor + Math.sin(z / 58) * 1.2;
    if (r < 0.99) return lerp(basinFloor, basinRim, smoothstep((r - 0.61) / 0.38));
    if (r < 1.18) return lerp(basinRim, land, smoothstep((r - 0.99) / 0.19));
    // Elevation boundaries are sheer, climbable steps. There are deliberately
    // no ramps: descend by walking off an edge, or jump to climb the next shelf.
    return land;
  }

  function project(x, y, z) {
    const p = WORLD.projection;
    // Y is now the actual screen-vertical world axis. X spans the screen horizontally;
    // Z is depth and provides the small oblique offset used to show 3D terrain surfaces.
    return {
      x: W / 2 + (x - state.camera.x) * p.x + (z - state.camera.z) * p.z,
      y: 432 - (y - state.camera.y) * p.y + (z - state.camera.z) * p.depthSlope
    };
  }

  function polygon(points, fill, stroke = null, lineWidth = 1) {
    if (!points.length) return;
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function screenLine(a, b, color, width, dash = []) {
    const pa = project(a.x, a.y, a.z);
    const pb = project(b.x, b.y, b.z);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash(dash); ctx.stroke(); ctx.restore();
  }

  function worldEllipse(cx, cz, rx, rz, y, fill, stroke = null, lineWidth = 1, steps = 72) {
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const a = i / steps * Math.PI * 2;
      pts.push(project(cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz));
    }
    polygon(pts, fill, stroke, lineWidth);
  }

  function createNode(kind, x, y, z, id = null) {
    const nodeId = id || `n${state.nextNodeId++}`;
    const node = { id: nodeId, kind, x, y, z };
    state.nodes[nodeId] = node;
    return node;
  }

  String.prototype.toTitleCase = function () {
  return this.replace(/\b\w/g, c => c.toUpperCase());
};


  const ITEM_NAMES = {
    iron: 'Iron Channel', concrete: 'Concrete Channel', glass: 'Glass Channel', chute: 'Chute',
    x4: 'x4 Multiplier', x2: 'x2 Multiplier', hygrometer: 'Hygrometer', remoteDisplay: 'Remote Display',
    metal: 'Metal Plate', glassPane: 'Glass Pane', wire: 'Wire', compass: 'Compass',
    stonePickaxe: 'Stone Pickaxe', stoneAxe: 'Stone Axe', stone: 'Stone', wood: 'Wood', ironIngot: 'Iron',
    woodPole: 'Wood Pole', drill: 'Drill', pump: 'Water Pump'
  };
  const ITEM_GLYPHS = {
    iron: '▰', concrete: '▰', glass: '◇', chute: '▥', x4: '×4', x2: '×2',
    hygrometer: '◉', remoteDisplay: '▣', metal: 'M', glassPane: '◇', wire: '⌁',
    compass: '✥', stonePickaxe: '⚒', stoneAxe: '⚒', stone: '◆', wood: '▰', ironIngot: 'Fe',
    woodPole: '╱', drill: '⚙', pump: '◈'
  };
  for (const [id, def] of Object.entries(window.FTSRegistry.items)) {
    ITEM_NAMES[id] = def.name;
    ITEM_GLYPHS[id] = def.glyph;
  }

  function itemIconHTML(id) {
    const def = window.FTSRegistry.items[id];
    if (!def || !window.FTSAssets) return `<span class="item-glyph">${ITEM_GLYPHS[id] || '?'}</span>`;
    return window.FTSAssets.itemIconHTML(id, 'item-icon');
  }

  function resetInventory() {
    // A fresh world starts with only the two basic tools. Everything else must
    // be gathered, crafted, produced, or constructed by the player.
    state.materials = {
      metal: 0, glassPane: 0, wire: 0, stone: 0, wood: 0, ironIngot: 0,
      polishedStone: 0, stonePowder: 0, ironOre: 0, copperOre: 0, copperIngot: 0,
      zincOre: 0, zincIngot: 0, brassIngot: 0, brassPlate: 0, ironPlate: 0,
      sand: 0, silicon: 0, clay: 0, castingSand: 0, treeSap: 0, rubber: 0,
      voltite: 0, blankBoard: 0, transistor: 0, transformerCore: 0, battery: 0,
      shaft: 0, tungstenShaft: 0, drillBit: 0, belt: 0, conveyorChassis: 0,
      copperCoil: 0, logicBoard: 0, ironFlattener: 0, kilnPart: 0,
      condenserFrame: 0, blastFrame: 0, smokestack: 0, tungstenIngot: 0
    };
    for (const id of Object.keys(state.inventory)) state.inventory[id] = 0;
    for (const id of Object.keys(window.FTSRegistry.items)) {
      if (id === 'x4' || id === 'x2' || id in state.materials) continue;
      state.inventory[id] = 0;
    }
    for (const id of Object.keys(CHANNEL_TYPES)) state.inventory[id] = 0;
    state.inventory.compass = 0;
    state.inventory.stonePickaxe = 1;
    state.inventory.stoneAxe = 1;
    state.moduleInventory = { x4: 0, x2: 0 };
    state.bagSlots = Array(27).fill(null);
    state.bagSlotCounts = Array(27).fill(0);
    state.hotbar = ['stonePickaxe', 'stoneAxe', null, null, null, null, null, null, null];
    state.hotbarCounts = [1, 1, 0, 0, 0, 0, 0, 0, 0];
    state.inventorySelection = null;
    state.selectedHotbar = 0;
    state.inventoryOpen = false;
    state.hygrometers = [];
    state.nextHygrometerId = 1;
    state.heldItem = 'stonePickaxe';
    state.tool = 'pickaxe';
    state.resourceHighlight = false;
    document.getElementById('inventory-screen')?.classList.remove('open');
    syncResourceHighlightButton();
  }

  function itemCount(id) {
    if (Object.prototype.hasOwnProperty.call(state.inventory, id)) return state.inventory[id];
    if (id === 'x4' || id === 'x2') return state.moduleInventory[id] || 0;
    if (Object.prototype.hasOwnProperty.call(state.materials, id)) return state.materials[id];
    return 0;
  }

  const MAX_STACK_SIZE = 64;
  function allInventorySlots() { return [...state.hotbar, ...state.bagSlots]; }
  function getSlotCounts(type) { return type === 'hotbar' ? state.hotbarCounts : state.bagSlotCounts; }
  function getSlotArray(type) { return type === 'hotbar' ? state.hotbar : state.bagSlots; }
  function slotCount(type, index) { return getSlotCounts(type)?.[index] || 0; }

  function addItemToBag(id, amount = 1) {
    pruneEmptySlots();
    let remaining = Math.max(0, Math.floor(amount));
    if (!remaining) return true;
    const placements = [];
    // Fill hotbar stacks, then empty hotbar slots, before touching the backpack.
    for (const type of ['hotbar']) {
      const ids = getSlotArray(type), counts = getSlotCounts(type);
      for (let i = 0; i < ids.length && remaining > 0; i++) {
        if (ids[i] !== id || counts[i] >= MAX_STACK_SIZE) continue;
        const add = Math.min(remaining, MAX_STACK_SIZE - counts[i]);
        placements.push({ type, index: i, count: counts[i] + add }); remaining -= add;
      }
    }
    for (const type of ['hotbar']) {
      const ids = getSlotArray(type);
      for (let i = 0; i < ids.length && remaining > 0; i++) {
        if (ids[i] !== null) continue;
        const add = Math.min(remaining, MAX_STACK_SIZE);
        placements.push({ type, index: i, count: add }); remaining -= add;
      }
    }
    for (const type of ['bag']) {
      const ids = getSlotArray(type), counts = getSlotCounts(type);
      for (let i = 0; i < ids.length && remaining > 0; i++) {
        if (ids[i] !== id || counts[i] >= MAX_STACK_SIZE) continue;
        const add = Math.min(remaining, MAX_STACK_SIZE - counts[i]);
        placements.push({ type, index: i, count: counts[i] + add }); remaining -= add;
      }
    }
    for (const type of ['bag']) {
      const ids = getSlotArray(type);
      for (let i = 0; i < ids.length && remaining > 0; i++) {
        if (ids[i] !== null) continue;
        const add = Math.min(remaining, MAX_STACK_SIZE);
        placements.push({ type, index: i, count: add }); remaining -= add;
      }
    }
    if (remaining > 0) return false;
    for (const place of placements) {
      const ids = getSlotArray(place.type), counts = getSlotCounts(place.type);
      ids[place.index] = id; counts[place.index] = place.count;
    }
    return true;
  }

  function pruneEmptySlots() {
    let heldItemDepleted = false;
    for (const type of ['hotbar', 'bag']) {
      const ids = getSlotArray(type), counts = getSlotCounts(type);
      for (let i = 0; i < ids.length; i++) {
        if (ids[i] && (counts[i] <= 0 || itemCount(ids[i]) <= 0)) {
          if (ids[i] === state.heldItem) heldItemDepleted = true;
          ids[i] = null; counts[i] = 0;
        }
      }
    }
    if (state.inventorySelection && !getSlotArray(state.inventorySelection.type)[state.inventorySelection.index]) state.inventorySelection = null;
    if (heldItemDepleted) {
      state.heldItem = null; state.machineToPlace = null; state.moduleToInstall = null;
      state.industryLinkStart = null; state.selectedHotbar = -1; state.tool = 'select'; return true;
    }
    return false;
  }

  function swapInventorySlots(sourceType, sourceIndex, targetType, targetIndex) {
    const source = getSlotArray(sourceType), target = getSlotArray(targetType);
    const sourceCounts = getSlotCounts(sourceType), targetCounts = getSlotCounts(targetType);
    if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex) || sourceIndex < 0 || sourceIndex >= source.length || targetIndex < 0 || targetIndex >= target.length) return false;
    if (source === target && sourceIndex === targetIndex) return false;
    if (!source[sourceIndex] || sourceCounts[sourceIndex] <= 0) return false;
    [source[sourceIndex], target[targetIndex]] = [target[targetIndex], source[sourceIndex]];
    [sourceCounts[sourceIndex], targetCounts[targetIndex]] = [targetCounts[targetIndex], sourceCounts[sourceIndex]];
    state.inventorySelection = null;
    const touched = (sourceType === 'hotbar' && sourceIndex === state.selectedHotbar) || (targetType === 'hotbar' && targetIndex === state.selectedHotbar);
    if (touched) { const selected = state.hotbar[state.selectedHotbar]; if (selected && itemCount(selected) > 0) selectHotbar(state.selectedHotbar); else setTool('select'); }
    renderInventory(); return true;
  }

  function moveInventoryStack(sourceSlot, targetSlot) {
    const sourceIds = getSlotArray(sourceSlot.type), targetIds = getSlotArray(targetSlot.type);
    const sourceCounts = getSlotCounts(sourceSlot.type), targetCounts = getSlotCounts(targetSlot.type);
    const id = sourceIds[sourceSlot.index], amount = sourceCounts[sourceSlot.index];
    if (!id || amount <= 0 || (sourceSlot.type === targetSlot.type && sourceSlot.index === targetSlot.index)) return false;
    if (!targetIds[targetSlot.index]) {
      targetIds[targetSlot.index] = id; targetCounts[targetSlot.index] = amount;
      sourceIds[sourceSlot.index] = null; sourceCounts[sourceSlot.index] = 0;
    } else if (targetIds[targetSlot.index] === id && targetCounts[targetSlot.index] < MAX_STACK_SIZE) {
      const moved = Math.min(amount, MAX_STACK_SIZE - targetCounts[targetSlot.index]);
      targetCounts[targetSlot.index] += moved; sourceCounts[sourceSlot.index] -= moved;
      if (sourceCounts[sourceSlot.index] <= 0) { sourceIds[sourceSlot.index] = null; sourceCounts[sourceSlot.index] = 0; }
    } else return swapInventorySlots(sourceSlot.type, sourceSlot.index, targetSlot.type, targetSlot.index);
    state.inventorySelection = null;
    if (sourceSlot.type === 'hotbar' && sourceSlot.index === state.selectedHotbar) {
      if (targetSlot.type === 'hotbar') { state.selectedHotbar = targetSlot.index; selectHotbar(targetSlot.index); }
      else { state.selectedHotbar = -1; setTool('select'); }
    }
    renderInventory(); updateHotbar(); return true;
  }

  function distributeInventoryStack(sourceSlot, targets) {
    const sourceIds = getSlotArray(sourceSlot.type), sourceCounts = getSlotCounts(sourceSlot.type);
    const id = sourceIds[sourceSlot.index], total = sourceCounts[sourceSlot.index];
    if (!id || total <= 0) return false;
    const unique = [], seen = new Set();
    for (const slot of targets) {
      const key = `${slot.type}:${slot.index}`;
      if (key === `${sourceSlot.type}:${sourceSlot.index}` || seen.has(key)) continue;
      seen.add(key);
      const ids = getSlotArray(slot.type), counts = getSlotCounts(slot.type);
      if (!ids[slot.index] || (ids[slot.index] === id && counts[slot.index] < MAX_STACK_SIZE)) unique.push(slot);
    }
    if (!unique.length) return false;
    let remaining = total;
    for (let i = 0; i < unique.length; i++) {
      const slot = unique[i], ids = getSlotArray(slot.type), counts = getSlotCounts(slot.type);
      const desired = Math.ceil(remaining / (unique.length - i));
      const capacity = ids[slot.index] ? MAX_STACK_SIZE - counts[slot.index] : MAX_STACK_SIZE;
      const moved = Math.min(desired, capacity, remaining);
      if (moved <= 0) continue;
      if (!ids[slot.index]) ids[slot.index] = id;
      counts[slot.index] += moved; remaining -= moved;
    }
    sourceCounts[sourceSlot.index] = remaining;
    if (remaining <= 0) { sourceIds[sourceSlot.index] = null; sourceCounts[sourceSlot.index] = 0; }
    state.inventorySelection = null; renderInventory(); updateHotbar(); return remaining !== total;
  }

  function giveItem(id, amount = 1) {
    const target = Object.prototype.hasOwnProperty.call(state.materials, id) ? state.materials : state.inventory;
    if (!Object.prototype.hasOwnProperty.call(target, id)) target[id] = 0;
    if (!addItemToBag(id, amount)) return false;
    target[id] = (target[id] || 0) + amount; return true;
  }

  const LEGACY_CRAFT_RECIPES = {
    hygrometer: { name: 'Hygrometer', inputs: { metal: 2, glassPane: 1, wire: 1 }, output: { hygrometer: 1 }, category: 'Devices' },
    remoteDisplay: { name: 'Remote Display', inputs: { metal: 2, glassPane: 2, wire: 2 }, output: { remoteDisplay: 1 }, category: 'Devices' },
    woodPole: { name: 'Wood Pole', inputs: { wood: 2 }, output: { woodPole: 1 }, category: 'Building' }
  };

  function getCraftRecipe(id) {
    return LEGACY_CRAFT_RECIPES[id]
      || window.FTSRegistry.handRecipes[id]
      || window.FTSRegistry.machineBuildRecipes[id]
      || null;
  }

  function canCraftRecipe(recipe) {
    pruneEmptySlots();
    if (!recipe) return false;
    const inputs = recipe.inputs || {};
    if (!Object.entries(inputs).every(([material, amount]) => itemCount(material) >= amount)) return false;
    const outputs = recipe.output || {};
    const newSlotsNeeded = Object.entries(outputs).reduce((needed, [outputId, amount]) => {
      const freeStackSpace = ['hotbar', 'bag'].reduce((sum, type) => {
        const ids = getSlotArray(type), counts = getSlotCounts(type);
        return sum + ids.reduce((slotSum, id, index) => slotSum + (id === outputId ? Math.max(0, MAX_STACK_SIZE - counts[index]) : 0), 0);
      }, 0);
      return needed + Math.ceil(Math.max(0, amount - freeStackSpace) / MAX_STACK_SIZE);
    }, 0);
    const emptySlots = allInventorySlots().filter(slot => slot === null).length;
    return newSlotsNeeded <= emptySlots;
  }

  function craftItem(id) {
    const recipe = getCraftRecipe(id);
    if (!recipe) { showToast('That recipe is not available.'); return false; }
    const inputs = recipe.inputs || {};
    const missing = Object.entries(inputs).filter(([material, amount]) => itemCount(material) < amount);
    if (missing.length) {
      const [material, amount] = missing[0];
      showToast(`Need ${amount} ${ITEM_NAMES[material] || material}; you have ${itemCount(material)}.`);
      renderInventoryIfOpen();
      return false;
    }
    if (!canCraftRecipe(recipe)) {
      showToast('Your 36 inventory slots are full. Make room before crafting.');
      return false;
    }

    // Validate first, then consume inputs and deliver every output. This keeps a failed
    // craft from eating materials or producing only part of a multi-output recipe.
    for (const [material, amount] of Object.entries(inputs)) {
      if (!consumeItem(material, amount)) {
        showToast(`Could not consume ${ITEM_NAMES[material] || material}. Craft cancelled.`);
        renderInventoryIfOpen();
        return false;
      }
    }
    const outputs = recipe.output || {};
    for (const [outputId, amount] of Object.entries(outputs)) {
      if (!giveItem(outputId, amount)) {
        // This should only occur if another operation changed inventory capacity mid-craft.
        for (const [material, inputAmount] of Object.entries(inputs)) giveItem(material, inputAmount);
        showToast('Craft cancelled: there is no free inventory slot.');
        renderInventoryIfOpen();
        return false;
      }
    }
    renderInventoryIfOpen();
    updateHotbar();
    const outputName = Object.keys(outputs).map(outputId => `${ITEM_NAMES[outputId] || outputId}${outputs[outputId] > 1 ? ` ×${outputs[outputId]}` : ''}`).join(', ');
    showToast(`${outputName || recipe.name} crafted.`);
    return true;
  }

  function consumeItem(id, amount = 1) {
    const target = id in state.inventory ? state.inventory : id === 'x4' || id === 'x2' ? state.moduleInventory : state.materials;
    if (!Object.prototype.hasOwnProperty.call(target, id) || (target[id] || 0) < amount) return false;
    let remaining = amount;
    for (const type of ['hotbar', 'bag']) {
      const ids = getSlotArray(type), counts = getSlotCounts(type);
      for (let i = 0; i < ids.length && remaining > 0; i++) {
        if (ids[i] !== id) continue;
        const take = Math.min(remaining, counts[i]); counts[i] -= take; remaining -= take;
        if (counts[i] <= 0) { ids[i] = null; counts[i] = 0; }
      }
    }
    target[id] -= amount;
    const depletedHeldItem = pruneEmptySlots(); updateHotbar(); renderInventoryIfOpen();
    if (depletedHeldItem) setTool('select'); return true;
  }

  function updateHotbar() {
    pruneEmptySlots();
    const bars = [document.getElementById('hotbar-bar'), document.getElementById('inventory-hotbar')].filter(Boolean);
    if (!bars.length) return;
    const markup = state.hotbar.map((id, i) => {
      const active = i === state.selectedHotbar ? ' selected' : '';
      const chosen = state.inventorySelection?.type === 'hotbar' && state.inventorySelection.index === i ? ' chosen' : '';
      const count = id ? state.hotbarCounts[i] : 0;
      const disabled = !id || count <= 0;
      return `<button class="hotbar-slot${active}${chosen}" type="button" data-hotbar="${i}" draggable="${state.inventoryOpen && !disabled}" ${disabled ? 'data-empty="1"' : ''} title="${id ? ITEM_NAMES[id] : `Hotbar slot ${i + 1} (empty)`}">
        <span class="hotbar-key">${i + 1}</span>${id ? itemIconHTML(id) : '<span class="item-glyph"></span>'}<span class="item-count">${id && count > 0 ? count : ''}</span>
      </button>`;
    }).join('');
    bars.forEach(bar => { bar.innerHTML = markup; });
  }

  function renderInventory() {
    pruneEmptySlots();
    const screen = document.getElementById('inventory-screen');
    if (!screen) return;
    screen.classList.toggle('open', state.inventoryOpen);
    if (!state.inventoryOpen) return;
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = state.bagSlots.map((id, i) => {
      const count = id ? state.bagSlotCounts[i] : 0;
      const visibleId = id && count > 0 ? id : null;
      return `<button class="inventory-slot${state.inventorySelection?.type === 'bag' && state.inventorySelection.index === i ? ' chosen' : ''}" type="button" draggable="${!!visibleId}" data-bag="${i}" title="${visibleId ? `${ITEM_NAMES[visibleId]} · ${count}x` : `Empty slot ${i + 1}`}" ${!visibleId ? 'data-empty="1"' : ''}>
        ${visibleId ? itemIconHTML(visibleId) : '<span class="item-glyph"></span>'}<span class="slot-name">${visibleId ? ITEM_NAMES[visibleId] : ''}</span><span class="item-count">${visibleId ? count : ''}</span>
      </button>`;
    }).join('');
    const craft = document.getElementById('crafting-recipes');
    const previousCraftScroll = craft.scrollTop;
    const formatCost = inputs => Object.entries(inputs || {}).map(([m,n]) => `${ITEM_NAMES[m] || m} ×${n} (have ${itemCount(m)})`).join(' · ');
    const recipeRow = (id, recipe) => {
      const ready = canCraftRecipe(recipe);
      const missing = Object.entries(recipe.inputs || {}).find(([material, amount]) => itemCount(material) < amount);
      const status = missing
        ? `Need ${missing[1] - itemCount(missing[0])} more ${ITEM_NAMES[missing[0]] || missing[0]}`
        : ready ? 'Ready to craft' : 'Inventory full';
      return `<div class="craft-recipe"><div class="craft-recipe-info"><b>${recipe.name || ITEM_NAMES[id] || id}</b><small>${formatCost(recipe.inputs)}</small><em>${status}</em></div><button type="button" data-craft="${id}" ${ready ? '' : 'disabled'}>Craft</button></div>`;
    };
    const allHand = { ...LEGACY_CRAFT_RECIPES, ...window.FTSRegistry.handRecipes };
    const groups = [
      ['devices', 'DEVICES & BUILDING', Object.entries(allHand).filter(([id, recipe]) => ['Devices','Building'].includes(recipe.category))],
      ['components', 'HAND-CRAFTED COMPONENTS', Object.entries(allHand).filter(([id, recipe]) => !['Devices','Building'].includes(recipe.category))],
      ['machines', 'MACHINES & INFRASTRUCTURE', Object.entries(window.FTSRegistry.machineBuildRecipes)]
    ];
    craft.innerHTML = groups.map(([key, title, entries], index) => {
      const shouldOpen = state.openRecipeGroups.has(key) || (!state.openRecipeGroups.size && index === 0);
      return `<details class="recipe-group" data-group="${key}"${shouldOpen ? ' open' : ''}><summary>${title} <span>${entries.length}</span></summary>${entries.map(([id, recipe]) => recipeRow(id, recipe)).join('') || '<p class="craft-empty">No recipes in this category.</p>'}</details>`;
    }).join('') +
      `<div class="material-line">Materials: Stone ${state.materials.stone} · Wood ${state.materials.wood} · Iron ${state.materials.ironIngot}<br>Copper Ore ${state.materials.copperOre} · Zinc Ore ${state.materials.zincOre} · Silicon ${state.materials.silicon}<br>Voltite ${state.materials.voltite} · Glass ${state.materials.glassPane} · Wire ${state.materials.wire}</div>`;
    craft.scrollTop = previousCraftScroll;
    updateHotbar();
  }

  function toggleInventory(force = null) {
    state.inventoryOpen = force === null ? !state.inventoryOpen : !!force;
    keys.clear();
    if (!state.inventoryOpen) state.inventorySelection = null;
    if (state.inventoryOpen) { closeInspection(); }
    renderInventory();
  }

  function selectHotbar(index) {
    if (index < 0 || index >= state.hotbar.length) return;
    const id = state.hotbar[index];
    state.selectedHotbar = index;
    state.heldItem = id;
    const tools = {
      compass: 'compass', stonePickaxe: 'pickaxe', stoneAxe: 'axe', woodPole: 'woodPole',
      pump: 'pump', remoteDisplay: 'remote', chute: 'chute', hygrometer: 'hygrometer',
      iron: 'channel', concrete: 'channel', glass: 'channel', x4: 'module', x2: 'module',
      conveyorBelt: 'belt', shaft: 'shaftLink', tungstenShaft: 'moltenLink', mainsCable: 'powerLink'
    };
    const itemDef = window.FTSRegistry.items[id];
    if (id === 'x4' || id === 'x2') state.moduleToInstall = id;
    if (itemDef?.category === 'machine' && id !== 'pump') {
      state.machineToPlace = id;
      setTool('machine');
    } else if (['shaft','tungstenShaft'].includes(id)) {
      state.industryLinkType = id;
      state.industryLinkStart = null;
      setTool(id === 'tungstenShaft' ? 'moltenLink' : 'shaftLink');
    } else if (id === 'mainsCable') {
      state.industryLinkStart = null;
      setTool('powerLink');
    } else {
      state.machineToPlace = null;
      setTool(tools[id] || 'select', ['iron', 'concrete', 'glass'].includes(id) ? id : null);
    }
    updateHotbar();
  }

  function bindInventoryEvents() {
    const grid = document.getElementById('inventory-grid'), inventoryHotbar = document.getElementById('inventory-hotbar');
    const crafting = document.getElementById('crafting-recipes');
    const slotFromTarget = (target, containerType) => {
      const hotbarSlot = target.closest('[data-hotbar]');
      if (hotbarSlot && containerType === 'hotbar') return { type: 'hotbar', index: Number(hotbarSlot.dataset.hotbar) };
      const bagSlot = target.closest('[data-bag]');
      if (bagSlot && containerType === 'bag') return { type: 'bag', index: Number(bagSlot.dataset.bag) };
      return null;
    };
    const bindSlotContainer = (container, containerType) => {
      if (!container) return;
      container.addEventListener('dragstart', event => {
        const slot = slotFromTarget(event.target, containerType);
        if (!state.inventoryOpen || !slot || !slotCount(slot.type, slot.index)) { event.preventDefault(); return; }
        const id = getSlotArray(slot.type)[slot.index];
        state.dragSource = slot; state.dragTargets = [];
        event.target.closest('[data-hotbar], [data-bag]')?.classList.add('drag-source');
        event.dataTransfer.setData('application/x-fts-slot', `${slot.type}:${slot.index}`);
        event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move';
      });
      container.addEventListener('dragenter', event => {
        if (!state.inventoryOpen || !state.dragSource) return;
        const slot = slotFromTarget(event.target, containerType);
        if (slot && !state.dragTargets.some(x => x.type === slot.type && x.index === slot.index)) {
          state.dragTargets.push(slot); event.target.closest('[data-hotbar], [data-bag]')?.classList.add('drag-target');
        }
      });
      container.addEventListener('dragover', event => { if (state.inventoryOpen) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } });
      container.addEventListener('drop', event => {
        if (!state.inventoryOpen) return;
        const targetSlot = slotFromTarget(event.target, containerType), sourceValue = event.dataTransfer.getData('application/x-fts-slot');
        if (!targetSlot || !sourceValue) return;
        event.preventDefault(); const [sourceType, sourceIndex] = sourceValue.split(':');
        const sourceSlot = { type: sourceType, index: Number(sourceIndex) };
        const targets = state.dragTargets.length > 1 ? state.dragTargets : [targetSlot];
        if (targets.length > 1) distributeInventoryStack(sourceSlot, targets); else moveInventoryStack(sourceSlot, targetSlot);
        state.dragSource = null; state.dragTargets = [];
        document.querySelectorAll('.drag-source, .drag-target').forEach(node => node.classList.remove('drag-source', 'drag-target'));
      });
      container.addEventListener('dragend', () => {
        state.dragSource = null; state.dragTargets = [];
        document.querySelectorAll('.drag-source, .drag-target').forEach(node => node.classList.remove('drag-source', 'drag-target'));
      });
      container.addEventListener('click', event => {
        if (!state.inventoryOpen) return;
        const targetSlot = slotFromTarget(event.target, containerType); if (!targetSlot) return;
        event.preventDefault();
        if (!state.inventorySelection) {
          if (getSlotArray(targetSlot.type)[targetSlot.index] && slotCount(targetSlot.type, targetSlot.index) > 0) {
            state.inventorySelection = targetSlot; renderInventory();
          }
          return;
        }
        moveInventoryStack(state.inventorySelection, targetSlot);
      });
      container.addEventListener('contextmenu', event => {
        if (!state.inventoryOpen || containerType !== 'hotbar') return;
        const slot = slotFromTarget(event.target, 'hotbar'); if (!slot) return;
        event.preventDefault(); const id = state.hotbar[slot.index], amount = state.hotbarCounts[slot.index];
        if (!id || amount <= 0) return;
        const empty = state.bagSlots.indexOf(null); if (empty < 0) { showToast('No empty backpack slot.'); return; }
        state.bagSlots[empty] = id; state.bagSlotCounts[empty] = amount;
        state.hotbar[slot.index] = null; state.hotbarCounts[slot.index] = 0;
        if (state.selectedHotbar === slot.index) setTool('select'); renderInventory();
      });
    };
    bindSlotContainer(grid, 'bag'); bindSlotContainer(inventoryHotbar, 'hotbar');
    crafting.addEventListener('click', event => {
      const summary = event.target.closest('details.recipe-group > summary');
      if (summary) { event.preventDefault(); const group = summary.parentElement, key = group.dataset.group, open = !group.open; if (open) state.openRecipeGroups.add(key); else state.openRecipeGroups.delete(key); group.open = open; return; }
      const button = event.target.closest('button[data-craft]'); if (!button || button.disabled) return;
      event.preventDefault(); event.stopPropagation(); craftItem(button.dataset.craft);
    });
  }

  function generateTerrain(seed = newSeed()) {
    state.seed = seed;
    const r = mulberry32(seed);
    state.terrainPhases = [r() * Math.PI * 2, r() * Math.PI * 2, r() * Math.PI * 2, r() * Math.PI * 2, r() * Math.PI * 2];

    // Twenty-five broad, rising elevation shelves across a 48 km X span.
    // A minimum band width prevents narrow, awkward slivers between levels.
    // 25 shelves give the world a true middle elevation (tier 12), which is
    // where the Empty Sea and starting area are placed.
    const layerCount = 25;
    state.middleTier = Math.floor(layerCount / 2);
    const totalWidth = WORLD.xMax - WORLD.xMin;
    const minimumBandWidth = 1500;
    const starterBandWidth = 3600;
    const seaBandWidth = 3200;
    const bandWidths = Array(layerCount).fill(minimumBandWidth);
    bandWidths[0] = starterBandWidth;
    bandWidths[state.middleTier] = seaBandWidth;
    const flexibleBands = bandWidths.map((_, index) => index).filter(index => index !== 0 && index !== state.middleTier);
    const fixedAndMinimumWidth = bandWidths.reduce((sum, width) => sum + width, 0);
    const remainingExtra = totalWidth - fixedAndMinimumWidth;
    const widthWeights = flexibleBands.map(() => 0.78 + r() * 0.44);
    const weightTotal = widthWeights.reduce((sum, value) => sum + value, 0);
    flexibleBands.forEach((bandIndex, index) => {
      bandWidths[bandIndex] += remainingExtra * widthWeights[index] / weightTotal;
    });
    const boundaries = [];
    let cursor = WORLD.xMin;
    for (let i = 0; i < layerCount - 1; i++) {
      cursor += bandWidths[i];
      boundaries.push(cursor);
    }

    const levels = [];
    let elevation = 68 + r() * 10;
    for (let i = 0; i < layerCount; i++) {
      if (i > 0) elevation += 88 + r() * 9;
      levels.push(elevation + (r() - 0.5) * 5);
    }
    state.layerBands = levels.map((height, i) => ({
      start: i ? boundaries[i - 1] : WORLD.xMin,
      end: i < boundaries.length ? boundaries[i] : WORLD.xMax,
      height,
      tier: i
    }));

    // Centre the Empty Sea on the world's middle elevation shelf. Spawn on the
    // same shelf, just outside the outer shoreline, so the basin is nearby and
    // the opening view already shows the mid-range terrain colour.
    const middleBand = state.layerBands[state.middleTier];
    const middleBandCenterX = (middleBand.start + middleBand.end) / 2;
    state.basin = {
      x: middleBandCenterX,
      z: (WORLD.zMin + WORLD.zMax) / 2 + (r() - 0.5) * 320,
      rx: 980 + r() * 140,
      rz: 1260 + r() * 180,
      water: 0,
      tier: state.middleTier
    };
    state.spawn = {
      x: state.basin.x,
      z: state.basin.z - state.basin.rz * 1.32
    };
    state.basin.rimY = baseHeight(state.basin.x, state.basin.z) + 8;
    state.basin.floorY = state.basin.rimY - 145;

    // No generated ramps. Elevation shelves meet at sharp cliffs and are
    // traversed using the jump/fall physics in updatePlayer().
    state.ramps = [];
    state.rampsByTier = [];

    // Pick points from a particular shelf so every elevation band has resources.
    const randomLandPoint = (layerIndex, avoidStart = false) => {
      const band = state.layerBands[clamp(layerIndex, 0, layerCount - 1)];
      const marginX = Math.min(180, (band.end - band.start) * 0.12);
      let x = (band.start + band.end) / 2, z = 0, tries = 0;
      do {
        x = band.start + marginX + r() * Math.max(1, band.end - band.start - marginX * 2);
        z = WORLD.zMin + 260 + r() * (WORLD.zMax - WORLD.zMin - 520);
        tries++;
      } while ((basinRadius(x, z) < 1.24 || (avoidStart && Math.hypot(x - state.spawn.x, z - state.spawn.z) < 440)) && tries < 160);
      return { x, z };
    };

    state.sources = [];
    for (let layer = 0; layer < layerCount; layer++) {
      const count = 6 + Math.floor(r() * 4); // 6–9 springs on every shelf.
      for (let j = 0; j < count; j++) {
        const point = randomLandPoint(layer, true);
        state.sources.push({
          id: `spring-${state.sources.length}`,
          ...point,
          rate: Math.round(420 + r() * 580),
          tier: layer
        });
      }
    }
    // A guaranteed nearby source makes the first construction lesson discoverable.
    state.sources.unshift({ id: 'spring-near-spawn', x: state.spawn.x - 220, z: state.spawn.z - 250, rate: 720, tier: state.middleTier });
    state.source = state.sources[0];

    state.stoneDeposits = [];
    state.ironDeposits = [];
    state.trees = [];
    state.drills = [];
    state.specialDeposits = { copper: [], zinc: [], silicon: [], clay: [], voltite: [] };
    for (let layer = 0; layer < layerCount; layer++) {
      // Roughly 500+ stone deposits, 300+ iron deposits and 700+ trees per world.
      const stoneCount = 19 + Math.floor(r() * 8);
      const ironCount = 10 + Math.floor(r() * 6);
      const treeCount = 24 + Math.floor(r() * 13);
      for (let i = 0; i < stoneCount; i++) {
        const point = randomLandPoint(layer, true);
        state.stoneDeposits.push({ id: `stone-${state.stoneDeposits.length}`, ...point, remaining: 18 + Math.floor(r() * 34), size: 22 + r() * 18, tier: layer });
      }
      for (let i = 0; i < ironCount; i++) {
        const point = randomLandPoint(layer, true);
        state.ironDeposits.push({ id: `iron-${state.ironDeposits.length}`, ...point, remaining: 110 + Math.floor(r() * 170), size: 25 + r() * 17, drillId: null, tier: layer });
      }
      for (let i = 0; i < treeCount; i++) {
        const point = randomLandPoint(layer, true);
        state.trees.push({ id: `tree-${state.trees.length}`, ...point, wood: 5 + Math.floor(r() * 7), cut: 0, size: 24 + r() * 17, tier: layer });
      }
      const specialCounts = {
        copper: 5 + Math.floor(r() * 4), zinc: 4 + Math.floor(r() * 4),
        silicon: 3 + Math.floor(r() * 3), clay: 4 + Math.floor(r() * 4), voltite: 1 + Math.floor(r() * 2)
      };
      for (const [type, count] of Object.entries(specialCounts)) {
        for (let i = 0; i < count; i++) {
          const point = randomLandPoint(layer, true);
          state.specialDeposits[type].push({
            id: `${type}-${state.specialDeposits[type].length}`, ...point,
            remaining: type === 'voltite' ? 80 + Math.floor(r() * 140) : 45 + Math.floor(r() * 90),
            size: type === 'voltite' ? 26 + r() * 16 : 17 + r() * 14, tier: layer
          });
        }
      }
    }

    // Keep starter resources close to spawn, without making the rest of the world empty.
    state.stoneDeposits.unshift({ id: 'stone-near-spawn', x: state.spawn.x + 74, z: state.spawn.z - 20, remaining: 35, size: 34, tier: state.middleTier });
    state.trees.unshift({ id: 'tree-near-spawn', x: state.spawn.x - 68, z: state.spawn.z + 32, wood: 8, cut: 0, size: 31, tier: state.middleTier });

    state.player.x = state.spawn.x;
    state.player.z = state.spawn.z;
    state.player.y = terrainHeight(state.player.x, state.player.z);
    state.player.vy = 0; state.player.jumpOffset = 0; state.player.grounded = true;
    state.player.walkTime = 0; state.player.health = 100; state.player.crouching = false; state.player.sheltered = false;
    state.player.moving = false;
    state.camera.x = state.player.x; state.camera.z = state.player.z; state.camera.y = state.player.y;
    state.nodes = {}; state.channels = [];
    state.industryEngine?.reset();
    state.industryUI?.close();
    state.nextNodeId = 1; state.nextChannelId = 1; state.nextChuteId = 1;
    state.nextShelterId = 1; state.nextDrillId = 1;
    state.shelters = [];
    state.anchorNodeId = null; state.selectedChannelId = null; state.selectedObject = null;
    state.network = { route: [], routes: [], flow: 0, waterMultiplier: 1, fillRate: 0, metrics: {} };
    state.weather = { phase: 'clear', timeLeft: WEATHER_TUNING.initialClearMin + r() * (WEATHER_TUNING.initialClearMax - WEATHER_TUNING.initialClearMin), gust: 0 };
    state.selectedDeposit = null;

    state.sources.forEach(source => {
      const portZ = source.z + 58;
      const node = createNode('source', source.x, terrainHeight(source.x, portZ) + 18, portZ, source.id);
      node.sourceId = source.id;
    });
    const basinPortZ = state.basin.z - state.basin.rz * 0.73;
    createNode('basin', state.basin.x, terrainHeight(state.basin.x, basinPortZ) + 18, basinPortZ, 'basin');
    resetInventory();
    setTool('pickaxe');
    closeInspection();
    updateUI(true);
  }

  function terrainViewportBounds() {
    // Build enough terrain mesh to cover the whole viewport, not a small patch
    // around the player. The projection mixes depth into screen X and Y, so the
    // visible world bounds are derived from the canvas dimensions and projection.
    // A 160-unit height allowance keeps adjacent elevation shelves covered too.
    const projection = WORLD.projection;
    const verticalPad = 90;
    const heightAllowance = 160;
    const zTopOffset = (0 - 432 - verticalPad - heightAllowance * projection.y) / projection.depthSlope;
    const zBottomOffset = (H - 432 + verticalPad + heightAllowance * projection.y) / projection.depthSlope;
    const zStart = Math.max(WORLD.zMin, Math.floor((state.camera.z + zTopOffset) / WORLD.zStep) * WORLD.zStep);
    const zEnd = Math.min(WORLD.zMax, state.camera.z + zBottomOffset);
    const maxDepthOffset = Math.max(Math.abs(zStart - state.camera.z), Math.abs(zEnd - state.camera.z));
    const xSpan = (W / 2 + maxDepthOffset * Math.abs(projection.z)) / Math.abs(projection.x) + 100;
    const xStart = Math.max(WORLD.xMin, Math.floor((state.camera.x - xSpan) / WORLD.xStep) * WORLD.xStep);
    const xEnd = Math.min(WORLD.xMax, state.camera.x + xSpan);
    return { xStart, xEnd, zStart, zEnd, xStep: WORLD.xStep, zStep: WORLD.zStep };
  }



function drawTerrain() {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, W, H);

    // Render a circular patch around the player.
    // Large enough to cover the visible viewport.
    const TERRAIN_RENDER_RADIUS = 6000;
    const radiusSq = TERRAIN_RENDER_RADIUS * TERRAIN_RENDER_RADIUS;

    const px = state.player.x;
    const pz = state.player.z;

    const xStart = Math.max(WORLD.xMin, px - TERRAIN_RENDER_RADIUS);
    const xEnd = Math.min(WORLD.xMax, px + TERRAIN_RENDER_RADIUS);
    const zStart = Math.max(WORLD.zMin, pz - TERRAIN_RENDER_RADIUS);
    const zEnd = Math.min(WORLD.zMax, pz + TERRAIN_RENDER_RADIUS);

    const xs = [];
    const zs = [];

    for (let x = xStart; x <= xEnd + 0.001; x += WORLD.xStep) {
        xs.push(x);
    }
    if (xs[xs.length - 1] < xEnd) xs.push(xEnd);

    for (let z = zStart; z <= zEnd + 0.001; z += WORLD.zStep) {
        zs.push(z);
    }
    if (zs[zs.length - 1] < zEnd) zs.push(zEnd);

    // Cache terrain heights. Outside the circular render radius is skipped.
    const h = xs.map(x => zs.map(z => {
        const dx = x - px;
        const dz = z - pz;

        if (dx * dx + dz * dz > radiusSq) return null;
        return terrainHeight(x, z);
    }));

    const validCell = (i, j) =>
        h[i][j] !== null &&
        h[i + 1][j] !== null &&
        h[i][j + 1] !== null &&
        h[i + 1][j + 1] !== null;

    const cellAverage = (i, j) =>
        (h[i][j] + h[i + 1][j] + h[i][j + 1] + h[i + 1][j + 1]) / 4;

    // Draw exposed cliff faces.
    for (let i = 0; i < xs.length - 1; i++) {
        for (let j = 0; j < zs.length - 1; j++) {
            if (!validCell(i, j)) continue;

            if (i + 1 < xs.length - 1 && validCell(i + 1, j)) {
                const x = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
                const a0 = h[i][j], b0 = h[i + 1][j];
                const a1 = h[i][j + 1], b1 = h[i + 1][j + 1];

                if (Math.max(Math.abs(a0 - b0), Math.abs(a1 - b1)) > 22) {
                    const high0 = Math.max(a0, b0), low0 = Math.min(a0, b0);
                    const high1 = Math.max(a1, b1), low1 = Math.min(a1, b1);

                    const top0 = project(x, high0, z0);
                    const top1 = project(x, high1, z1);
                    const lowPoint0 = project(x, low0, z0);
                    const lowPoint1 = project(x, low1, z1);

                    const lowerTier = Math.min(
                        layerIndexAt(x - 1),
                        layerIndexAt(x + 1)
                    );

                    const shade = terrainLayerColors(lowerTier);
                    const grad = ctx.createLinearGradient(
                        top0.x, top0.y, lowPoint0.x, lowPoint0.y
                    );

                    grad.addColorStop(0, shade.soilTop);
                    grad.addColorStop(1, shade.soilBottom);

                    polygon(
                        [top0, top1, lowPoint1, lowPoint0],
                        grad,
                        shade.soilBottom,
                        1.2
                    );
                }
            }

            if (j + 1 < zs.length - 1 && validCell(i, j + 1)) {
                const z = zs[j + 1], x0 = xs[i], x1 = xs[i + 1];
                const a0 = h[i][j], b0 = h[i][j + 1];
                const a1 = h[i + 1][j], b1 = h[i + 1][j + 1];

                if (Math.max(Math.abs(a0 - b0), Math.abs(a1 - b1)) > 22) {
                    const high0 = Math.max(a0, b0), low0 = Math.min(a0, b0);
                    const high1 = Math.max(a1, b1), low1 = Math.min(a1, b1);

                    const top0 = project(x0, high0, z);
                    const top1 = project(x1, high1, z);
                    const lowPoint0 = project(x0, low0, z);
                    const lowPoint1 = project(x1, low1, z);

                    const shade = terrainLayerColors(
                        layerIndexAt((x0 + x1) / 2)
                    );

                    const grad = ctx.createLinearGradient(
                        top0.x, top0.y, lowPoint0.x, lowPoint0.y
                    );

                    grad.addColorStop(0, shade.soilTop);
                    grad.addColorStop(1, shade.soilBottom);

                    polygon(
                        [top0, top1, lowPoint1, lowPoint0],
                        grad,
                        shade.soilBottom,
                        1.1
                    );
                }
            }
        }
    }

    // Draw the coloured upper surface.
    for (let i = 0; i < xs.length - 1; i++) {
        for (let j = 0; j < zs.length - 1; j++) {
            if (!validCell(i, j)) continue;

            const x0 = xs[i], x1 = xs[i + 1];
            const z0 = zs[j], z1 = zs[j + 1];

            const r = basinRadius(
                (x0 + x1) / 2,
                (z0 + z1) / 2
            );

            const yMid = cellAverage(i, j);
            let fill = terrainGrassColorAtHeight(yMid);

            if (r < 0.61) fill = '#123f9b';
            else if (r < 0.99) fill = COLORS.sand;

            const pts = [
                project(x0, h[i][j], z0),
                project(x1, h[i + 1][j], z0),
                project(x1, h[i + 1][j + 1], z1),
                project(x0, h[i][j + 1], z1)
            ];

            ctx.beginPath();
            pts.forEach((point, index) =>
                index
                    ? ctx.lineTo(point.x, point.y)
                    : ctx.moveTo(point.x, point.y)
            );

            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();

            ctx.strokeStyle = fill;
            ctx.lineWidth = 1.25;
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
    }

    // Draw world-edge soil slabs when an actual world boundary is visible.
    if (xs.length > 1 && xs[0] <= WORLD.xMin + 1) {
        const x = xs[0];

        const top0 = project(x, terrainHeight(x, zStart), zStart);
        const top1 = project(x, terrainHeight(x, zEnd), zEnd);
        const bottom0 = project(x, -130, zStart);
        const bottom1 = project(x, -130, zEnd);

        const shade = terrainLayerColors(layerIndexAt(x));

        polygon(
            [top0, top1, bottom1, bottom0],
            shade.soilTop,
            '#171717',
            2
        );
    }

    if (xs.length > 1 && xs[xs.length - 1] >= WORLD.xMax - 1) {
        const x = xs[xs.length - 1];

        const top0 = project(x, terrainHeight(x, zStart), zStart);
        const top1 = project(x, terrainHeight(x, zEnd), zEnd);
        const bottom0 = project(x, -130, zStart);
        const bottom1 = project(x, -130, zEnd);

        const shade = terrainLayerColors(layerIndexAt(x));
        const grad = ctx.createLinearGradient(
            top0.x, top0.y, bottom0.x, bottom0.y
        );

        grad.addColorStop(0, shade.soilTop);
        grad.addColorStop(1, shade.soilBottom);

        polygon(
            [top0, top1, bottom1, bottom0],
            grad,
            '#171717',
            2
        );
    }

    if (zs.length > 1 && zs[0] <= WORLD.zMin + 1) {
        const z = zs[0];

        const top0 = project(xStart, terrainHeight(xStart, z), z);
        const top1 = project(xEnd, terrainHeight(xEnd, z), z);
        const bottom0 = project(xStart, -130, z);
        const bottom1 = project(xEnd, -130, z);

        const shade = terrainLayerColors(
            layerIndexAt((xStart + xEnd) / 2)
        );

        polygon(
            [top0, top1, bottom1, bottom0],
            shade.soilTop,
            '#171717',
            2
        );
    }

    if (zs.length > 1 && zs[zs.length - 1] >= WORLD.zMax - 1) {
        const z = zs[zs.length - 1];

        const top0 = project(xStart, terrainHeight(xStart, z), z);
        const top1 = project(xEnd, terrainHeight(xEnd, z), z);
        const bottom0 = project(xStart, -130, z);
        const bottom1 = project(xEnd, -130, z);

        const shade = terrainLayerColors(
            layerIndexAt((xStart + xEnd) / 2)
        );

        polygon(
            [top0, top1, bottom1, bottom0],
            shade.soilTop,
            '#171717',
            2
        );
    }
}

  function drawBasin() {
    const b = state.basin;
    const outerY = b.rimY;
    worldEllipse(b.x, b.z, b.rx, b.rz, outerY, COLORS.sand, COLORS.sandEdge, 6);
    worldEllipse(b.x, b.z, b.rx * 0.64, b.rz * 0.64, b.floorY, '#0a3b91', COLORS.waterEdge, 6);
    const progress = clamp(b.water / BASIN_CAPACITY, 0, 1);
    const scale = 0.18 + 0.82 * Math.sqrt(progress);
    const waterY = b.floorY + 12 + progress * 82;
    worldEllipse(b.x, b.z, b.rx * 0.64 * scale, b.rz * 0.64 * scale, waterY, COLORS.water, '#1267d9', 2);
    const center = project(b.x, waterY, b.z);
    ctx.beginPath(); ctx.arc(center.x, center.y, 5, 0, Math.PI * 2); ctx.fillStyle = COLORS.yellow; ctx.fill();
    const label = project(b.x, b.rimY + 22, b.z + b.rz + 28);
    ctx.fillStyle = COLORS.ink; ctx.font = `bold 13px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('EMPTY SEA', label.x, label.y); ctx.textAlign = 'left';
  }

  function isNearCamera(x, z, marginX = 1500, marginZ = 2200) {
    return Math.abs(x - state.camera.x) <= marginX && Math.abs(z - state.camera.z) <= marginZ;
  }

  function syncResourceHighlightButton() {
    const button = document.getElementById('resource-highlight');
    if (!button) return;
    button.classList.toggle('active', !!state.resourceHighlight);
    button.setAttribute('aria-pressed', String(!!state.resourceHighlight));
    button.textContent = state.resourceHighlight ? 'RESOURCES ON · H' : 'HIGHLIGHT RESOURCES · H';
  }

  function toggleResourceHighlights(force = null) {
    state.resourceHighlight = force === null ? !state.resourceHighlight : !!force;
    syncResourceHighlightButton();
    showToast(state.resourceHighlight
      ? 'Resource highlights enabled · visible deposits are marked.'
      : 'Resource highlights hidden.');
    return state.resourceHighlight;
  }

  function drawResourceHighlight(resource, label, color, radius = 30, labelHeight = 36) {
    if (!state.resourceHighlight) return;
    const ground = project(resource.x, terrainHeight(resource.x, resource.z) + 2, resource.z);
    const textPoint = project(resource.x, terrainHeight(resource.x, resource.z) + labelHeight, resource.z);
    ctx.save();
    // Ground rings provide a clear Chromebook-visible marker without hitbox/debug outlines.
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(ground.x, ground.y + 2, radius * 1.22, radius * 0.48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.98;
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(ground.x, ground.y + 2, radius, radius * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = `bold 9px ${FONT}`;
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#071007'; ctx.strokeText(label, textPoint.x, textPoint.y);
    ctx.fillStyle = color; ctx.fillText(label, textPoint.x, textPoint.y);
    ctx.restore();
  }

  function drawSource() {
    for (const source of state.sources) {
      if (!isNearCamera(source.x, source.z)) continue;
      const y = terrainHeight(source.x, source.z) + 3;
      const size = source.id === state.source.id ? 48 : 34;
      if (!drawWorldAsset('resources', 'waterSource', source.x, y + size * 1.2, source.z, size * 2.6, size * 2.5)) {
        worldEllipse(source.x, source.z, size, size * 1.36, y, '#a9b13c', '#536d22', 3);
      worldEllipse(source.x, source.z, size * .78, size * 1.12, y + 3, '#1769ce', '#0849a7', 3);
      const c = project(source.x, y + 5, source.z);
      ctx.fillStyle = '#7fcfff'; ctx.beginPath(); ctx.ellipse(c.x - 6, c.y - 4, 9, 4, -.25, 0, Math.PI * 2); ctx.fill();
      }
      if (source.id === state.source.id || Math.hypot(source.x - state.player.x, source.z - state.player.z) < 290) {
        const label = project(source.x, y + 38, source.z - size * 1.45);
        ctx.fillStyle = COLORS.ink; ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText('WATER SOURCE', label.x, label.y);
        ctx.font = `8px ${FONT}`; ctx.fillText(`${source.rate} L/s`, label.x, label.y + 11); ctx.textAlign = 'left';
      }
      drawResourceHighlight(source, 'WATER SOURCE', '#62c9ff', size * 1.02, 48);
    }
  }


  function worldAssetGeometry(group, key, x, y, z, maxWidth, maxHeight) {
    const path = window.FTSRegistry.worldAssets?.[group]?.[key];
    const image = path ? window.FTSAssets?.get(path) : null;
    if (!image || !image.naturalWidth || !image.naturalHeight) return null;
    let width = maxWidth, height = maxHeight;
    const ratio = image.naturalWidth / image.naturalHeight;
    if (width / height > ratio) width = height * ratio;
    else height = width / ratio;
    const anchor = project(x, y, z);
    return {
      image, anchor,
      left: anchor.x - width / 2,
      right: anchor.x + width / 2,
      top: anchor.y - height,
      bottom: anchor.y,
      width, height,
      centerX: anchor.x,
      centerY: anchor.y - height / 2
    };
  }

  function drawWorldAsset(group, key, x, y, z, maxWidth, maxHeight) {
    const geometry = worldAssetGeometry(group, key, x, y, z, maxWidth, maxHeight);
    if (!geometry) return false;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(geometry.image, geometry.left, geometry.top, geometry.width, geometry.height);
    ctx.restore();
    return true;
  }

  function makeScreenBounds(left, top, right, bottom, padding = 7) {
    return { left: left - padding, top: top - padding, right: right + padding, bottom: bottom + padding,
      centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
  }

  function boundsHitScore(bounds, mx, my) {
    if (!bounds || mx < bounds.left || mx > bounds.right || my < bounds.top || my > bounds.bottom) return Infinity;
    // Prefer the closest visual centre when two resource sprites overlap.
    const rx = Math.max(1, (bounds.right - bounds.left) / 2);
    const ry = Math.max(1, (bounds.bottom - bounds.top) / 2);
    const nx = (mx - bounds.centerX) / rx;
    const ny = (my - bounds.centerY) / ry;
    return nx * nx + ny * ny;
  }

  // Hit geometry deliberately mirrors the geometry used by drawResources() and
  // drawSpecialDeposits(). Sprite-backed resources use their actual scaled image
  // rectangle and bottom-centre anchor; fallback shapes use their visible extents.
  function getResourceScreenBounds(kind, resource, subtype = null) {
    const x = resource.x, z = resource.z, y = terrainHeight(x, z);
    if (kind === 'stone' || kind === 'iron') {
      const offset = kind === 'stone' ? 8 : 7;
      const key = kind === 'stone' ? 'stoneDeposit' : 'ironDeposit';
      const geometry = worldAssetGeometry('resources', key, x, y + offset, z, resource.size * 2.2, resource.size * 1.7);
      if (geometry) return makeScreenBounds(geometry.left, geometry.top, geometry.right, geometry.bottom, 5);
      const c = project(x, y + offset, z), size = resource.size;
      return makeScreenBounds(c.x - size, c.y - size, c.x + size, c.y + 7, 7);
    }
    if (kind === 'tree') {
      const geometry = worldAssetGeometry('resources', 'tree', x, y + resource.size * 2.1, z, resource.size * 3.2, resource.size * 3.8);
      if (geometry) return makeScreenBounds(geometry.left, geometry.top, geometry.right, geometry.bottom, 6);
      const trunk = project(x, y + resource.size * 0.8, z);
      const top = project(x, y + resource.size * 2.9, z);
      const size = resource.size;
      return makeScreenBounds(top.x - size, top.y - size * 0.9, top.x + size * 0.9, Math.max(top.y + size * 0.9, trunk.y + 7), 8);
    }
    if (kind === 'special') {
      const anchorY = y + 7 + resource.size * 1.1;
      const geometry = worldAssetGeometry('resources', `${subtype}Deposit`, x, anchorY, z, resource.size * 2.4, resource.size * 2.2);
      if (geometry) return makeScreenBounds(geometry.left, geometry.top, geometry.right, geometry.bottom, 5);
      const c = project(x, y + 7, z), size = resource.size;
      return makeScreenBounds(c.x - size, c.y - size, c.x + size, c.y + 6, 7);
    }
    if (kind === 'source') {
      const size = resource.id === state.source.id ? 48 : 34;
      const anchorY = y + size * 1.2;
      const geometry = worldAssetGeometry('resources', 'waterSource', x, anchorY, z, size * 2.6, size * 2.5);
      if (geometry) return makeScreenBounds(geometry.left, geometry.top, geometry.right, geometry.bottom, 5);
      const c = project(x, y + 5, z);
      const halfX = Math.hypot(size * WORLD.projection.x, size * 1.36 * WORLD.projection.z);
      const halfY = size * 1.36 * WORLD.projection.depthSlope + 13;
      return makeScreenBounds(c.x - halfX, c.y - halfY, c.x + halfX, c.y + halfY, 7);
    }
    return null;
  }

  function drawResources() {
    for (const deposit of state.stoneDeposits) {
      if (deposit.remaining <= 0 || !isNearCamera(deposit.x, deposit.z)) continue;
      const y = terrainHeight(deposit.x, deposit.z);
      const c = project(deposit.x, y + 8, deposit.z);
      const hasSprite = drawWorldAsset('resources', 'stoneDeposit', deposit.x, y + 8, deposit.z, deposit.size * 2.2, deposit.size * 1.7);
      if (!hasSprite) {
        ctx.save(); ctx.translate(c.x, c.y);
        ctx.fillStyle = '#8a8a8a'; ctx.strokeStyle = '#424242'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-deposit.size, 5); ctx.lineTo(-deposit.size * .68, -deposit.size * .65); ctx.lineTo(-5, -deposit.size); ctx.lineTo(deposit.size * .7, -deposit.size * .55); ctx.lineTo(deposit.size, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#bdbdbd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-deposit.size * .48, -3); ctx.lineTo(-3, -deposit.size * .58); ctx.lineTo(deposit.size * .48, -deposit.size * .2); ctx.stroke();
        ctx.restore();
      }
      drawResourceHighlight(deposit, 'STONE', '#f0f0f0', deposit.size * 1.15, deposit.size * 2.1);
    }
    for (const deposit of state.ironDeposits) {
      if (deposit.remaining <= 0 || !isNearCamera(deposit.x, deposit.z)) continue;
      const y = terrainHeight(deposit.x, deposit.z);
      const c = project(deposit.x, y + 7, deposit.z);
      const hasSprite = drawWorldAsset('resources', 'ironDeposit', deposit.x, y + 7, deposit.z, deposit.size * 2.2, deposit.size * 1.7);
      if (!hasSprite) {
        ctx.save(); ctx.translate(c.x, c.y);
        ctx.fillStyle = '#6f5144'; ctx.strokeStyle = '#30221d'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-deposit.size, 4); ctx.lineTo(-deposit.size * .55, -deposit.size * .8); ctx.lineTo(deposit.size * .15, -deposit.size); ctx.lineTo(deposit.size, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#b46a42'; ctx.beginPath(); ctx.moveTo(-deposit.size * .35, -deposit.size * .15); ctx.lineTo(0, -deposit.size * .7); ctx.lineTo(deposit.size * .48, -deposit.size * .05); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      if (Math.hypot(deposit.x - state.player.x, deposit.z - state.player.z) < 210 && !state.resourceHighlight) {
        ctx.fillStyle = '#111'; ctx.font = `bold 8px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(deposit.drillId ? 'DRILL ACTIVE' : 'IRON DEPOSIT', c.x, c.y - deposit.size - 8); ctx.textAlign = 'left';
      }
      drawResourceHighlight(deposit, deposit.drillId ? 'IRON · DRILL' : 'IRON', '#ff9b62', deposit.size * 1.15, deposit.size * 2.1);
    }
    for (const tree of state.trees) {
      if (tree.wood <= 0 || !isNearCamera(tree.x, tree.z)) continue;
      const y = terrainHeight(tree.x, tree.z);
      const trunk = project(tree.x, y + tree.size * .8, tree.z);
      const top = project(tree.x, y + tree.size * 2.9, tree.z);
      const hasSprite = drawWorldAsset('resources', 'tree', tree.x, y + tree.size * 2.1, tree.z, tree.size * 3.2, tree.size * 3.8);
      if (!hasSprite) {
        ctx.strokeStyle = '#5c350d'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(trunk.x, trunk.y); ctx.lineTo(top.x, top.y + 12); ctx.stroke();
        ctx.fillStyle = '#14851b'; ctx.strokeStyle = '#124d13'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(top.x, top.y, tree.size * .85, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(top.x - tree.size * .4, top.y + tree.size * .25, tree.size * .6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      drawResourceHighlight(tree, 'WOOD', '#a9ff67', tree.size * 1.12, tree.size * 3.2);
    }
  }

  function drawSpecialDeposits() {
    const colors = { copper: '#b86a3d', zinc: '#b7c6cf', silicon: '#6f9bb7', clay: '#a66a45', voltite: '#39dbd4' };
    const highlightColors = { copper: '#ffbd83', zinc: '#e9f4ff', silicon: '#79d9ff', clay: '#ffb08d', voltite: '#54ffff' };
    for (const [type, deposits] of Object.entries(state.specialDeposits || {})) {
      for (const deposit of deposits) {
        if (deposit.remaining <= 0 || !isNearCamera(deposit.x, deposit.z)) continue;
        const y = terrainHeight(deposit.x, deposit.z) + 7;
        const p = project(deposit.x, y, deposit.z);
        const hasSprite = drawWorldAsset('resources', `${type}Deposit`, deposit.x, y + deposit.size * 1.1, deposit.z, deposit.size * 2.4, deposit.size * 2.2);
        if (!hasSprite) {
          ctx.save(); ctx.translate(p.x, p.y);
          ctx.fillStyle = colors[type] || '#aaa'; ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(-deposit.size, 3); ctx.lineTo(-deposit.size * .5, -deposit.size); ctx.lineTo(deposit.size * .35, -deposit.size * .82); ctx.lineTo(deposit.size, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
          if (type === 'voltite') {
            ctx.strokeStyle = '#d8ffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -deposit.size + 5); ctx.lineTo(3, -3); ctx.lineTo(-2, -3); ctx.lineTo(4, deposit.size - 5); ctx.stroke();
          } else {
            ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(-deposit.size * .15, -deposit.size * .4, 3, 0, Math.PI * 2); ctx.fill();
          }
          if (Math.hypot(deposit.x - state.player.x, deposit.z - state.player.z) < 230 && !state.resourceHighlight) {
            ctx.fillStyle = '#111'; ctx.font = `bold 8px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(`${type.toUpperCase()} DEPOSIT`, 0, -deposit.size - 8);
          }
          ctx.restore();
        }
        drawResourceHighlight(deposit, type.toUpperCase(), highlightColors[type] || '#fff', deposit.size * 1.28, deposit.size * 2.25 + 8);
      }
    }
  }

  function drawDrills() {
    for (const drill of state.drills) {
      if (!isNearCamera(drill.x, drill.z)) continue;
      const base = project(drill.x, terrainHeight(drill.x, drill.z) + 4, drill.z);
      const top = project(drill.x, terrainHeight(drill.x, drill.z) + 66, drill.z);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.fillStyle = '#aaa'; ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.fillRect(top.x - 17, top.y - 15, 34, 25); ctx.strokeRect(top.x - 17, top.y - 15, 34, 25);
      ctx.fillStyle = '#333'; ctx.fillRect(top.x - 4, top.y - 5, 8, 25);
      ctx.fillStyle = '#f4ef00'; ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(`+${Math.floor(drill.stored)} Fe`, top.x, top.y - 23); ctx.textAlign = 'left';
    }
  }

  function drawShelters() {
    for (const shelter of state.shelters) {
      if (!isNearCamera(shelter.x, shelter.z)) continue;
      const x = shelter.x, z = shelter.z, y = terrainHeight(x, z);
      if (shelter.complete && drawWorldAsset('infrastructure', 'woodenShelter', x, y + 86, z, 180, 138)) continue;
      const segments = [
        [{ x, y: y + 5, z: z - 61 }, { x, y: y + 5, z: z + 61 }],
        [{ x: x - 62, y: y + 94, z }, { x: x + 62, y: y + 29, z }],
        [{ x: x - 62, y: y + 94, z }, { x, y: y + 5, z: z - 61 }],
        [{ x: x + 62, y: y + 29, z }, { x, y: y + 5, z: z + 61 }]
      ];
      segments.slice(0, shelter.poles).forEach((seg, i) => screenLine(seg[0], seg[1], '#57350f', 10));
      segments.slice(0, shelter.poles).forEach((seg, i) => screenLine(seg[0], seg[1], '#b17a32', 5));
      const label = project(x, y + 112, z);
      ctx.fillStyle = '#111'; ctx.font = `bold 8px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(shelter.complete ? 'SHELTER · CLICK TO CROUCH' : `SHELTER ${shelter.poles}/4`, label.x, label.y); ctx.textAlign = 'left';
    }
  }

  function channelPoint(channel, t) {
    const a = state.nodes[channel.a], b = state.nodes[channel.b];
    const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
    return { x, z, y: Math.max(terrainHeight(x, z) + 18, lerp(a.y, b.y, t)) };
  }

  function drawChannel(channel) {
    const a = state.nodes[channel.a], b = state.nodes[channel.b];
    if (!a || !b) return;
    const type = CHANNEL_TYPES[channel.type];
    const metrics = state.network.metrics?.[channel.id];
    const points = [];
    const steps = Math.max(10, Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / 18));
    for (let i = 0; i <= steps; i++) {
      const p = channelPoint(channel, i / steps);
      points.push(project(p.x, p.y, p.z));
    }
    ctx.save();
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = channel.broken ? '#4b4b4b' : type.grey; ctx.lineWidth = 17; ctx.stroke();
    ctx.strokeStyle = channel.broken ? '#282828' : type.blue; ctx.lineWidth = 8; ctx.stroke();
    if (metrics?.status === 'warning' || metrics?.status === 'danger') {
      ctx.strokeStyle = metrics.status === 'danger' ? '#fa2929' : '#ffad25';
      ctx.lineWidth = 2.5; ctx.setLineDash([7, 6]); ctx.stroke();
    } else if (state.network.route.includes(channel) && state.network.flow > 0) {
      ctx.strokeStyle = '#b9e5ff'; ctx.lineWidth = 2.5; ctx.setLineDash([2, 15]);
      ctx.lineDashOffset = -state.elapsed * 42; ctx.stroke();
    }
    if (state.selectedChannelId === channel.id) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]); ctx.stroke();
    }
    ctx.restore();
    if (channel.chute) drawChute(channel);
    if (channel.pump) drawPump(channel);
  }

  function drawPump(channel) {
    const p = channelPoint(channel, .5);
    const s = project(p.x, p.y + 19, p.z);
    ctx.fillStyle = '#a3a3a3'; ctx.strokeStyle = '#252525'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(s.x - 13, s.y - 12, 26, 24, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2478ee'; ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y - 17); ctx.lineTo(s.x, s.y - 12); ctx.stroke();
  }

  function drawChute(channel) {
    const p = channelPoint(channel, 0.5);
    const s = project(p.x, p.y + 10, p.z);
    const a = project(state.nodes[channel.a].x, p.y, state.nodes[channel.a].z);
    const b = project(state.nodes[channel.b].x, p.y, state.nodes[channel.b].z);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(angle);
    ctx.fillStyle = '#858585'; ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-21, -13); ctx.lineTo(17, -13); ctx.lineTo(23, 0); ctx.lineTo(12, 16); ctx.lineTo(-21, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111';
    for (let i = 0; i < 2; i++) { ctx.fillRect(-12 + i * 16, -5, 8, 9); }
    ctx.restore();
  }

  function drawConnectionNode(node, highlighted = false) {
    const p = project(node.x, node.y, node.z);
    ctx.beginPath(); ctx.arc(p.x, p.y, highlighted ? 8 : 6, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.yellow; ctx.fill(); ctx.strokeStyle = '#6c6500'; ctx.lineWidth = 1.5; ctx.stroke();
    if (highlighted) { ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function drawHygrometers() {
    for (const sensor of state.hygrometers) {
      if (!isNearCamera(sensor.x, sensor.z)) continue;
      const ground = project(sensor.x, terrainHeight(sensor.x, sensor.z), sensor.z);
      const top = project(sensor.x, terrainHeight(sensor.x, sensor.z) + 32, sensor.z);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#555'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(ground.x, ground.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.strokeStyle = '#bcbcbc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ground.x, ground.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.fillStyle = '#999'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(top.x - 10, top.y - 13, 20, 18, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.fillRect(top.x - 5, top.y - 8, 10, 7);
      ctx.fillStyle = '#f4ef00'; ctx.beginPath(); ctx.arc(top.x, top.y - 4, 2, 0, Math.PI * 2); ctx.fill();
      if (state.selectedObject?.type === 'hygrometer' && state.selectedObject.id === sensor.id) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(top.x, top.y - 4, 15, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawInfrastructure() {
    for (const channel of state.channels) drawChannel(channel);
    const showNodes = state.tool === 'channel' || state.anchorNodeId !== null;
    if (showNodes) {
      for (const node of Object.values(state.nodes)) drawConnectionNode(node, node.id === state.anchorNodeId);
    }
    drawChannelPreview();
  }

  function drawChannelPreview() {
    if (state.tool !== 'channel' || !state.anchorNodeId || !state.pointer.inside) return;
    const a = state.nodes[state.anchorNodeId];
    if (!a) return;
    const ap = project(a.x, a.y, a.z);
    const candidate = findChannelEndpointCandidate(state.pointer.x, state.pointer.y);
    let endX = state.pointer.x, endY = state.pointer.y;
    let targetWorld = candidate?.free || null;
    if (candidate?.hit?.node) {
      const node = candidate.hit.node;
      const bp = project(node.x, node.y, node.z);
      endX = bp.x; endY = bp.y;
      targetWorld = node;
    } else if (candidate?.hit?.segment) {
      endX = candidate.hit.x; endY = candidate.hit.y;
      targetWorld = screenToWorld(endX, endY);
    } else if (candidate?.node) {
      const bp = project(candidate.node.x, candidate.node.y, candidate.node.z);
      endX = bp.x; endY = bp.y;
      targetWorld = candidate.node;
    }
    const cost = targetWorld
      ? channelCost(a, targetWorld, state.channelType)
      : Math.max(1, Math.ceil(Math.hypot(endX - ap.x, endY - ap.y) / 10.8));
    const projectedDistance = Math.hypot(endX - ap.x, endY - ap.y);
    const valid = cost <= state.inventory[state.channelType] && projectedDistance > 12;
    ctx.save(); ctx.beginPath(); ctx.moveTo(ap.x, ap.y); ctx.lineTo(endX, endY);
    ctx.strokeStyle = valid ? '#8d8d8d' : '#fa2929'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.setLineDash([8, 6]); ctx.stroke();
    ctx.strokeStyle = valid ? CHANNEL_TYPES[state.channelType].blue : '#ff4545'; ctx.lineWidth = 8; ctx.stroke(); ctx.restore();
    ctx.fillStyle = valid ? '#080808e8' : '#7b0000e8'; ctx.fillRect(endX + 12, endY - 12, 57, 24);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(endX + 12, endY - 12, 57, 24);
    ctx.fillStyle = '#fff'; ctx.font = `bold 14px ${FONT}`; ctx.fillText(`${cost}x`, endX + 18, endY + 5);
  }

  function drawCharacter() {
    const p = state.player;
    const ground = terrainHeight(p.x, p.z);
    const spriteKey = p.crouching ? 'crouching' : !p.grounded ? 'jumping' : p.moving ? 'walking' : 'idle';
    if (drawWorldAsset('characters', spriteKey, p.x, ground + p.jumpOffset + (p.crouching ? 27 : 43), p.z, 54, p.crouching ? 42 : 78)) return;
    const footY = ground + p.jumpOffset;
    const stride = p.moving && p.grounded ? Math.sin(p.walkTime * 11) * 15 : 0;
    const armSwing = p.moving && p.grounded ? Math.sin(p.walkTime * 11 + Math.PI) * 10 : 0;
    const crouch = p.crouching ? 0.58 : 1;
    const head = project(p.x, footY + 79 * crouch, p.z);
    const neck = project(p.x, footY + 62 * crouch, p.z);
    const chest = project(p.x, footY + 54 * crouch, p.z);
    const hip = project(p.x, footY + 25 * crouch, p.z);
    const leftFoot = project(p.x - stride, footY + 2, p.z);
    const rightFoot = project(p.x + stride, footY + 2, p.z);
    const leftHand = project(p.x - 16, footY + 39 + armSwing, p.z);
    const rightHand = project(p.x + 16, footY + 39 - armSwing, p.z);
    const shadow = project(p.x, ground + 1, p.z);
    ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y + 3, 12, 5, 0, 0, Math.PI * 2); ctx.fillStyle = '#00000030'; ctx.fill();
    function limb(a, b, width = 5) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = COLORS.ink; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke(); }
    limb(neck, chest, 6); limb(chest, hip, 6); limb(chest, leftHand, 5); limb(chest, rightHand, 5); limb(hip, leftFoot, 6); limb(hip, rightFoot, 6);
    if (state.tool === 'remote') {
      ctx.fillStyle = '#858585'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.fillRect(rightHand.x - 5, rightHand.y - 5, 14, 18); ctx.strokeRect(rightHand.x - 5, rightHand.y - 5, 14, 18);
      ctx.fillStyle = '#30a8ff'; ctx.fillRect(rightHand.x - 2, rightHand.y - 2, 8, 7);
    } else if (state.tool === 'pickaxe' || state.tool === 'axe') {
      ctx.strokeStyle = '#70420e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(rightHand.x, rightHand.y); ctx.lineTo(rightHand.x + 14, rightHand.y - 19); ctx.stroke();
      ctx.strokeStyle = '#bcbcbc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(rightHand.x + 8, rightHand.y - 20); ctx.lineTo(rightHand.x + 23, rightHand.y - 12); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(head.x, head.y, p.crouching ? 12 : 14, 0, Math.PI * 2); ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 5; ctx.stroke();
  }

  function drawCompass() {
    if (!state.inventory.compass) return;
    const p = state.player, b = state.basin;
    const dx = (b.x - p.x) * WORLD.projection.x + (b.z - p.z) * WORLD.projection.z;
    const targetY = b.rimY ?? terrainHeight(b.x, b.z);
    const dy = (b.z - p.z) * WORLD.projection.depthSlope - (targetY - terrainHeight(p.x, p.z)) * WORLD.projection.y;
    const angle = Math.atan2(dy, dx);
    const cx = W - 74, cy = 118;
    ctx.fillStyle = '#050505e8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `bold 8px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('N', cx, cy - 23);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle + Math.PI / 2);
    polygon([{ x: 0, y: -23 }, { x: -7, y: 5 }, { x: 0, y: 0 }, { x: 7, y: 5 }], '#f4ef00', '#837d00', 1);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = `bold 8px ${FONT}`; ctx.fillText('EMPTY SEA', cx, cy + 49); ctx.textAlign = 'left';
  }

  function drawWeather() {
    const storm = state.weather.phase === 'storm';
    const warning = state.weather.phase === 'warning';
    const label = storm ? 'STORM' : warning ? 'STORM APPROACHING' : 'CLEAR';
    ctx.fillStyle = '#050505dd'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.fillRect(14, H - 91, 172, 49); ctx.strokeRect(14, H - 91, 172, 49);
    ctx.fillStyle = storm ? '#ffb14a' : warning ? '#f4ef00' : '#fff'; ctx.font = `bold 10px ${FONT}`; ctx.fillText(label, 23, H - 73);
    ctx.fillStyle = '#ddd'; ctx.font = `8px ${FONT}`; ctx.fillText(state.player.sheltered ? 'SHELTERED' : state.player.crouching ? 'CROUCHED · EXPOSED' : 'EXPOSED', 23, H - 59);
    ctx.fillStyle = '#3b3b3b'; ctx.fillRect(23, H - 53, 150, 6);
    ctx.fillStyle = state.player.health > 55 ? '#00d629' : state.player.health > 25 ? '#f4ef00' : '#e83232';
    ctx.fillRect(23, H - 53, 150 * state.player.health / 100, 6);
    if (storm) {
      ctx.save(); ctx.fillStyle = '#263044'; ctx.globalAlpha = .19; ctx.fillRect(0, 0, W, H); ctx.restore();
      ctx.save(); ctx.strokeStyle = '#c7d9ef'; ctx.globalAlpha = .52; ctx.lineWidth = 1.5;
      for (let i = 0; i < 150; i++) {
        const x = (i * 83 + state.elapsed * 210) % (W + 60) - 30;
        const y = (i * 47 + state.elapsed * 340) % H;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 13, y + 22); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawIndustryPreview() {
    if (!state.pointer.inside || !['machine','belt'].includes(state.tool)) return;
    const world = screenToWorld(state.pointer.x, state.pointer.y);
    const p = project(world.x, world.y + 7, world.z);
    ctx.save(); ctx.globalAlpha = 0.48;
    if (state.tool === 'machine') {
      const def = window.FTSRegistry.machines[state.machineToPlace];
      if (def) {
        const image = window.FTSAssets.get(def.sprite);
        const fallback = def.size || [80,70];
        const scale = Number.isFinite(def.worldScale) ? def.worldScale : 1;
        const width = image?.naturalWidth ? image.naturalWidth * scale : fallback[0];
        const height = image?.naturalHeight ? image.naturalHeight * scale : fallback[1];
        if (image) { ctx.imageSmoothingEnabled = false; ctx.drawImage(image, p.x - width/2, p.y-height, width, height); }
        else { ctx.fillStyle = '#b5b5b5'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.fillRect(p.x-width/2,p.y-height,width,height*.72); ctx.strokeRect(p.x-width/2,p.y-height,width,height*.72); }
      }
    } else {
      ctx.translate(p.x,p.y); ctx.rotate(state.beltRotation*Math.PI/180);
      ctx.fillStyle='#555'; ctx.strokeStyle='#f4ef00'; ctx.lineWidth=3; ctx.fillRect(-28,-7,56,14); ctx.strokeRect(-28,-7,56,14);
    }
    ctx.restore();
  }


  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawTerrain();
    drawSource();
    drawResources();
    drawSpecialDeposits();
    drawBasin();
    drawInfrastructure();
    drawDrills();
    if (state.industryEngine) state.industryEngine.draw(ctx, project, state.camera, window.FTSAssets);
    drawIndustryPreview();
    drawShelters();
    drawHygrometers();
    drawCharacter();
    drawCompass();
    drawWeather();
  }

  function channelCost(a, b, typeId) {
    const type = CHANNEL_TYPES[typeId];
    const distance = Math.hypot(a.x - b.x, a.z - b.z);
    return Math.max(1, Math.ceil(distance / type.itemSpacing));
  }

  function makeChannel(aId, bId, typeId, options = {}) {
    const id = options.id || `c${state.nextChannelId++}`;
    const channel = {
      id, a: aId, b: bId, type: typeId,
      broken: false, overloadTime: 0, chute: options.chute || null, pump: options.pump || false,
      itemCost: options.itemCost ?? 0
    };
    state.channels.push(channel);
    return channel;
  }

  function splitChannelAt(channelId, t) {
    const channel = state.channels.find(c => c.id === channelId);
    if (!channel) return null;
    t = clamp(t, 0.08, 0.92);
    const a = state.nodes[channel.a], b = state.nodes[channel.b];
    const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
    const node = createNode('junction', x, terrainHeight(x, z) + 20, z);
    const oldB = channel.b;
    const oldChute = channel.chute;
    channel.b = node.id;
    channel.chute = oldChute && t >= 0.5 ? oldChute : null;
    channel.overloadTime = 0;
    const secondChute = oldChute && t < 0.5 ? oldChute : null;
    makeChannel(node.id, oldB, channel.type, { chute: secondChute, itemCost: 0 });
    return node;
  }

  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
    return { t, x: ax + dx * t, y: ay + dy * t, distance: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) };
  }

  function closestPointOnChannel(mx, my, channel) {
    let closest = null;
    const steps = 28;
    const first = channelPoint(channel, 0);
    let previous = project(first.x, first.y, first.z);
    for (let i = 1; i <= steps; i++) {
      const t1 = i / steps;
      const point = channelPoint(channel, t1);
      const current = project(point.x, point.y, point.z);
      const local = closestPointOnSegment(mx, my, previous.x, previous.y, current.x, current.y);
      const t = (i - 1 + local.t) / steps;
      if (!closest || local.distance < closest.distance) closest = { t, x: local.x, y: local.y, distance: local.distance };
      previous = current;
    }
    return closest;
  }

  function findNodeHit(mx, my, allowChannelInterior = true) {
    let nearest = null;
    let best = 20;
    for (const node of Object.values(state.nodes)) {
      const p = project(node.x, node.y, node.z);
      const d = Math.hypot(mx - p.x, my - p.y);
      if (d < best) { best = d; nearest = { node, distance: d }; }
    }
    if (nearest) return nearest;
    if (!allowChannelInterior) return null;
    let candidate = null;
    let bestSegment = 13;
    for (const channel of state.channels) {
      if (channel.broken) continue;
      const hit = closestPointOnChannel(mx, my, channel);
      if (hit.distance < bestSegment && hit.t > 0.08 && hit.t < 0.92) {
        bestSegment = hit.distance;
        candidate = { segment: channel, t: hit.t, x: hit.x, y: hit.y, distance: hit.distance };
      }
    }
    return candidate;
  }

  function materializeHit(hit) {
    if (!hit) return null;
    if (hit.node) return hit.node;
    if (hit.segment) return splitChannelAt(hit.segment.id, hit.t);
    return null;
  }

  function findChannelEndpointCandidate(mx, my) {
    // Existing nodes and channel segments remain preferred snap targets.
    const hit = findNodeHit(mx, my, true);
    if (hit) return { hit };

    // Clicking anywhere inside the Empty Sea footprint connects to the basin.
    if (basinScreenHit(mx, my) < 1.12) {
      const basinNode = state.nodes.basin;
      if (basinNode) return { node: basinNode };
    }

    // The visible spring body also selects its source endpoint.
    for (const source of state.sources) {
      if (findSourceScreenHit(mx, my, source)) {
        const node = state.nodes[source.id];
        if (node) return { node };
      }
    }

    // Any other point on the terrain is a valid free endpoint, represented by
    // a reusable junction node. No yellow dot is required at that location.
    const point = screenToWorld(mx, my);
    return { free: { x: point.x, z: point.z, y: terrainHeight(point.x, point.z) + 18 } };
  }

  function materializeChannelEndpoint(candidate) {
    if (!candidate) return null;
    if (candidate.hit) return materializeHit(candidate.hit);
    if (candidate.node) return candidate.node;
    if (candidate.free) return createNode('junction', candidate.free.x, candidate.free.y, candidate.free.z);
    return null;
  }

  function findChannelHit(mx, my) {
    let best = 17;
    let result = null;
    for (const channel of state.channels) {
      const hit = closestPointOnChannel(mx, my, channel);
      if (hit.distance < best) { best = hit.distance; result = { channel, t: hit.t, distance: hit.distance }; }
    }
    return result;
  }

  function completeChannel(aId, bNode) {
    const a = state.nodes[aId];
    if (!a || !bNode || a.id === bNode.id) return;
    if (a.kind === 'basin' && bNode.kind === 'source' || a.kind === 'source' && bNode.kind === 'basin') {
      // Direct source-to-basin connection is the intended first route.
    }
    if (state.channels.some(c => !c.broken && ((c.a === aId && c.b === bNode.id) || (c.a === bNode.id && c.b === aId)))) {
      showToast('Those points are already connected.'); return;
    }
    const cost = channelCost(a, bNode, state.channelType);
    if (state.inventory[state.channelType] < cost) {
      showToast(`Not enough ${CHANNEL_TYPES[state.channelType].name} (${cost} needed).`); return;
    }
    state.inventory[state.channelType] -= cost;
    makeChannel(aId, bNode.id, state.channelType, { itemCost: cost });
    state.anchorNodeId = null;
    state.selectedChannelId = state.channels[state.channels.length - 1].id;
    state.selectedObject = { type: 'channel', id: state.selectedChannelId };
    renderInspection();
    showToast(`${CHANNEL_TYPES[state.channelType].name} connected · ${cost}x used.`);
    updateUI(true);
  }

  function setTool(tool, typeId = null) {
    state.tool = tool;
    if (typeId) state.channelType = typeId;
    if (tool === 'select') { state.selectedHotbar = -1; state.heldItem = null; }
    if (tool !== 'channel') state.anchorNodeId = null;
    if (tool !== 'remote') closeInspection();
    state.industryUI?.close();
    const labels = {
      channel: [`${CHANNEL_TYPES[state.channelType].name.toTitleCase()}`, 'Click anywhere on the terrain to start, then click anywhere to place the endpoint. Yellow dots help you snap to connections.'],
      chute: ['Chute', 'Click an existing channel to attach a chute.'],
      hygrometer: ['Hygrometer', 'Place the hygrometer on the Empty Sea sand rim.'],
      remote: ['Remote display', 'Click a hygrometer or channel to read its measurements.'],
      module: [`Module ${state.moduleToInstall || 'multiplier'}`, 'Click a chute to install the selected multiplier.'],
      pickaxe: ['Stone Pickaxe', 'Click a nearby stone deposit to mine stone.'],
      axe: ['Stone Axe', 'Click a nearby tree to chop wood.'],
      woodPole: ['Wood Pole', 'Click the ground to place a shelter pole. Build four parts.'],
      drill: ['Drill', 'Place a drill on an iron deposit, then drive it with a waterwheel and shafts.'],
      machine: [`${(state.machineToPlace || 'machine').toTitleCase()}`, 'Click the terrain to place this machine.'],
      belt: ['Conveyor Belt', 'Place belts beside machines and point them toward the next machine or belt. Press R to rotate.'],
      shaftLink: ['Mechanical Link', 'Click one machine, then another, to connect them with the selected shaft.'],
      powerLink: ['Electrical Link', 'Click a Voltite-powered Mains Supply, then an Accumulator.'],
      moltenLink: ['Tungsten Connection', 'Click a Furnace, then a Casting Machine, to connect a safe molten-metal feed.'],
      pump: ['Water Pump', 'Click a channel to install a pump and boost its throughput.'],
      compass: ['Compass', 'Follow the compass needle to the central Empty Sea.'],
      select: ['', '']
    };
    const label = labels[tool] || labels.select;
    ui.mode.textContent = label[0];
    ui.instruction.textContent = state.anchorNodeId ? 'Click or drag to any point to place the endpoint. Yellow dots are optional connection helpers.' : label[1];
    updateHotbar();
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('show');
    state.toastTimer = 2.6;
  }

  function closeInspection() {
    ui.inspection.hidden = true;
    state.selectedObject = null;
    state.selectedChannelId = null;
  }

  function selectChannel(channel) {
    state.selectedChannelId = channel.id;
    state.selectedObject = { type: channel.chute ? 'chute' : 'channel', id: channel.id };
    if (state.tool === 'remote') renderInspection();
  }

  function attachChute(channel) {
    if (channel.chute) { selectChannel(channel); showToast('This channel already has a chute.'); return; }
    if (state.inventory.chute <= 0) { showToast('No chutes remaining.'); return; }
    channel.chute = { id: `h${state.nextChuteId++}`, slots: [null, null] };
    state.inventory.chute--;
    state.selectedChannelId = channel.id;
    showToast('Chute attached. Hold a Remote Display and click it to inspect its slots.');
    updateUI(true);
  }

  function attachPump(channel) {
    if (channel.pump) { showToast('This channel already has a pump.'); return; }
    if (state.inventory.pump <= 0) { showToast('Craft a Water Pump first.'); return; }
    state.inventory.pump--;
    channel.pump = true;
    state.selectedChannelId = channel.id;
    showToast('Water Pump installed · x2 throughput, increased stress.');
    updateUI(true);
  }

  function installModule(channelId, moduleId) {
    const channel = state.channels.find(c => c.id === channelId);
    if (!channel?.chute) return;
    if (!MODULE_TYPES[moduleId] || state.moduleInventory[moduleId] <= 0) { showToast('No modules of that type remain.'); return; }
    const slot = channel.chute.slots.findIndex(s => s === null);
    if (slot < 0) { showToast('Both chute slots are occupied.'); return; }
    channel.chute.slots[slot] = moduleId;
    state.moduleInventory[moduleId]--;
    renderInspection(); updateUI(true);
    showToast(`${MODULE_TYPES[moduleId].name} installed in slot ${slot + 1}.`);
  }

  function removeModule(channelId, slotIndex) {
    const channel = state.channels.find(c => c.id === channelId);
    if (!channel?.chute) return;
    const moduleId = channel.chute.slots[slotIndex];
    if (!moduleId) return;
    channel.chute.slots[slotIndex] = null;
    state.moduleInventory[moduleId]++;
    renderInspection(); updateUI(true);
    showToast(`Module removed from slot ${slotIndex + 1}.`);
  }

  function repairChannel(channelId) {
    const channel = state.channels.find(c => c.id === channelId);
    if (!channel?.broken) return;
    if (state.inventory[channel.type] < 1) { showToast(`Need 1 ${CHANNEL_TYPES[channel.type].name} to repair.`); return; }
    state.inventory[channel.type]--;
    channel.broken = false; channel.overloadTime = 0;
    renderInspection(); updateUI(true);
    showToast('Channel repaired. Consider reducing its stress.');
  }

  function channelMultipliers(channel) {
    let water = channel.pump ? 2 : 1, stress = channel.pump ? 1.5 : 1;
    if (state.industryEngine) water *= state.industryEngine.channelMultiplier(channel.id);
    if (channel.chute) for (const id of channel.chute.slots) {
      if (id && MODULE_TYPES[id]) { water *= MODULE_TYPES[id].water; stress *= MODULE_TYPES[id].stress; }
    }
    return { water, stress };
  }

  function findSourceRoute(start = 'source') {
    const goal = 'basin';
    const queue = [start];
    const previous = new Map([[start, null]]);
    const previousChannel = new Map();
    while (queue.length) {
      const current = queue.shift();
      if (current === goal) break;
      for (const channel of state.channels) {
        if (channel.broken) continue;
        let next = null;
        if (channel.a === current) next = channel.b;
        else if (channel.b === current) next = channel.a;
        if (next && !previous.has(next)) {
          previous.set(next, current);
          previousChannel.set(next, channel);
          queue.push(next);
        }
      }
    }
    if (!previous.has(goal)) return [];
    const route = [];
    let node = goal;
    while (node !== start) {
      const channel = previousChannel.get(node);
      if (!channel) return [];
      route.push(channel);
      node = previous.get(node);
    }
    return route.reverse();
  }

  function evaluateNetwork() {
    const channelFlows = {};
    const routes = [];
    let totalFlow = 0;
    for (const source of state.sources) {
      const route = findSourceRoute(source.id);
      if (!route.length) continue;
      let routeMultiplier = 1;
      for (const channel of route) routeMultiplier *= channelMultipliers(channel).water;
      let flow = source.rate * routeMultiplier;
      for (const channel of route) {
        const local = channelMultipliers(channel);
        flow = Math.min(flow, CHANNEL_TYPES[channel.type].throughput * local.water);
      }
      if (flow <= 0) continue;
      routes.push({ source, route, flow });
      totalFlow += flow;
      for (const channel of route) channelFlows[channel.id] = (channelFlows[channel.id] || 0) + flow;
    }
    const metrics = {};
    for (const [channelId, flow] of Object.entries(channelFlows)) {
      const channel = state.channels.find(c => c.id === channelId);
      if (!channel) continue;
      const type = CHANNEL_TYPES[channel.type];
      const local = channelMultipliers(channel);
      const stress = flow * 250 * local.stress;
      const ratio = stress / type.stressLimit;
      metrics[channel.id] = { flow, stress, limit: type.stressLimit, ratio, status: ratio > 1 ? 'danger' : ratio >= .78 ? 'warning' : 'safe', localWater: local.water, localStress: local.stress };
      channel.currentFlow = flow; channel.lastFlow = flow; channel.lastStress = stress;
    }
    for (const channel of state.channels) if (!channelFlows[channel.id]) channel.currentFlow = 0;
    const uniqueRoute = [...new Set(routes.flatMap(r => r.route))];
    const averageMultiplier = routes.length ? routes.reduce((sum, route) => sum + route.flow, 0) / routes.length / SOURCE_RATE : 1;
    return { route: uniqueRoute, routes, flow: totalFlow, waterMultiplier: averageMultiplier, fillRate: totalFlow / BASIN_CAPACITY * 100, metrics };
  }

  function updateSimulation(dt) {
    state.network = evaluateNetwork();
    state.industryEngine?.tick(dt);
    for (const channel of state.channels) {
      const metric = state.network.metrics[channel.id];
      if (!metric || channel.broken) { channel.overloadTime = 0; continue; }
      if (metric.stress > metric.limit) {
        channel.overloadTime += dt;
        if (channel.overloadTime >= 2.4) {
          channel.broken = true;
          channel.overloadTime = 0;
          showToast(`${CHANNEL_TYPES[channel.type].name} broke under excessive stress!`);
          if (state.selectedChannelId === channel.id) renderInspection();
        }
      } else {
        channel.overloadTime = Math.max(0, channel.overloadTime - dt * 1.5);
      }
    }
    if (state.network.flow > 0) {
      state.basin.water = Math.min(BASIN_CAPACITY, state.basin.water + state.network.flow * dt);
    }
    state.network.fillRate = state.network.flow / BASIN_CAPACITY * 100;
    for (const drill of state.drills) {
      drill.progress += dt;
      while (drill.progress >= 4.5) {
        drill.progress -= 4.5;
        const deposit = state.ironDeposits.find(d => d.id === drill.depositId);
        if (!deposit || deposit.remaining <= 0) break;
        deposit.remaining--; drill.stored++; state.materials.ironIngot++;
      }
    }
  }

  function updateUI(force = false) {
    if (ui.iron) ui.iron.textContent = `${state.inventory.iron}x`;
    if (ui.concrete) ui.concrete.textContent = `${state.inventory.concrete}x`;
    if (ui.glass) ui.glass.textContent = `${state.inventory.glass}x`;
    if (ui.chute) ui.chute.textContent = `${state.inventory.chute}x`;
    if (ui.modules) ui.modules.textContent = `x4: ${state.moduleInventory.x4} · x2: ${state.moduleInventory.x2}`;
    if (!state.inventoryOpen) updateHotbar();
    // Do not rebuild the inventory DOM on the simulation tick. Inventory rendering
    // is explicit and happens when inventory contents or the inventory screen change.
    if (state.selectedObject && state.tool === 'remote') renderInspection();
  }

  function renderInspection() {
    if (!state.selectedObject || state.tool !== 'remote') { ui.inspection.hidden = true; return; }
    const selected = state.selectedObject;
    if (selected.type === 'hygrometer') {
      const sensor = state.hygrometers.find(h => h.id === selected.id);
      if (!sensor) { ui.inspection.hidden = true; return; }
      const pct = clamp(state.basin.water / BASIN_CAPACITY * 100, 0, 100);
      ui.inspectionTitle.textContent = 'REMOTE DISPLAY · HYGROMETER';
      ui.inspectionContent.innerHTML = `<div class="inspect-name">Empty Sea monitor</div>
        <div class="sensor-progress">${pct.toFixed(2)}%</div>
        <div class="inspect-row"><span>Water stored</span><span>${state.basin.water.toFixed(0)} / ${BASIN_CAPACITY.toLocaleString()} L</span></div>
        <div class="inspect-row"><span>Incoming flow</span><span>${state.network.flow.toFixed(1)} L/s</span></div>
        <div class="inspect-row"><span>Filling rate</span><span>${state.network.fillRate.toFixed(4)}%/s</span></div>
        <div class="inspect-row"><span>Sensor status</span><span>Connected · Basin</span></div>
        <div class="inspect-status status-safe">LIVE TELEMETRY</div>`;
      ui.inspection.hidden = false; return;
    }
    if (selected.type === 'source') {
      const source = state.sources.find(s => s.id === selected.id) || state.source;
      const route = state.network.routes?.find(r => r.source.id === source.id);
      ui.inspectionTitle.textContent = 'REMOTE DISPLAY · SOURCE';
      ui.inspectionContent.innerHTML = `<div class="inspect-name">Natural water source</div>
        <div class="inspect-row"><span>Available output</span><span>${source.rate} L/s</span></div>
        <div class="inspect-row"><span>Network route</span><span>${route ? 'Connected' : 'No route'}</span></div>
        <div class="inspect-row"><span>Current delivery</span><span>${route ? route.flow.toFixed(1) : '0.0'} L/s</span></div>`;
      ui.inspection.hidden = false; return;
    }
    if (selected.type === 'basin') {
      ui.inspectionTitle.textContent = 'REMOTE DISPLAY';
      ui.inspectionContent.innerHTML = '<div class="inspect-name">No hygrometer detected.</div><div class="inspect-row"><span>Required</span><span>Place a Hygrometer on the basin</span></div>';
      ui.inspection.hidden = false; return;
    }
    const channel = state.channels.find(c => c.id === selected.id);
    if (!channel) { ui.inspection.hidden = true; return; }
    const type = CHANNEL_TYPES[channel.type];
    const metric = state.network.metrics?.[channel.id] || null;
    const flow = metric?.flow ?? channel.lastFlow ?? 0;
    const stress = metric?.stress ?? channel.lastStress ?? 0;
    const ratio = metric?.ratio || 0;
    const status = channel.broken ? 'BROKEN' : metric?.status === 'danger' ? 'OVERLOADED' : metric?.status === 'warning' ? 'HIGH STRESS' : state.network.route.includes(channel) ? 'CHANNEL SAFE' : 'NOT CONNECTED';
    const statusClass = channel.broken || metric?.status === 'danger' ? 'status-danger' : metric?.status === 'warning' ? 'status-warning' : 'status-safe';
    let html = `<div class="inspect-name">${channel.chute ? 'Chute / ' : ''}${type.name}</div>
      <div class="inspect-row"><span>Connection</span><span>${state.network.route.includes(channel) ? 'Connected' : 'Disconnected'}</span></div>
      <div class="inspect-row"><span>Throughput</span><span>${type.throughput.toFixed(0)} L/s base</span></div>
      <div class="inspect-row"><span>Endpoint throughput</span><span>${flow.toFixed(1)} L/s</span></div>
      <div class="inspect-row"><span>Structural stress</span><span>${Math.round(stress).toLocaleString()} / ${type.stressLimit.toLocaleString()}</span></div>
      <div class="inspect-status ${statusClass}">${status}${channel.broken ? '' : ` · ${(ratio * 100).toFixed(0)}%`}</div>`;
    if (channel.pump) html += `<div class="inspect-status status-safe">WATER PUMP INSTALLED · x2 THROUGHPUT</div>`;
    if (channel.chute) {
      const slots = channel.chute.slots;
      const used = slots.filter(Boolean).length;
      const mult = channelMultipliers(channel);
      html += `<div class="inspect-name" style="font-size:13px;margin-top:7px">CHUTE ANALYTICS</div>
        <div class="inspect-row"><span>Slots used</span><span>${used}/2</span></div>`;
      slots.forEach((id, index) => {
        const desc = id ? `x${MODULE_TYPES[id].water} water (x${MODULE_TYPES[id].stress} stress)` : 'Empty';
        html += `<div class="slot-row"><span>${index + 1}: ${desc}</span>${id ? `<button class="slot-button" data-remove-slot="${index}" type="button">Remove</button>` : '<span>—</span>'}</div>`;
      });
      html += `<div class="inspect-row"><span>Total water multiplier</span><span>x${mult.water}</span></div>
        <div class="inspect-row"><span>Total stress multiplier</span><span>x${mult.stress}</span></div>`;
      if (used < 2) {
        html += `<div class="module-actions">
          <button class="module-button" data-install-module="x4" type="button" ${state.moduleInventory.x4 <= 0 ? 'disabled' : ''}>Install x4 water / x8 stress (${state.moduleInventory.x4})</button>
          <button class="module-button" data-install-module="x2" type="button" ${state.moduleInventory.x2 <= 0 ? 'disabled' : ''}>Install x2 water / x2 stress (${state.moduleInventory.x2})</button>
        </div>`;
      }
    } else {
      html += `<div class="inspect-row"><span>Chute</span><span>Not installed</span></div>`;
    }
    if (channel.pump) html += `<div class="inspect-row"><span>Pump</span><span>Installed · x2 flow / x1.5 stress</span></div>`;
    if (channel.broken) html += `<button class="module-button" data-repair-channel="${channel.id}" type="button">Repair · 1 ${type.name}</button>`;
    ui.inspectionTitle.textContent = channel.chute ? 'REMOTE DISPLAY · CHUTE ANALYTICS' : 'REMOTE DISPLAY · CHANNEL';
    ui.inspectionContent.innerHTML = html;
    ui.inspection.hidden = false;
  }

  function basinScreenHit(mx, my) {
    const center = project(state.basin.x, state.basin.rimY, state.basin.z);
    const radiusX = state.basin.rx * WORLD.projection.x * .9;
    const radiusY = Math.max(58, state.basin.rz * WORLD.projection.depthSlope * 1.35);
    const dx = (mx - center.x) / radiusX;
    const dy = (my - center.y) / radiusY;
    return dx * dx + dy * dy;
  }

  function placeHygrometer(mx, my) {
    const radial = basinScreenHit(mx, my);
    if (radial > 1.32) { showToast('A Hygrometer must be spiked into the Empty Sea rim.'); return; }
    if (state.inventory.hygrometer <= 0) { showToast('No Hygrometer in inventory.'); return; }
    // Sample the projected basin rim and anchor the sensor at the point nearest the click.
    // Search the projected basin rim in world X/Z so the sensor attaches to the visible shoreline.
    let best = { distance: Infinity, x: state.basin.x, z: state.basin.z };
    for (let i = 0; i < 240; i++) {
      const angle = i / 240 * Math.PI * 2;
      const x = state.basin.x + Math.cos(angle) * state.basin.rx * 0.80;
      const z = state.basin.z + Math.sin(angle) * state.basin.rz * 0.80;
      const point = project(x, terrainHeight(x, z) + 3, z);
      const distance = Math.hypot(mx - point.x, my - point.y);
      if (distance < best.distance) best = { distance, x, z };
    }
    const sensor = { id: `hg${state.nextHygrometerId++}`, x: best.x, z: best.z, basinId: 'basin' };
    state.hygrometers.push(sensor);
    consumeItem('hygrometer', 1);
    setTool('select');
    showToast('Hygrometer spiked into the Empty Sea rim. Craft and hold a Remote Display to read it.');
    updateUI(true);
  }

  function findHygrometerHit(mx, my) {
    let best = 22, result = null;
    for (const sensor of state.hygrometers) {
      const p = project(sensor.x, terrainHeight(sensor.x, sensor.z) + 32, sensor.z);
      const d = Math.hypot(mx - p.x, my - p.y);
      if (d < best) { best = d; result = sensor; }
    }
    return result;
  }

  function screenToWorld(mx, my) {
    // Invert the same screen basis as project(): screen X resolves horizontal X;
    // screen Y resolves elevation Y and the small Z-depth offset.
    let x = state.camera.x, z = state.camera.z;
    const p = WORLD.projection;
    for (let i = 0; i < 12; i++) {
      const y = terrainHeight(x, z);
      z = clamp(state.camera.z + (my - 432 + (y - state.camera.y) * p.y) / p.depthSlope, WORLD.zMin + 5, WORLD.zMax - 5);
      x = clamp(state.camera.x + (mx - W / 2 - (z - state.camera.z) * p.z) / p.x, WORLD.xMin + 5, WORLD.xMax - 5);
    }
    return { x, z, y: terrainHeight(x, z) };
  }

  function worldDistance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

  function findResourceInList(list, kind, mx, my, subtype = null) {
    let bestScore = Infinity, result = null;
    for (const resource of list) {
      // Test all world resources against their projected screen bounds.
      // Player reach is checked separately when the tool action is applied.
      if (kind === 'stone' || kind === 'iron' || kind === 'special') {
        if (resource.remaining <= 0) continue;
      }
      if (kind === 'tree' && resource.wood <= 0) continue;
      const bounds = getResourceScreenBounds(kind, resource, subtype);
      const score = boundsHitScore(bounds, mx, my);
      if (score < bestScore) { bestScore = score; result = resource; }
    }
    return result;
  }

  const DEPOSIT_OUTPUT_ITEMS = Object.freeze({
    stone: 'stone', iron: 'ironOre', copper: 'copperOre', zinc: 'zincOre',
    silicon: 'silicon', clay: 'clay', voltite: 'voltite'
  });

  function findMineableDepositById(id) {
    const stone = state.stoneDeposits.find(deposit => deposit.id === id);
    if (stone) return { type: 'stone', item: 'stone', deposit: stone };
    const iron = state.ironDeposits.find(deposit => deposit.id === id);
    if (iron) return { type: 'iron', item: 'ironOre', deposit: iron };
    for (const [type, deposits] of Object.entries(state.specialDeposits || {})) {
      const deposit = deposits.find(candidate => candidate.id === id);
      if (deposit) return { type, item: DEPOSIT_OUTPUT_ITEMS[type], deposit };
    }
    return null;
  }

  function findMineableDepositAt(x, z, radius = 230) {
    let closest = null, best = radius;
    const candidates = [
      ...state.stoneDeposits.map(deposit => ({ type: 'stone', item: 'stone', deposit })),
      ...state.ironDeposits.map(deposit => ({ type: 'iron', item: 'ironOre', deposit })),
      ...Object.entries(state.specialDeposits || {}).flatMap(([type, deposits]) =>
        deposits.map(deposit => ({ type, item: DEPOSIT_OUTPUT_ITEMS[type], deposit })))
    ];
    for (const candidate of candidates) {
      const { deposit, item } = candidate;
      if (!item || deposit.remaining <= 0 || deposit.drillId) continue;
      const distance = Math.hypot(deposit.x - x, deposit.z - z);
      if (distance < best) { best = distance; closest = candidate; }
    }
    if (!closest) return null;
    return { id: closest.deposit.id, type: closest.type, item: closest.item,
      x: closest.deposit.x, z: closest.deposit.z, remaining: closest.deposit.remaining };
  }

  function setDepositDrillId(id, machineId) {
    const target = findMineableDepositById(id);
    if (!target) return false;
    target.deposit.drillId = machineId || null;
    return true;
  }

  function findStoneHit(mx, my) {
    return findResourceInList(state.stoneDeposits, 'stone', mx, my);
  }

  function findIronHit(mx, my) {
    return findResourceInList(state.ironDeposits, 'iron', mx, my);
  }

  function findTreeHit(mx, my) {
    return findResourceInList(state.trees, 'tree', mx, my);
  }

  function findSpecialDepositHit(mx, my) {
    let bestScore = Infinity, result = null;
    for (const [type, deposits] of Object.entries(state.specialDeposits || {})) {
      for (const deposit of deposits) {
        if (deposit.remaining <= 0) continue;
        const bounds = getResourceScreenBounds('special', deposit, type);
        const score = boundsHitScore(bounds, mx, my);
        if (score < bestScore) { bestScore = score; result = { type, deposit }; }
      }
    }
    return result;
  }

  function findSourceScreenHit(mx, my, source) {
    return boundsHitScore(getResourceScreenBounds('source', source), mx, my) < Infinity;
  }

  function findAnyMineableDepositHit(mx, my) {
    let bestScore = Infinity, best = null;
    const consider = (type, item, deposit, kind, subtype = null) => {
      if (!deposit || deposit.remaining <= 0 || !item) return;
      const score = boundsHitScore(getResourceScreenBounds(kind, deposit, subtype), mx, my);
      if (score < bestScore) { bestScore = score; best = { type, item, deposit }; }
    };
    for (const deposit of state.stoneDeposits) consider('stone', 'stone', deposit, 'stone');
    for (const deposit of state.ironDeposits) consider('iron', 'ironOre', deposit, 'iron');
    for (const [type, deposits] of Object.entries(state.specialDeposits || {})) {
      for (const deposit of deposits) consider(type, DEPOSIT_OUTPUT_ITEMS[type], deposit, 'special', type);
    }
    return best;
  }

  function mineStone(mx, my) {
    // The Stone Pickaxe can extract every mineral deposit. Trees remain the Axe's job.
    const hit = findAnyMineableDepositHit(mx, my);
    if (!hit) { showToast('Click a stone or mineral deposit.'); return; }
    const { type, item, deposit } = hit;
    if (worldDistance(state.player, deposit) > 165) { showToast('Move closer to the deposit.'); return; }
    const yieldPerSwing = type === 'stone' ? 4 : type === 'voltite' ? 1 : 2;
    const mined = Math.min(yieldPerSwing, deposit.remaining);
    // Do not consume deposit stock if the 36 inventory slots cannot accept the item.
    if (!giveItem(item, mined)) { showToast('Inventory full · make room before mining more.'); return; }
    deposit.remaining -= mined;
    const remaining = deposit.remaining;
    if (remaining <= 0) {
      const attachedDrill = state.industryEngine?.machines.find(machine => machine.kind === 'drill' && machine.depositId === deposit.id);
      if (attachedDrill) { attachedDrill.active = false; attachedDrill.powerBuffer = 0; }
    }
    showToast(`Mined ${mined} ${ITEM_NAMES[item] || item} · ${remaining} remaining in ${type} deposit.`);
    updateUI(true); renderInventoryIfOpen();
  }

  function renderInventoryIfOpen() { if (state.inventoryOpen) renderInventory(); }

  function chopWood(mx, my) {
    const tree = findTreeHit(mx, my);
    if (!tree) { showToast('Click a tree to chop it.'); return; }
    if (worldDistance(state.player, tree) > 155) { showToast('Move closer to the tree.'); return; }
    const cut = Math.min(3, tree.wood);
    tree.wood -= cut;
    state.materials.wood += cut;
    if (Math.random() < 0.42) state.materials.treeSap += 1;
    addItemToBag('wood');
    if (state.materials.treeSap > 0) addItemToBag('treeSap');
    if (tree.wood <= 0) showToast(`Tree felled · collected ${cut} wood.`);
    else showToast(`Chopped ${cut} wood · ${tree.wood} left in the tree.`);
    updateUI(true);
  }

  function placeDrill(mx, my) {
    const deposit = findIronHit(mx, my);
    if (!deposit) { showToast('A Drill must be placed on an iron deposit.'); return; }
    if (worldDistance(state.player, deposit) > 170) { showToast('Move closer to the iron deposit.'); return; }
    if (deposit.drillId) { showToast('This deposit already has a Drill.'); return; }
    if (state.inventory.drill <= 0) { showToast('Craft a Drill first.'); return; }
    const drill = { id: `drill-${state.nextDrillId++}`, depositId: deposit.id, x: deposit.x, z: deposit.z, progress: 0, stored: 0 };
    state.drills.push(drill); deposit.drillId = drill.id; state.inventory.drill--;
    showToast('Drill installed. It generates 1 Iron every 4.5 seconds.');
    updateUI(true);
  }

  function placeWoodPole(mx, my) {
    const point = screenToWorld(mx, my);
    if (worldDistance(state.player, point) > 270) { showToast('That is too far away to build.'); return; }
    if (state.inventory.woodPole <= 0) { showToast('Craft Wood Poles in the inventory. Four are needed.'); return; }
    let shelter = state.shelters.find(s => !s.complete && worldDistance(s, point) < 185);
    if (!shelter) {
      shelter = { id: `shelter-${state.nextShelterId++}`, x: point.x, z: point.z, poles: 0, complete: false };
      state.shelters.push(shelter);
    }
    if (shelter.poles >= 4) { showToast('This shelter is already complete.'); return; }
    consumeItem('woodPole', 1);
    shelter.poles++;
    if (shelter.poles === 1) showToast('Base placed · place a second pole for the angled roof.');
    else if (shelter.poles === 2) showToast('Roof pole placed and angled automatically · add the two side supports.');
    else if (shelter.poles === 3) showToast('One side support placed · add the final side support.');
    if (shelter.poles === 4) {
      shelter.complete = true;
      showToast('Shelter complete! Go close to it and click it to crouch underneath during storms.');
    }
    updateUI(true);
  }

  function findShelterHit(mx, my) {
    let best = 54, result = null;
    for (const shelter of state.shelters) {
      if (!shelter.complete) continue;
      const p = project(shelter.x, terrainHeight(shelter.x, shelter.z) + 88, shelter.z);
      const d = Math.hypot(mx - p.x, my - p.y);
      if (d < best) { best = d; result = shelter; }
    }
    return result;
  }

  function toggleCrouchAtShelter(shelter = null) {
    const nearby = shelter || state.shelters.find(s => s.complete && worldDistance(state.player, s) < 118);
    if (!nearby || worldDistance(state.player, nearby) > 135) { showToast('Move close to a completed shelter first.'); return false; }
    state.player.crouching = !state.player.crouching;
    showToast(state.player.crouching ? 'Crouched under shelter · protected from the storm.' : 'You stepped out of the shelter.');
    return true;
  }

  function updateWeather(dt) {
    const weather = state.weather;
    weather.timeLeft -= dt;
    if (weather.timeLeft <= 0) {
      if (weather.phase === 'clear') {
        if (Math.random() < WEATHER_TUNING.stormChancePerCheck) {
          weather.phase = 'warning';
          weather.timeLeft = WEATHER_TUNING.warningSeconds;
          showToast('Storm approaching! Find or build shelter.');
        } else {
          // A missed storm check means another long calm period, not an immediate retry.
          weather.timeLeft = WEATHER_TUNING.skippedCheckMin + Math.random() * (WEATHER_TUNING.skippedCheckMax - WEATHER_TUNING.skippedCheckMin);
        }
      } else if (weather.phase === 'warning') {
        weather.phase = 'storm';
        weather.timeLeft = WEATHER_TUNING.stormMin + Math.random() * (WEATHER_TUNING.stormMax - WEATHER_TUNING.stormMin);
        showToast('Storm started! Crouch inside a shelter.');
      } else {
        weather.phase = 'clear';
        weather.timeLeft = WEATHER_TUNING.postStormClearMin + Math.random() * (WEATHER_TUNING.postStormClearMax - WEATHER_TUNING.postStormClearMin);
        showToast('The storm has passed. A long clear spell is expected.');
      }
    }
    const player = state.player;
    const shelter = state.shelters.find(s => s.complete && worldDistance(player, s) < 95);
    player.sheltered = !!(shelter && player.crouching);
    if (weather.phase === 'storm' && !player.sheltered) {
      player.health = Math.max(0, player.health - dt * 2.25);
    } else if (weather.phase === 'clear') {
      player.health = Math.min(100, player.health + dt * 1.15);
    }
    if (player.health <= 0) {
      player.x = state.spawn.x; player.z = state.spawn.z; player.jumpOffset = 0; player.vy = 0; player.crouching = false; player.health = 65;
      showToast('The storm swept you back to your starting area. Your collected materials were kept.');
    }
  }
  function findMachineScreenHit(mx, my) {
    if (!state.industryEngine) return null;
    let best = Infinity, hit = null;
    for (const machine of state.industryEngine.machines) {
      if (!isNearCamera(machine.x, machine.z, 1100, 1700)) continue;
      const def = window.FTSRegistry.machines[machine.kind];
      const fallback = def.size || [80, 70];
      const sprite = window.FTSAssets?.get?.(def.sprite);
      const scale = Number.isFinite(def.worldScale) ? def.worldScale : 1;
      const width = sprite?.naturalWidth ? sprite.naturalWidth * scale : fallback[0];
      const height = sprite?.naturalHeight ? sprite.naturalHeight * scale : fallback[1];
      const p = project(machine.x, terrainHeight(machine.x, machine.z) + 7, machine.z);
      const left = p.x - width / 2, right = p.x + width / 2;
      const top = p.y - height, bottom = p.y;
      if (mx >= left - 8 && mx <= right + 8 && my >= top - 8 && my <= bottom + 8) {
        const d = Math.hypot(mx - p.x, my - (top + bottom) / 2);
        if (d < best) { best = d; hit = machine; }
      }
    }
    return hit;
  }

  function handleCanvasDown(event) {
    if (state.inventoryOpen) return;
    if (event.button === 2) {
      const rect = canvas.getBoundingClientRect();
      const mx = (event.clientX - rect.left) * W / rect.width, my = (event.clientY - rect.top) * H / rect.height;
      const machine = findMachineScreenHit(mx, my);
      if (!machine) return;
      const itemId = state.heldItem;
      if (!itemId || itemCount(itemId) <= 0) { showToast('Select a compatible part in your hotbar first.'); return; }
      let inserted = false;
      if (machine.kind === 'accumulator' && itemId === 'battery') inserted = !!state.industryEngine?.insertBattery(machine.id).ok;
      else if (machine.kind === 'castingMachine' && ['castIron','castBrass','castCopper','castTransformer'].includes(itemId)) inserted = !!state.industryEngine?.installCast(machine.id, itemId).ok;
      else {
        const acceptedByFurnace = machine.kind === 'furnace' && ['stone','sand','ironOre','copperOre','zincOre','ironIngot','copperIngot','brassIngot'].includes(itemId);
        const recipe = window.FTSRegistry.machineRecipes[machine.recipeId];
        const acceptedByRecipe = !!recipe && Object.prototype.hasOwnProperty.call(recipe.inputs || {}, itemId);
        if (acceptedByFurnace || acceptedByRecipe) inserted = !!state.industryEngine?.insert(machine.id, itemId, 1);
      }
      if (inserted) { showToast(`Inserted 1 ${ITEM_NAMES[itemId] || itemId}.`); updateHotbar(); renderInventoryIfOpen(); state.industryUI?.open(machine.id); }
      else showToast('That part is not an input for this machine or its selected recipe.');
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const mx = (event.clientX - rect.left) * W / rect.width;
    const my = (event.clientY - rect.top) * H / rect.height;
    state.pointer = { x: mx, y: my, inside: true, down: true };

    if (state.tool === 'machine') {
      const world = screenToWorld(mx, my);
      let placementOptions = {};
      if (state.machineToPlace === 'drill') {
        const depositHit = findAnyMineableDepositHit(mx, my);
        if (!depositHit) { showToast('Place a Drill directly on a mineral deposit.'); return; }
        placementOptions.deposit = {
          id: depositHit.deposit.id, type: depositHit.type, item: depositHit.item,
          x: depositHit.deposit.x, z: depositHit.deposit.z
        };
      }
      const result = state.industryEngine?.placeMachine(state.machineToPlace, world.x, world.z, placementOptions);
      if (result?.ok) {
        if (result.machine.kind === 'drill') setDepositDrillId(result.machine.depositId, result.machine.id);
        renderInventoryIfOpen(); updateHotbar();
      } else if (result?.reason) showToast(result.reason);
      return;
    }
    if (state.tool === 'belt') {
      const world = screenToWorld(mx, my);
      const result = state.industryEngine?.placeBelt(world.x, world.z, state.beltRotation);
      if (result?.ok) updateHotbar(); else if (result?.reason) showToast(result.reason);
      return;
    }
    if (state.tool === 'shaftLink' || state.tool === 'powerLink' || state.tool === 'moltenLink') {
      const hit = findMachineScreenHit(mx, my);
      if (!hit) { showToast('Click directly on a placed machine.'); return; }
      if (!state.industryLinkStart) {
        state.industryLinkStart = hit.id;
        showToast('First endpoint selected. Click the second machine.');
      } else {
        const linkTool = state.tool;
        const result = linkTool === 'shaftLink'
          ? state.industryEngine?.connectShaft(state.industryLinkStart, hit.id, 'shaft')
          : linkTool === 'moltenLink'
            ? state.industryEngine?.connectMolten(state.industryLinkStart, hit.id)
            : state.industryEngine?.connectPower(state.industryLinkStart, hit.id);
        state.industryLinkStart = null;
        if (result?.ok) showToast(linkTool === 'shaftLink' ? 'Mechanical shaft connected.' : linkTool === 'moltenLink' ? 'Tungsten molten-metal feed connected.' : 'Mains cable connected.');
        else if (result?.reason) showToast(result.reason);
      }
      updateHotbar();
      return;
    }
    const machinePlacementTools = ['machine','belt','shaftLink','powerLink','moltenLink',
      'channel','chute','hygrometer','module','woodPole','pump'];
    if (!machinePlacementTools.includes(state.tool)) {
      const machineHit = findMachineScreenHit(mx, my);
      if (machineHit) {
        const collected = state.industryEngine?.collectAllOutput(machineHit.id);
        if (collected?.total > 0) {
          const summary = Object.entries(collected.items).map(([id, amount]) =>
            `${amount} ${ITEM_NAMES[id] || window.FTSRegistry.items[id]?.name || id}`).join(', ');
          showToast(`Collected ${summary}.${collected.blocked ? ' Inventory full; some items remain.' : ''}`);
          updateUI(true); updateHotbar(); renderInventoryIfOpen();
          return;
        }
        if (collected?.blocked) {
          showToast('Inventory full · make room before collecting machine output.');
          return;
        }
        if (['select','compass','remote'].includes(state.tool)) {
          closeInspection();
          state.industryUI?.open(machineHit.id);
          return;
        }
      }
    }

    if (state.tool === 'pickaxe') { mineStone(mx, my); return; }
    if (state.tool === 'axe') { chopWood(mx, my); return; }
    if (state.tool === 'drill') { placeDrill(mx, my); return; }
    if (state.tool === 'woodPole') { placeWoodPole(mx, my); return; }
    if (state.tool === 'pump') {
      const hit = findChannelHit(mx, my);
      if (hit) attachPump(hit.channel); else showToast('Click an existing channel to install the pump.');
      return;
    }
    if (state.tool !== 'channel' && state.tool !== 'chute' && state.tool !== 'hygrometer' && state.tool !== 'module') {
      const shelter = findShelterHit(mx, my);
      if (shelter && worldDistance(state.player, shelter) < 135) { toggleCrouchAtShelter(shelter); return; }
    }

    if (state.tool === 'channel') {
      if (state.anchorNodeId === null) {
        const candidate = findChannelEndpointCandidate(mx, my);
        const node = materializeChannelEndpoint(candidate);
        if (node) {
          state.anchorNodeId = node.id;
          ui.instruction.textContent = 'Click or drag to any point to place the endpoint. Yellow dots are optional connection helpers.';
          const description = node.kind === 'source' ? 'Water source' : node.kind === 'basin' ? 'Empty Sea' : node.kind === 'junction' ? 'Free endpoint / junction' : 'Connection point';
          showToast(`Start point selected · ${description}.`);
        }
      }
    } else if (state.tool === 'chute') {
      const hit = findChannelHit(mx, my);
      if (hit) attachChute(hit.channel);
    } else if (state.tool === 'hygrometer') {
      placeHygrometer(mx, my);
    } else if (state.tool === 'module') {
      const hit = findChannelHit(mx, my);
      if (hit?.channel?.chute) installModule(hit.channel.id, state.moduleToInstall);
      else showToast('Install a multiplier by clicking a channel with an attached chute.');
    }
  }

  function handleCanvasUp(event) {
    const rect = canvas.getBoundingClientRect();
    const mx = (event.clientX - rect.left) * W / rect.width;
    const my = (event.clientY - rect.top) * H / rect.height;
    state.pointer = { x: mx, y: my, inside: true, down: false };
    if (state.inventoryOpen) return;
    if (state.tool === 'channel' && state.anchorNodeId) {
      const candidate = findChannelEndpointCandidate(mx, my);
      const node = materializeChannelEndpoint(candidate);
      if (node && node.id !== state.anchorNodeId) completeChannel(state.anchorNodeId, node);
      return;
    }
    if (state.tool === 'remote') {
      const sensor = findHygrometerHit(mx, my);
      if (sensor) {
        state.selectedObject = { type: 'hygrometer', id: sensor.id };
        state.selectedChannelId = null;
        renderInspection(); return;
      }
      const channelHit = findChannelHit(mx, my);
      if (channelHit) { selectChannel(channelHit.channel); renderInspection(); return; }
      for (const source of state.sources) {
        if (findSourceScreenHit(mx, my, source)) {
          state.selectedObject = { type: 'source', id: source.id }; state.selectedChannelId = null; renderInspection(); return;
        }
      }
      if (basinScreenHit(mx, my) < 1.2) {
        state.selectedObject = { type: 'basin' }; state.selectedChannelId = null; renderInspection(); return;
      }
      closeInspection();
    }
  }

  function handlePointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    state.pointer = {
      x: (event.clientX - rect.left) * W / rect.width,
      y: (event.clientY - rect.top) * H / rect.height,
      inside: true, down: state.pointer.down
    };
  }

  function jump() {
    const p = state.player;
    if (!p.grounded) return;
    p.vy = 500; p.grounded = false;
  }

  function updatePlayer(dt) {
    if (state.inventoryOpen) { keys.clear(); return; }
    const p = state.player;
    let screenMoveX = 0, screenMoveY = 0;
    // Input follows the visible screen plane rather than the oblique world axes.
    // A/D moves left-right. W/S moves up-down on the projected ground plane.
    if (keys.has('a') || keys.has('arrowleft')) screenMoveX -= 1;
    if (keys.has('d') || keys.has('arrowright')) screenMoveX += 1;
    if (keys.has('w') || keys.has('arrowup')) screenMoveY -= 1;
    if (keys.has('s') || keys.has('arrowdown')) screenMoveY += 1;
    const inputLength = Math.hypot(screenMoveX, screenMoveY);
    if (inputLength > 0) { screenMoveX /= inputLength; screenMoveY /= inputLength; }

    let screenSpeed = (p.crouching ? 92 : 250) * WORLD.projection.x;
    if (state.weather.phase === 'storm' && !p.sheltered) screenSpeed *= .78;
    // Invert project() for the desired screen-plane vector, cancelling the Z-axis
    // horizontal skew so W/S does not drift diagonally across the display.
    const desiredScreenX = screenMoveX * screenSpeed;
    const desiredScreenY = screenMoveY * screenSpeed;
    const stepZPerSecond = desiredScreenY / WORLD.projection.depthSlope;
    const stepXPerSecond = (desiredScreenX - stepZPerSecond * WORLD.projection.z) / WORLD.projection.x;
    const stepX = stepXPerSecond * dt;
    const stepZ = stepZPerSecond * dt;

    // Preserve the player's absolute foot height while traversing a ledge.
    // Downward steps start a gravity-driven fall; upward steps block movement
    // until a jump has lifted the player above the higher shelf.
    const moveTo = (x, z) => {
      const oldGround = terrainHeight(p.x, p.z);
      const oldFootY = oldGround + p.jumpOffset;
      const newGround = terrainHeight(x, z);
      if (newGround > oldFootY + 1.5) return false;

      const newOffset = Math.max(0, oldFootY - newGround);
      const wasGrounded = p.grounded;
      p.x = x;
      p.z = z;
      p.y = newGround;
      p.jumpOffset = newOffset;
      if (newOffset > 1.5) {
        if (wasGrounded) p.vy = 0;
        p.grounded = false;
      } else {
        p.jumpOffset = 0;
        p.vy = 0;
        p.grounded = true;
      }
      return true;
    };

    const nextX = clamp(p.x + stepX, WORLD.xMin + 18, WORLD.xMax - 18);
    if (nextX !== p.x) moveTo(nextX, p.z);
    const nextZ = clamp(p.z + stepZ, WORLD.zMin + 18, WORLD.zMax - 18);
    if (nextZ !== p.z) moveTo(p.x, nextZ);

    p.y = terrainHeight(p.x, p.z);
    p.facing = screenMoveX === 0 ? p.facing : Math.sign(screenMoveX);
    p.moving = inputLength > 0 && (Math.abs(stepX) + Math.abs(stepZ) > 0);
    if (p.moving && p.grounded) p.walkTime += dt;
    if (!p.grounded) {
      p.vy -= 850 * dt;
      p.jumpOffset += p.vy * dt;
      if (p.jumpOffset <= 0) { p.jumpOffset = 0; p.vy = 0; p.grounded = true; }
    }
    state.camera.x = lerp(state.camera.x, p.x, 1 - Math.exp(-5 * dt));
    state.camera.z = lerp(state.camera.z, p.z, 1 - Math.exp(-5 * dt));
    state.camera.y = lerp(state.camera.y, p.y, 1 - Math.exp(-4 * dt));
  }

  function update(dt) {
    if (dt <= 0) return;
    updatePlayer(dt);
    updateSimulation(dt);
    updateWeather(dt);
    state.elapsed += dt;
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) ui.toast.classList.remove('show');
    }
    state.uiTimer += dt;
    if (state.uiTimer >= 0.18) { state.uiTimer = 0; updateUI(false); if (state.industryUI?.currentId) state.industryUI.render(); }
  }

  function frame(timestamp) {
    const dt = state.lastTime ? Math.min((timestamp - state.lastTime) / 1000, 0.04) : 0;
    state.lastTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function initializeIndustry() {
    window.FTSAssets.preloadAll();
    const adapter = {
      getItemCount: id => itemCount(id),
      consumeItem: (id, amount) => consumeItem(id, amount),
      addItem: (id, amount) => giveItem(id, amount),
      onToast: message => showToast(message),
      onChange: () => { updateHotbar(); renderInventoryIfOpen(); },
      terrainHeight: (x, z) => terrainHeight(x, z),
      getChannelFlow: channelId => state.channels.find(channel => channel.id === channelId)?.currentFlow || 0,
      findChannelAt: (x, z) => {
        let best = 165, bestId = null;
        for (const channel of state.channels) {
          const a = state.nodes[channel.a], b = state.nodes[channel.b];
          if (!a || !b) continue;
          const dx = b.x - a.x, dz = b.z - a.z;
          const length2 = dx * dx + dz * dz || 1;
          const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / length2, 0, 1);
          const d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
          if (d < best) { best = d; bestId = channel.id; }
        }
        return bestId;
      },
      findDepositAt: (x, z) => findMineableDepositAt(x, z, 230),
      findIronDeposit: (x, z) => {
        // Legacy fallback retained for older saves and the original engine tests.
        const target = findMineableDepositAt(x, z, 230);
        return target?.type === 'iron' ? target.id : null;
      },
      takeDepositResource: (depositId, amount) => {
        const target = findMineableDepositById(depositId);
        if (!target || target.deposit.remaining < amount) return false;
        target.deposit.remaining -= amount;
        if (target.deposit.remaining <= 0) target.deposit.drillId = target.deposit.drillId || null;
        return true;
      },
      onDrillRemoved: (depositId) => setDepositDrillId(depositId, null),
      isNearVoltite: (x, z) => (state.specialDeposits.voltite || []).some(d => d.remaining > 0 && Math.hypot(d.x - x, d.z - z) < 240),
      onCastingHazard: machine => {
        showToast('DANGEROUS STEAM RELEASE! Unsafe molten-metal feed damaged nearby machinery.');
        state.player.health = 0;
        for (const nearby of state.industryEngine?.machines || []) {
          if (Math.hypot(nearby.x - machine.x, nearby.z - machine.z) < 720) { nearby.condition = 0; nearby.active = false; }
        }
        state.hazardPulse = 1;
      }
    };
    state.industryEngine = new window.FTSIndustryEngine(adapter);
    state.industryUI = new window.FTSIndustryUI(state.industryEngine, adapter);
    window.FTSGame = {
      industry: state.industryEngine,
      registry: window.FTSRegistry,
      getSeed: () => state.seed,
      getWorldSummary: () => ({ layers: state.layerBands.length, ramps: state.ramps.length, middleTier: state.middleTier, spawnTier: layerIndexAt(state.spawn.x), basinTier: state.basin.tier, basinHeight: state.basin.rimY, resourceHighlight: state.resourceHighlight, heightGradient: 'high-contrast global full-world Y range', heightGradientRange: terrainHeightGradientRange(), basinDistanceFromSpawn: Math.hypot(state.basin.x - state.spawn.x, state.basin.z - state.spawn.z), basinSpawnRadius: basinRadius(state.spawn.x, state.spawn.z), starterLayerWidth: state.layerBands[0]?.end - state.layerBands[0]?.start, waterSources: state.sources.length, stoneDeposits: state.stoneDeposits.length, ironDeposits: state.ironDeposits.length, specialDeposits: Object.fromEntries(Object.entries(state.specialDeposits).map(([k,v]) => [k,v.length])) }),
      addItem: giveItem,
      craft: craftItem,
      getItemCount: itemCount,
      getCraftRecipe,
      getCoordinates: () => ({ convention: 'X horizontal, Y vertical, Z depth', projection: { ...WORLD.projection } }),
      worldToScreen: project,
      screenToWorld,
      getPlayerPosition: () => ({ x: state.player.x, y: state.player.y, z: state.player.z, jumpOffset: state.player.jumpOffset, grounded: state.player.grounded }),
      getMovementTuning: () => ({ horizontalScreenSpeed: 250 * WORLD.projection.x, screenVerticalGroundSpeed: 250 * WORLD.projection.x, jumpHeight: (500 * 500) / (2 * 850), ramps: 0 }),
      getCameraPosition: () => ({ x: state.camera.x, y: state.camera.y, z: state.camera.z }),
      getTerrainHeight: terrainHeight,
      getResourceScreenBounds: (kind, resource, subtype = null) => ({ ...getResourceScreenBounds(kind, resource, subtype) }),
      hitTestResource: (kind, resource, screenX, screenY, subtype = null) => boundsHitScore(getResourceScreenBounds(kind, resource, subtype), screenX, screenY) < Infinity,
      findMineableDepositAt,
      findMineableDepositById,
      getTerrainLayerColors: tier => ({ ...terrainLayerColors(tier) }),
      getTerrainHeightGradientRange: () => ({ ...terrainHeightGradientRange() }),
      getTerrainViewportBounds: () => ({ ...terrainViewportBounds() }),
      getTerrainGrassColorAtHeight: worldY => terrainGrassColorAtHeight(worldY),
      getLayerIndexAt: x => layerIndexAt(x),
      getWeatherConfig: () => ({ ...WEATHER_TUNING }),
      getStarterLoadout: () => ({ totalSlots: state.bagSlots.length + state.hotbar.length, inventory: { ...state.inventory }, materials: { ...state.materials }, modules: { ...state.moduleInventory }, bagSlots: [...state.bagSlots], bagSlotCounts: [...state.bagSlotCounts], hotbar: [...state.hotbar], hotbarCounts: [...state.hotbarCounts], heldItem: state.heldItem, tool: state.tool }),
      isResourceHighlighting: () => state.resourceHighlight,
      createFreeChannelEndpoint: (x, z) => {
        const node = createNode('junction', x, terrainHeight(x, z) + 18, z);
        return { ...node };
      },
      renderFrame: draw
    };
  }

  function bindButton(id, callback) {
    const element = document.getElementById(id);
    if (element) element.addEventListener('click', callback);
  }
  bindButton('regenerate', () => generateTerrain());
  bindButton('resource-highlight', () => toggleResourceHighlights());
  bindButton('close-inspection', closeInspection);
  bindButton('jump', event => { event.preventDefault?.(); jump(); });
  bindButton('inventory-close', () => toggleInventory(false));
  bindButton('inventory-tab', () => toggleInventory());
  bindButton('touch-inventory', () => toggleInventory());
  bindButton('interact', () => toggleCrouchAtShelter());
  document.getElementById('hotbar-bar').addEventListener('click', event => {
    const slot = event.target.closest('[data-hotbar]');
    if (slot && !state.inventoryOpen) selectHotbar(Number(slot.dataset.hotbar));
  });
  bindInventoryEvents();

  ui.inspectionContent.addEventListener('click', event => {
    const install = event.target.closest('[data-install-module]');
    const remove = event.target.closest('[data-remove-slot]');
    const repair = event.target.closest('[data-repair-channel]');
    if (install) installModule(state.selectedChannelId, install.dataset.installModule);
    if (remove) removeModule(state.selectedChannelId, Number(remove.dataset.removeSlot));
    if (repair) repairChannel(repair.dataset.repairChannel);
  });

  canvas.addEventListener('dblclick', event => {
    if (!state.heldItem || !['castIron','castBrass','castCopper','castTransformer'].includes(state.heldItem) || !state.industryEngine) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (event.clientX - rect.left) * W / rect.width;
    const my = (event.clientY - rect.top) * H / rect.height;
    const machine = findMachineScreenHit(mx, my);
    if (!machine || machine.kind !== 'castingMachine') return;
    const result = state.industryEngine.installCast(machine.id, state.heldItem);
    if (result.ok) { showToast('Casting pattern swapped.'); renderInventoryIfOpen(); updateHotbar(); state.industryUI?.open(machine.id); }
    else showToast(result.reason);
  });
  canvas.addEventListener('pointerdown', event => { event.preventDefault(); canvas.setPointerCapture?.(event.pointerId); handleCanvasDown(event); });
  canvas.addEventListener('pointerup', event => { event.preventDefault(); handleCanvasUp(event); });
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerleave', () => { state.pointer.inside = false; state.pointer.down = false; });
  canvas.addEventListener('contextmenu', event => event.preventDefault());

  window.addEventListener('wheel', event => {
    if (state.inventoryOpen || state.hotbar.every(slot => !slot)) return;
    event.preventDefault();
    let index = state.selectedHotbar < 0 ? 0 : state.selectedHotbar;
    for (let attempt = 0; attempt < 9; attempt++) {
      index = (index + (event.deltaY > 0 ? 1 : -1) + 9) % 9;
      const id = state.hotbar[index];
      if (id && itemCount(id) > 0) { selectHotbar(index); break; }
    }
  }, { passive: false });

  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'tab') { event.preventDefault(); if (!event.repeat) toggleInventory(); return; }
    if (state.inventoryOpen) { if (key === 'escape') toggleInventory(false); return; }
    if (event.target?.closest?.('button')) return;
    if (/^[1-9]$/.test(key)) { selectHotbar(Number(key) - 1); return; }
    if (key === 'h' && !event.repeat) { toggleResourceHighlights(); return; }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    keys.add(key);
    if (key === ' ' && !event.repeat) jump();
    if (key === 'e' && !event.repeat) toggleCrouchAtShelter();
    if (key === 'r' && !event.repeat) {
      if (state.tool === 'belt') { state.beltRotation = (state.beltRotation + 90) % 360; showToast(`Conveyor direction: ${state.beltRotation}°`); }
      else generateTerrain();
    }
    if (key === 'escape') { state.anchorNodeId = null; setTool('select'); showToast('Construction cancelled.'); }
  });
  window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  for (const button of document.querySelectorAll('[data-key]')) {
    const key = button.dataset.key;
    button.addEventListener('pointerdown', event => { event.preventDefault(); keys.add(key); button.setPointerCapture?.(event.pointerId); });
    const release = event => { event.preventDefault(); keys.delete(key); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', () => keys.delete(key));
    button.addEventListener('contextmenu', event => event.preventDefault());
  }

  initializeIndustry();
  generateTerrain();
  updateHotbar();
  showToast('You have stone tools. Press H or use the button to highlight resources.');
  requestAnimationFrame(frame);
})();