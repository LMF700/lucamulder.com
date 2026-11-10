/* Industrial simulation for Fill The Sea.
 * The simulation knows nothing about image sizes or sprite rendering.
 */
(() => {
  'use strict';

  class IndustryEngine {
    constructor(adapter = {}) {
      this.adapter = adapter;
      this.registry = window.FTSRegistry;
      this.machines = [];
      this.belts = [];
      this.shaftLinks = [];
      this.moltenLinks = [];
      this.powerLinks = [];
      this.nextId = 1;
      this.selectedMachineId = null;
      this.lastTransfer = 0;
    }

    toast(message) { this.adapter.onToast?.(message); }
    itemCount(id) { return this.adapter.getItemCount?.(id) ?? 0; }
    consume(id, amount = 1) { return this.adapter.consumeItem?.(id, amount) ?? false; }
    add(id, amount = 1) { return this.adapter.addItem?.(id, amount) ?? false; }
    machineDef(kind) { return this.registry.machines[kind] || null; }

    reset() {
      this.machines = []; this.belts = []; this.shaftLinks = []; this.moltenLinks = []; this.powerLinks = [];
      this.nextId = 1; this.selectedMachineId = null;
    }

    placeMachine(kind, x, z, options = {}) {
      const def = this.machineDef(kind);
      if (!def) return { ok: false, reason: 'Unknown machine.' };
      if (!options.free && !this.consume(def.item, 1)) return { ok: false, reason: `You need a ${this.registry.items[def.item]?.name || def.item}.` };
      let channelId = options.channelId || null;
      if (kind === 'mainsSupply' && !this.adapter.isNearVoltite?.(x, z)) {
        if (!options.free) this.add(def.item, 1);
        return { ok: false, reason: 'Place the Mains Supply directly beside a Voltite deposit.' };
      }
      if (kind === 'waterwheel' || kind === 'accumulator') {
        if (!channelId) channelId = this.adapter.findChannelAt?.(x, z) || null;
        if ((kind === 'waterwheel' || kind === 'accumulator') && !channelId) {
          if (!options.free) this.add(def.item, 1);
          return { ok: false, reason: kind === 'waterwheel' ? 'Place the Waterwheel over an existing channel.' : 'Place the Accumulator beside a channel.' };
        }
      }
      let drillTarget = null;
      let depositId = options.depositId || null;
      if (kind === 'drill') {
        // Drills work on every mineable mineral deposit, not just Iron.
        drillTarget = options.deposit || this.adapter.findDepositAt?.(x, z) || null;
        if (!drillTarget && depositId) {
          drillTarget = { id: depositId, type: 'iron', item: 'ironOre', x, z };
        }
        // Backwards compatibility for integrations that still expose the old Iron-only adapter.
        if (!drillTarget) {
          const legacyIronId = this.adapter.findIronDeposit?.(x, z) || null;
          if (legacyIronId) drillTarget = { id: legacyIronId, type: 'iron', item: 'ironOre', x, z };
        }
        if (!drillTarget?.id || !drillTarget?.item) {
          if (!options.free) this.add(def.item, 1);
          return { ok: false, reason: 'Place a Drill on a mineable mineral deposit.' };
        }
        depositId = drillTarget.id;
        if (this.machines.some(m => m.kind === 'drill' && m.depositId === depositId)) {
          if (!options.free) this.add(def.item, 1);
          return { ok: false, reason: 'That deposit already has a Drill.' };
        }
        // Snap the Drill to the centre of the selected deposit.
        if (Number.isFinite(drillTarget.x)) x = drillTarget.x;
        if (Number.isFinite(drillTarget.z)) z = drillTarget.z;
      }
      const machine = {
        id: `machine-${this.nextId++}`, kind, x, z,
        rotation: options.rotation || 0,
        channelId, depositId,
        depositType: drillTarget?.type || (kind === 'drill' ? 'iron' : null),
        depositItem: drillTarget?.item || (kind === 'drill' ? 'ironOre' : null),
        recipeId: def.recipeIds?.[0] || null,
        input: {}, output: {}, progress: 0,
        crankCount: 0, crankLoaded: false,
        charge: 0, batterySeconds: 0,
        powered: false, mechanicalPower: 0,
        flow: 0, rpm: 0, force: 0,
        castId: null, condition: 100,
        active: true, createdAt: Date.now()
      };
      this.machines.push(machine);
      if (kind === 'mainsSupply') machine.voltiteSource = !!this.adapter.isNearVoltite?.(x, z);
      this.toast(`${this.registry.items[def.item].name} placed.`);
      return { ok: true, machine };
    }

    placeBelt(x, z, rotation = 0) {
      if (!this.consume('conveyorBelt', 1)) return { ok: false, reason: 'You need a Conveyor Belt.' };
      if (this.belts.some(b => Math.hypot(b.x - x, b.z - z) < 34)) {
        this.add('conveyorBelt', 1);
        return { ok: false, reason: 'There is already a belt here.' };
      }
      const belt = { id: `belt-${this.nextId++}`, x, z, rotation, item: null, progress: 0, speed: 0.72 };
      this.belts.push(belt);
      return { ok: true, belt };
    }

    connectShaft(aId, bId, shaftItem = 'shaft') {
      if (shaftItem !== 'shaft') return { ok: false, reason: 'Only ordinary Shafts transmit mechanical power. Use Tungsten Shaft for molten-metal feed.' };
      if (aId === bId) return { ok: false, reason: 'Choose two different machines.' };
      const a = this.getMachine(aId), b = this.getMachine(bId);
      if (!a || !b) return { ok: false, reason: 'Both endpoints must be machines.' };
      if (this.shaftLinks.some(link => (link.a === aId && link.b === bId) || (link.a === bId && link.b === aId))) return { ok: false, reason: 'Those machines are already connected.' };
      if (!this.consume(shaftItem, 1)) return { ok: false, reason: `You need a ${this.registry.items[shaftItem]?.name || shaftItem}.` };
      this.shaftLinks.push({ id: `shaft-${this.nextId++}`, a: aId, b: bId, material: shaftItem });
      return { ok: true };
    }

    connectMolten(sourceId, targetId) {
      if (sourceId === targetId) return { ok: false, reason: 'Choose two different machines.' };
      const source = this.getMachine(sourceId), target = this.getMachine(targetId);
      if (!source || !target || source.kind !== 'furnace' || target.kind !== 'castingMachine') {
        return { ok: false, reason: 'Tungsten feed must run from a Furnace to a Casting Machine.' };
      }
      if (this.moltenLinks.some(link => link.from === sourceId && link.to === targetId)) {
        return { ok: false, reason: 'Those machines already have a Tungsten feed.' };
      }
      if (!this.consume('tungstenShaft', 1)) return { ok: false, reason: 'You need a Tungsten Shaft.' };
      this.moltenLinks.push({ id: `molten-${this.nextId++}`, from: sourceId, to: targetId, material: 'tungstenShaft' });
      return { ok: true };
    }

    hasSafeMoltenFeed(machineId) {
      return this.moltenLinks.some(link => link.to === machineId);
    }

    connectPower(aId, bId) {
      const a = this.getMachine(aId), b = this.getMachine(bId);
      if (!a || !b || aId === bId) return { ok: false, reason: 'Select two different machines.' };
      const validPair = (a.kind === 'mainsSupply' && b.kind === 'accumulator') || (b.kind === 'mainsSupply' && a.kind === 'accumulator');
      if (!validPair) return { ok: false, reason: 'Connect a Voltite-powered Mains Supply to an Accumulator.' };
      if (this.powerLinks.some(link => (link.a === aId && link.b === bId) || (link.a === bId && link.b === aId))) return { ok: false, reason: 'Those machines are already connected.' };
      if (!this.consume('mainsCable', 1)) return { ok: false, reason: 'You need a Mains Cable.' };
      this.powerLinks.push({ id: `power-${this.nextId++}`, a: aId, b: bId });
      return { ok: true };
    }

    getMachine(id) { return this.machines.find(m => m.id === id) || null; }

    getMachineAt(x, z, radius = 105) {
      let closest = null, best = radius;
      for (const machine of this.machines) {
        const d = Math.hypot(machine.x - x, machine.z - z);
        if (d < best) { best = d; closest = machine; }
      }
      return closest;
    }

    getBeltAt(x, z, radius = 48) {
      let closest = null, best = radius;
      for (const belt of this.belts) {
        const d = Math.hypot(belt.x - x, belt.z - z);
        if (d < best) { best = d; closest = belt; }
      }
      return closest;
    }

    setRecipe(machineId, recipeId) {
      const machine = this.getMachine(machineId);
      const recipe = this.registry.machineRecipes[recipeId];
      if (!machine || !recipe || recipe.machine !== machine.kind) return false;
      machine.recipeId = recipeId;
      machine.progress = 0;
      return true;
    }

    insert(machineId, itemId, amount = 1) {
      const machine = this.getMachine(machineId);
      if (!machine) return false;
      const isFluid = !!this.registry.fluids?.[itemId];
      const hasSafeFeed = this.hasSafeMoltenFeed(machine.id);
      if (machine.kind === 'castingMachine' && isFluid && !hasSafeFeed) {
        this.adapter.onCastingHazard?.(machine);
        return false;
      }
      // Molten metal is a process fluid: players cannot pick it up or insert it by hand.
      if (isFluid) return false;
      if (!this.consume(itemId, amount)) return false;
      machine.input[itemId] = (machine.input[itemId] || 0) + amount;
      return true;
    }

    take(machineId, itemId, amount = Infinity) {
      const machine = this.getMachine(machineId);
      if (!machine || this.registry.fluids?.[itemId]) return 0;
      const available = machine.output[itemId] || 0;
      const requested = Math.min(available, Number.isFinite(amount) ? Math.max(0, amount) : available);
      let taken = 0;
      // Transfer one at a time so a partly-full inventory can collect a partial stack
      // without deleting the machine's remaining output.
      while (taken < requested && this.add(itemId, 1)) taken++;
      if (!taken) return 0;
      machine.output[itemId] -= taken;
      if (machine.output[itemId] <= 0) delete machine.output[itemId];
      return taken;
    }

    getCollectibleOutput(machineId) {
      const machine = this.getMachine(machineId);
      if (!machine) return {};
      return Object.fromEntries(Object.entries(machine.output)
        .filter(([itemId, amount]) => amount > 0 && !this.registry.fluids?.[itemId]));
    }

    collectAllOutput(machineId) {
      const machine = this.getMachine(machineId);
      if (!machine) return { ok: false, total: 0, items: {}, blocked: false };
      const collected = {};
      let blocked = false;
      for (const [itemId, available] of Object.entries(machine.output)) {
        if (this.registry.fluids?.[itemId] || available <= 0) continue;
        const amount = this.take(machineId, itemId, available);
        if (amount > 0) collected[itemId] = amount;
        if ((machine.output[itemId] || 0) > 0) blocked = true;
      }
      const total = Object.values(collected).reduce((sum, amount) => sum + amount, 0);
      return { ok: total > 0, total, items: collected, blocked,
        remaining: this.getCollectibleOutput(machineId) };
    }

    crank(machineId, clicks = 1) {
      const machine = this.getMachine(machineId);
      if (!machine || machine.kind !== 'coilingDevice') return { ok: false, reason: 'This machine cannot be cranked.' };
      const recipe = this.registry.machineRecipes['coil-copper'];
      if (!machine.crankLoaded) {
        if (!this.hasInputs(machine, recipe.inputs)) return { ok: false, reason: 'Load five Copper Ingots into the Coiling Device first.' };
        this.consumeInputs(machine, recipe.inputs);
        machine.crankLoaded = true;
        machine.crankCount = 0;
      }
      machine.crankCount = Math.min(recipe.cranks, machine.crankCount + Math.max(1, clicks));
      if (machine.crankCount >= recipe.cranks) {
        machine.output.copperCoil = (machine.output.copperCoil || 0) + 1;
        machine.crankLoaded = false;
        machine.crankCount = 0;
        this.toast('Copper Coil finished. Collect it from the Coiling Device.');
        return { ok: true, complete: true };
      }
      return { ok: true, complete: false, progress: machine.crankCount / recipe.cranks };
    }

    installCast(machineId, castId) {
      const machine = this.getMachine(machineId);
      if (!machine || machine.kind !== 'castingMachine') return { ok: false, reason: 'This is not a Casting Machine.' };
      if (!['castIron','castBrass','castCopper','castTransformer'].includes(castId)) return { ok: false, reason: 'That cast is not compatible.' };
      if (!this.consume(castId, 1)) return { ok: false, reason: 'You do not have that cast.' };
      const previous = machine.castId;
      if (previous) this.add(previous, 1);
      machine.castId = castId;
      machine.recipeId = ({ castIron:'cast-iron', castBrass:'cast-brass', castCopper:'cast-copper', castTransformer:'cast-transformer' })[castId];
      return { ok: true, previous };
    }

    insertBattery(machineId) {
      const machine = this.getMachine(machineId);
      if (!machine || machine.kind !== 'accumulator') return { ok: false, reason: 'Batteries are inserted into an Accumulator.' };
      if (!this.consume('battery', 1)) return { ok: false, reason: 'You need a Battery.' };
      machine.batterySeconds += 90;
      return { ok: true };
    }

    hasInputs(machine, inputs) {
      return Object.entries(inputs).every(([id, count]) => (machine.input[id] || 0) >= count);
    }

    consumeInputs(machine, inputs) {
      for (const [id, count] of Object.entries(inputs)) {
        machine.input[id] -= count;
        if (machine.input[id] <= 0) delete machine.input[id];
      }
    }

    outputRoom(machine, outputs) {
      return Object.entries(outputs).every(([id, count]) => (machine.output[id] || 0) + count <= 99);
    }

    getMechanicalComponent(startId) {
      const visited = new Set([startId]), queue = [startId];
      while (queue.length) {
        const current = queue.shift();
        for (const link of this.shaftLinks) {
          const next = link.a === current ? link.b : link.b === current ? link.a : null;
          if (next && !visited.has(next)) { visited.add(next); queue.push(next); }
        }
      }
      return [...visited].map(id => this.getMachine(id)).filter(Boolean);
    }

    hasPowerPath(startId) {
      const visited = new Set([startId]), queue = [startId];
      while (queue.length) {
        const current = queue.shift();
        const currentMachine = this.getMachine(current);
        if (currentMachine?.kind === 'mainsSupply' && (currentMachine.voltiteSource || this.adapter.isNearVoltite?.(currentMachine.x, currentMachine.z))) return true;
        for (const link of this.powerLinks) {
          const next = link.a === current ? link.b : link.b === current ? link.a : null;
          if (next && !visited.has(next)) { visited.add(next); queue.push(next); }
        }
      }
      return false;
    }

    channelMultiplier(channelId) {
      let multiplier = 1;
      for (const machine of this.machines) {
        if (machine.kind === 'accumulator' && machine.channelId === channelId && machine.charge > 0) multiplier *= 10;
      }
      return multiplier;
    }

    updateMechanical(dt) {
      for (const machine of this.machines) {
        machine.mechanicalPower = 0;
        if (machine.kind !== 'waterwheel') continue;
        const rawFlow = this.adapter.getChannelFlow?.(machine.channelId) || 0;
        machine.flow = Math.min(rawFlow, this.machineDef('waterwheel').maxFlow);
        machine.rpm = machine.flow / 4;
        machine.force = machine.flow / 2;
        machine.mechanicalPower = machine.rpm * machine.force / 6;
      }
      for (const drill of this.machines.filter(m => m.kind === 'drill')) {
        const component = this.getMechanicalComponent(drill.id);
        const power = component.reduce((sum, m) => sum + (m.kind === 'waterwheel' ? m.mechanicalPower : 0), 0);
        drill.mechanicalPower = power;
        if (power <= 0 || drill.active === false) continue;
        drill.powerBuffer = (drill.powerBuffer || 0) + power * dt;
        while (drill.powerBuffer >= 50) {
          const result = this.adapter.takeDepositResource?.(drill.depositId, 1, drill.depositType);
          if (!result) { drill.powerBuffer = 0; drill.active = false; break; }
          drill.powerBuffer -= 50;
          const outputItem = drill.depositItem || 'ironOre';
          drill.output[outputItem] = (drill.output[outputItem] || 0) + 1;
        }
      }
    }

    updatePower() {
      for (const machine of this.machines) {
        if (machine.kind === 'accumulator') {
          machine.powered = this.hasPowerPath(machine.id);
        }
      }
    }

    updateAccumulators(dt) {
      for (const machine of this.machines) {
        if (machine.kind !== 'accumulator') continue;
        if (machine.powered) machine.charge = Math.min(100, machine.charge + dt * 3.5);
        else if (machine.batterySeconds > 0) {
          machine.batterySeconds = Math.max(0, machine.batterySeconds - dt);
          machine.charge = Math.min(100, machine.charge + dt * 2.2);
        } else machine.charge = Math.max(0, machine.charge - dt * 1.5);
      }
    }

    updateBelts(dt) {
      // Conveyor belts are self-powered. Items move one belt segment at a time.
      for (const belt of this.belts) {
        if (!belt.item) {
          const direction = belt.rotation * Math.PI / 180;
          const dx = Math.cos(direction), dz = Math.sin(direction);
          const source = this.machines.find(m => {
            const vx = belt.x - m.x, vz = belt.z - m.z;
            return Math.hypot(vx, vz) < 105 && vx * dx + vz * dz > 0 &&
              Object.keys(m.output).some(id => !this.registry.fluids?.[id] && m.output[id] > 0);
          });
          if (source) {
            const id = Object.keys(source.output).find(itemId => !this.registry.fluids?.[itemId] && source.output[itemId] > 0);
            if (!id) continue;
            source.output[id]--;
            if (source.output[id] <= 0) delete source.output[id];
            belt.item = id;
            belt.lastSourceId = source.id;
            belt.progress = 0;
          }
        } else {
          belt.progress += belt.speed * dt;
          if (belt.progress < 1) continue;
          const a = belt.rotation * Math.PI / 180;
          const tx = belt.x + Math.cos(a) * 62;
          const tz = belt.z + Math.sin(a) * 62;
          const next = this.belts.find(b => b.id !== belt.id && !b.item && Math.hypot(b.x - tx, b.z - tz) < 56);
          if (next) {
            next.item = belt.item; next.progress = 0; belt.item = null; belt.progress = 0;
          } else {
            const target = this.machines.find(m => Math.hypot(m.x - tx, m.z - tz) < 100 && m.id !== belt.id);
            if (target) {
              const item = belt.item;
              const isMolten = ['moltenIron','moltenBrass','moltenCopper'].includes(item);
              const safeFeed = this.hasSafeMoltenFeed(target.id);
              if (target.kind === 'castingMachine' && isMolten && !safeFeed) {
                this.adapter.onCastingHazard?.(target);
              } else target.input[item] = (target.input[item] || 0) + 1;
              belt.item = null; belt.lastSourceId = null; belt.progress = 0;
            } else belt.progress = 0.95;
          }
        }
      }
    }

    updateMoltenTransfers(dt) {
      // Tungsten Shafts are dedicated molten-metal conduits, separate from mechanical Shafts.
      // A conduit transfers up to one unit every 0.8 seconds when the Furnace has output
      // and the Casting Machine has room in its input buffer.
      for (const link of this.moltenLinks) {
        const source = this.getMachine(link.from), target = this.getMachine(link.to);
        if (!source || !target) continue;
        link.transferTimer = (link.transferTimer || 0) + dt;
        if (link.transferTimer < 0.8) continue;
        const moltenId = ['moltenIron', 'moltenBrass', 'moltenCopper'].find(id => (source.output[id] || 0) > 0);
        if (!moltenId || (target.input[moltenId] || 0) >= 20) continue;
        source.output[moltenId]--;
        if (source.output[moltenId] <= 0) delete source.output[moltenId];
        target.input[moltenId] = (target.input[moltenId] || 0) + 1;
        link.transferTimer = 0;
      }
    }

    updateMachines(dt) {
      const furnaceProcesses = {
        stone: { output: 'sand', seconds: 3 },
        sand: { output: 'glassPane', seconds: 5 },
        ironOre: { output: 'ironIngot', seconds: 4 },
        copperOre: { output: 'copperIngot', seconds: 4 },
        zincOre: { output: 'zincIngot', seconds: 4 },
        ironIngot: { output: 'moltenIron', seconds: 3 },
        copperIngot: { output: 'moltenCopper', seconds: 3 },
        brassIngot: { output: 'moltenBrass', seconds: 3 }
      };
      for (const machine of this.machines) {
        const def = this.machineDef(machine.kind);
        if (machine.kind === 'drill' || machine.kind === 'waterwheel') continue;
        if (machine.kind === 'furnace') {
          const inputId = Object.keys(machine.input).find(id => furnaceProcesses[id] && machine.input[id] > 0);
          const process = inputId ? furnaceProcesses[inputId] : null;
          if (!process || !this.outputRoom(machine, { [process.output]: 1 })) { machine.progress = 0; continue; }
          machine.progress += dt;
          if (machine.progress >= process.seconds) {
            machine.progress -= process.seconds;
            machine.input[inputId]--;
            if (machine.input[inputId] <= 0) delete machine.input[inputId];
            machine.output[process.output] = (machine.output[process.output] || 0) + 1;
          }
          continue;
        }
        if (!def?.recipeIds?.length) continue;
        const recipe = this.registry.machineRecipes[machine.recipeId] || this.registry.machineRecipes[def.recipeIds[0]];
        if (!recipe || !this.hasInputs(machine, recipe.inputs) || !this.outputRoom(machine, recipe.outputs)) {
          machine.progress = 0;
          continue;
        }
        if (recipe.requiresCast && machine.castId !== recipe.requiresCast) continue;
        if (recipe.requiresTungstenShaft && !this.hasSafeMoltenFeed(machine.id)) continue;
        if (recipe.cranks) continue; // Coiling Device advances only through manual cranking.
        machine.progress += dt;
        const seconds = recipe.seconds || 1;
        if (machine.progress >= seconds) {
          machine.progress -= seconds;
          this.consumeInputs(machine, recipe.inputs);
          for (const [id, count] of Object.entries(recipe.outputs)) machine.output[id] = (machine.output[id] || 0) + count;
        }
      }
    }

    tick(dt) {
      this.updatePower();
      this.updateMechanical(dt);
      this.updateAccumulators(dt);
      this.updateBelts(dt);
      this.updateMoltenTransfers(dt);
      this.updateMachines(dt);
    }

    getMachineSnapshot(machineId) {
      const m = this.getMachine(machineId);
      if (!m) return null;
      const def = this.machineDef(m.kind);
      const recipe = this.registry.machineRecipes[m.recipeId] || null;
      return {
        ...m,
        collectibleOutput: this.getCollectibleOutput(machineId),
        collectibleOutputCount: Object.values(this.getCollectibleOutput(machineId)).reduce((sum, amount) => sum + amount, 0),
        name: this.registry.items[def.item]?.name || m.kind,
        recipeName: recipe?.name || 'No recipe',
        recipeOptions: (def.recipeIds || []).map(id => ({ id, name: this.registry.machineRecipes[id]?.name || id })),
        crankTarget: recipe?.cranks || 0,
        progressPercent: recipe?.cranks ? m.crankCount / recipe.cranks : (recipe?.seconds ? m.progress / recipe.seconds : 0),
        waterMultiplier: m.kind === 'accumulator' && m.charge > 0 ? 10 : 1
      };
    }

    removeMachine(machineId) {
      const index = this.machines.findIndex(m => m.id === machineId);
      if (index < 0) return false;
      const [machine] = this.machines.splice(index, 1);
      const item = this.machineDef(machine.kind)?.item;
      if (item) this.add(item, 1);
      if (machine.kind === 'drill' && machine.depositId) this.adapter.onDrillRemoved?.(machine.depositId, machine.id);
      this.shaftLinks = this.shaftLinks.filter(link => link.a !== machineId && link.b !== machineId);
      this.moltenLinks = this.moltenLinks.filter(link => link.from !== machineId && link.to !== machineId);
      this.powerLinks = this.powerLinks.filter(link => link.a !== machineId && link.b !== machineId);
      return true;
    }

    draw(ctx, project, camera, assets) {
      for (const link of this.shaftLinks) {
        const a = this.getMachine(link.a), b = this.getMachine(link.b);
        if (!a || !b) continue;
        const pa = project(a.x, this.adapter.terrainHeight?.(a.x, a.z) + 42 || 42, a.z);
        const pb = project(b.x, this.adapter.terrainHeight?.(b.x, b.z) + 42 || 42, b.z);
        ctx.save(); ctx.strokeStyle = '#656565'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      }
      for (const link of this.moltenLinks) {
        const a = this.getMachine(link.from), b = this.getMachine(link.to);
        if (!a || !b) continue;
        const pa = project(a.x, (this.adapter.terrainHeight?.(a.x, a.z) || 0) + 52, a.z);
        const pb = project(b.x, (this.adapter.terrainHeight?.(b.x, b.z) || 0) + 52, b.z);
        ctx.save(); ctx.strokeStyle = '#d6d9df'; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        ctx.strokeStyle = '#4b4e55'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
      }
      for (const link of this.powerLinks) {
        const a = this.getMachine(link.a), b = this.getMachine(link.b);
        if (!a || !b) continue;
        const pa = project(a.x, this.adapter.terrainHeight?.(a.x, a.z) + 68 || 68, a.z);
        const pb = project(b.x, this.adapter.terrainHeight?.(b.x, b.z) + 68 || 68, b.z);
        ctx.save(); ctx.strokeStyle = '#d5b527'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke(); ctx.restore();
      }
      for (const belt of this.belts) {
        const y = (this.adapter.terrainHeight?.(belt.x, belt.z) || 0) + 7;
        const p = project(belt.x, y, belt.z);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(belt.rotation * Math.PI / 180);
        ctx.fillStyle = '#4b4b4b'; ctx.strokeStyle = '#151515'; ctx.lineWidth = 3; ctx.fillRect(-28, -7, 56, 14); ctx.strokeRect(-28, -7, 56, 14);
        ctx.fillStyle = '#aaa'; for (let i = -20; i <= 20; i += 10) { ctx.fillRect(i, -5, 3, 10); }
        if (belt.item) { ctx.fillStyle = '#f3ef00'; ctx.fillRect(-4 + belt.progress * 36, -11, 9, 8); }
        ctx.restore();
      }
      for (const machine of this.machines) {
        const def = this.machineDef(machine.kind);
        const y = (this.adapter.terrainHeight?.(machine.x, machine.z) || 0) + 7;
        const p = project(machine.x, y, machine.z);
        const image = assets?.get?.(def.sprite);
        const [fallbackWidth, fallbackHeight] = def.size || [88, 80];
        const spriteScale = Number.isFinite(def.worldScale) ? def.worldScale : 1;
        // Machine art keeps its own native pixel dimensions. Inventory icons are
        // still scaled to 32x32 in the UI, independently of in-world sprite size.
        const width = image?.naturalWidth > 0 ? image.naturalWidth * spriteScale : fallbackWidth;
        const height = image?.naturalHeight > 0 ? image.naturalHeight * spriteScale : fallbackHeight;
        ctx.save();
        if (image) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(image, p.x - width / 2, p.y - height, width, height);
        } else {
          ctx.fillStyle = machine.kind === 'waterwheel' ? '#777' : machine.kind === 'accumulator' ? '#777c86' : '#8a8a8a';
          ctx.strokeStyle = '#202020'; ctx.lineWidth = 4;
          ctx.fillRect(p.x - width / 2, p.y - height, width, height * .72);
          ctx.strokeRect(p.x - width / 2, p.y - height, width, height * .72);
          ctx.fillStyle = '#111'; ctx.font = 'bold 10px Verdana'; ctx.textAlign = 'center';
          ctx.fillText(this.registry.items[def.item]?.name || machine.kind, p.x, p.y - height * .46);
          if (machine.kind === 'accumulator') { ctx.fillStyle = machine.charge > 0 ? '#d7e42e' : '#777'; ctx.fillRect(p.x - width * .3, p.y - height * .22, width * .6 * machine.charge / 100, 6); }
        }
        if (machine.kind === 'waterwheel' && machine.rpm > 0) {
          ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y - height * .48, 17, machine.rpm * .02, machine.rpm * .02 + Math.PI * 1.55); ctx.stroke();
        }
        const outputCount = Object.entries(machine.output).reduce((sum, [itemId, amount]) =>
          sum + (!this.registry.fluids?.[itemId] ? Math.max(0, amount) : 0), 0);
        if (outputCount > 0) {
          const label = `+ ${outputCount} · CLICK`;
          ctx.font = 'bold 10px Verdana';
          const labelWidth = ctx.measureText(label).width + 14;
          const labelX = p.x - labelWidth / 2, labelY = p.y - height - 20;
          ctx.fillStyle = '#111'; ctx.strokeStyle = '#f2df3b'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(labelX, labelY, labelWidth, 17, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(label, p.x, labelY + 12); ctx.textAlign = 'left';
        }
        ctx.restore();
      }
    }
  }

  window.FTSIndustryEngine = IndustryEngine;
})();
