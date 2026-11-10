/* Context panel for placed machines. Every recipe-driven machine uses a Stonecutter-style icon selector. */
(() => {
  'use strict';
  class IndustryUI {
    constructor(engine, adapter = {}) {
      this.engine = engine;
      this.adapter = adapter;
      this.root = document.getElementById('industry-inspector');
      this.currentId = null;
      if (this.root) {
        this.root.addEventListener('click', event => this.handleClick(event));
        this.root.addEventListener('change', event => this.handleChange(event));
        this.root.addEventListener('dragover', event => {
          if (event.target.closest('[data-machine-input]')) event.preventDefault();
        });
        this.root.addEventListener('drop', event => {
          const slot = event.target.closest('[data-machine-input]');
          if (!slot || !this.currentId) return;
          event.preventDefault();
          const itemId = event.dataTransfer?.getData('text/plain');
          const machine = this.engine.getMachine(this.currentId);
          if (!machine || !itemId) return;
          machine._uiInput = itemId;
          if (machine.kind === 'furnace') {
            const accepted = ['stone','sand','ironOre','copperOre','zincOre','ironIngot','copperIngot','brassIngot'];
            if (!accepted.includes(itemId)) { this.adapter.onToast?.('That material cannot be processed by this Furnace.'); return; }
            if (!this.engine.insert(machine.id, itemId, 1)) this.adapter.onToast?.('Could not load that material.');
          } else {
            const options = this.getRecipeOptions(machine).filter(([, recipe]) => Object.prototype.hasOwnProperty.call(recipe.inputs || {}, itemId));
            if (!options.length) { this.adapter.onToast?.('This machine has no recipe using that item.'); return; }
            if (!this.engine.insert(machine.id, itemId, 1)) { this.adapter.onToast?.('Could not load that input.'); return; }
            if (options.length === 1) this.engine.setRecipe(machine.id, options[0][0]);
            else this.pendingRecipeIds = options.map(([id]) => id);
          }
          this.adapter.onChange?.();
          this.render();
        });
      }
    }
    getRecipeOptions(machine) {
      const ids = this.engine.machineDef(machine.kind)?.recipeIds || [];
      return ids.map(id => [id, this.engine.registry.machineRecipes[id]]).filter(([, recipe]) => !!recipe);
    }
    open(machineId) {
      const machine = this.engine.getMachine(machineId);
      if (!machine || !this.root) return;
      this.currentId = machineId;
      this.pendingRecipeIds = null;
      this.render();
      this.root.hidden = false;
    }
    close() { this.currentId = null; if (this.root) this.root.hidden = true; }
    render() {
      const snapshot = this.engine.getMachineSnapshot(this.currentId);
      const machine = this.engine.getMachine(this.currentId);
      if (!snapshot || !machine) { this.close(); return; }
      const registry = this.engine.registry;
      const itemName = id => registry.items[id]?.name || registry.fluids?.[id]?.name || id;
      const icon = id => {
        const fluid = registry.fluids?.[id];
        if (fluid) return `<span class="industry-fluid-indicator" style="--fluid-color:${fluid.color}" title="Process fluid">●</span>`;
        return window.FTSAssets?.itemIconHTML(id, 'industry-item-icon') || `<span class="industry-icon-fallback">${itemName(id)}</span>`;
      };
      const count = id => this.adapter.getItemCount?.(id) || 0;
      const recipeOptions = this.getRecipeOptions(machine);
      const isFurnace = machine.kind === 'furnace';
      const acceptedFurnace = ['stone','sand','ironOre','copperOre','zincOre','ironIngot','copperIngot','brassIngot'];
      const allOptions = isFurnace ? acceptedFurnace.map(input => {
        const process = ({stone:['sand',3],sand:['glassPane',5],ironOre:['ironIngot',4],copperOre:['copperIngot',4],zincOre:['zincIngot',4],ironIngot:['moltenIron',3],copperIngot:['moltenCopper',3],brassIngot:['moltenBrass',3]})[input];
        return [input, {name:itemName(process[0]), inputs:{[input]:1}, outputs:{[process[0]]:1}, seconds:process[1], furnaceInput:input}];
      }) : recipeOptions;
      const chosenRecipe = registry.machineRecipes[machine.recipeId] || null;
      const selectedInput = machine._uiInput || (chosenRecipe ? Object.keys(chosenRecipe.inputs || {})[0] : '');
      const matching = selectedInput ? allOptions.filter(([id, recipe]) => isFurnace ? id === selectedInput : Object.prototype.hasOwnProperty.call(recipe.inputs || {}, selectedInput)) : [];
      const selectedId = machine.recipeId;
      const resultButtons = matching.map(([id, recipe]) => {
        const output = Object.entries(recipe.outputs || {})[0] || [id,1];
        const active = (!isFurnace && id === selectedId) || (isFurnace && id === selectedInput) ? ' selected' : '';
        const unavailable = recipe.requiresCast && machine.castId !== recipe.requiresCast;
        return `<button type="button" class="stonecutter-recipe${active}" data-machine-recipe="${id}" title="${recipe.name}" aria-label="${recipe.name}" ${unavailable ? 'disabled' : ''}>${icon(output[0])}<b>×${output[1]}</b>${unavailable ? '<small>!' : ''}</button>`;
      }).join('');
      const needed = chosenRecipe && !isFurnace ? Object.entries(chosenRecipe.inputs || {}) : [];
      const inputButtons = needed.filter(([id]) => !registry.fluids?.[id]).map(([id, amount]) => {
        const have = machine.input[id] || 0;
        const missing = Math.max(0, amount - have);
        const insertAmount = Math.min(count(id), missing);
        return `<button class="industry-input-icon" data-action="insert" data-item="${id}" data-amount="${insertAmount}" title="Insert ${itemName(id)} · ${have}/${amount}" ${insertAmount <= 0 ? 'disabled' : ''}>${icon(id)}<b>${have}/${amount}</b></button>`;
      }).join('');
      const inputRows = Object.entries(machine.input).map(([id, amount]) => `<div class="industry-row">${icon(id)}<span>${itemName(id)}</span><b>${amount}×</b></div>`).join('') || '<div class="industry-muted">No items in input buffer.</div>';
      const outputRows = Object.entries(machine.output).map(([id, amount]) => {
        const fluid = !!registry.fluids?.[id];
        return `<div class="industry-row">${icon(id)}<span>${itemName(id)}${fluid ? '<small class="industry-fluid-note"> · TUNGSTEN FEED ONLY</small>' : ''}</span><b>${amount}×</b>${fluid ? '' : `<button class="industry-action small" data-action="take" data-item="${id}">Take</button>`}</div>`;
      }).join('') || '<div class="industry-muted">No finished products.</div>';
      let special = '';
      if (machine.kind === 'coilingDevice') special += `<div class="industry-progress"><div>Cranking: ${machine.crankCount}/36</div><div class="industry-meter"><i style="width:${machine.crankCount / 36 * 100}%"></i></div><button class="industry-action" data-action="crank">CRANK</button></div>`;
      if (machine.kind === 'mainsSupply') special += `<div class="industry-row"><span>Voltite connection</span><b>${machine.voltiteSource ? 'CONNECTED' : 'NO DEPOSIT'}</b></div><div class="industry-muted">Connect this Mains Supply to an Accumulator with Mains Cable.</div>`;
      if (machine.kind === 'accumulator') special += `<div class="industry-row"><span>Charge</span><b>${machine.charge.toFixed(0)}%</b></div><div class="industry-row"><span>Power</span><b>${machine.powered ? 'VOLTITE MAINS' : machine.batterySeconds > 0 ? 'BATTERY' : 'OFFLINE'}</b></div><div class="industry-row"><span>Water multiplier</span><b>×${machine.charge > 0 ? 10 : 1}</b></div><button class="industry-action" data-action="battery" ${count('battery') <= 0 ? 'disabled' : ''}>Insert Battery (${count('battery')})</button>`;
      if (machine.kind === 'waterwheel') special += `<div class="industry-row"><span>Water input</span><b>${machine.flow.toFixed(1)} L/s</b></div><div class="industry-row"><span>RPM</span><b>${machine.rpm.toFixed(1)}</b></div><div class="industry-row"><span>Force</span><b>${machine.force.toFixed(1)}</b></div><div class="industry-row"><span>Mechanical power</span><b>${machine.mechanicalPower.toFixed(2)} P/s</b></div>`;
      if (machine.kind === 'drill') special += `<div class="industry-row"><span>Mechanical input</span><b>${machine.mechanicalPower.toFixed(2)} P/s</b></div><div class="industry-row"><span>Mining progress</span><b>${((machine.powerBuffer || 0) / 50 * 100).toFixed(0)}%</b></div>`;
      if (machine.kind === 'castingMachine') special += `<div class="industry-row"><span>Installed cast</span><b>${machine.castId ? itemName(machine.castId) : 'No cast installed'}</b></div><div class="industry-row"><span>Tungsten feed</span><b>${this.engine.hasSafeMoltenFeed(machine.id) ? 'CONNECTED' : 'NOT CONNECTED'}</b></div><div class="industry-muted">Double-click while holding a Cast to swap its pattern. Connect a Tungsten Shaft from a Furnace.</div>`;
      const status = isFurnace ? 'AUTO-SMELT · READY' : machine.kind === 'castingMachine' ? (machine.castId && this.engine.hasSafeMoltenFeed(machine.id) ? 'CAST & TUNGSTEN FEED READY' : 'CAST OR TUNGSTEN FEED REQUIRED') : machine.kind === 'mainsSupply' ? (machine.voltiteSource ? 'VOLTITE MAINS SOURCE' : 'NO VOLTITE SUPPLY') : machine.kind === 'accumulator' ? (machine.charge > 0 ? 'POWERED · ×10 AVAILABLE' : 'CHARGING REQUIRED') : machine.kind === 'drill' ? (machine.mechanicalPower > 0 ? 'MECHANICAL POWER CONNECTED' : 'WAITING FOR SHAFT DRIVE') : 'READY';
      this.root.classList.toggle('inventory-drag-open', !!document.getElementById('inventory-screen')?.classList.contains('open'));
      const previousScroll = this.root.scrollTop;
      this.root.innerHTML = `
        <header class="industry-panel-header"><div><b>${snapshot.name.toUpperCase()}</b><small>${machine.id} · MACHINE STATUS</small></div><button class="close-button" data-action="close" aria-label="Close">×</button></header>
        <div class="industry-status">${status}</div>
        ${allOptions.length ? `<div class="industry-section-title">${isFurnace ? 'SMELTING OUTPUTS' : 'AVAILABLE OUTPUTS'}</div><div class="stonecutter-results industry-stonecutter-grid">${resultButtons || '<div class="industry-muted">Drop a compatible input to show outputs.</div>'}</div>` : ''}
        ${allOptions.length ? `<div class="industry-section-title">INPUT MATERIAL</div><div class="furnace-input-slot" data-machine-input tabindex="0"><span>${selectedInput ? icon(selectedInput) + ' ' + itemName(selectedInput) : 'Drop an ingredient here'}</span><b>DROP RESOURCE HERE</b></div>` : ''}
        ${inputButtons ? `<div class="industry-section-title">RECIPE INGREDIENTS · CLICK TO INSERT</div><div class="industry-stonecutter-inputs">${inputButtons}</div>` : ''}
        <div class="industry-section-title">INPUT BUFFER</div>${inputRows}
        <div class="industry-section-title">OUTPUT BUFFER</div>${outputRows}
        ${snapshot.collectibleOutputCount > 0 ? `<button class="industry-action" data-action="take-all">COLLECT ALL OUTPUT · ${snapshot.collectibleOutputCount}</button>` : ''}
        ${special}
        <div class="industry-progress"><div>Production progress</div><div class="industry-meter"><i style="width:${Math.max(0, Math.min(100, snapshot.progressPercent * 100))}%"></i></div></div>
        <footer class="industry-footer"><button class="industry-action danger" data-action="remove">Pick up machine</button><span>Machine UI appears only when inspected.</span></footer>`;
      this.root.scrollTop = previousScroll;
    }
    handleClick(event) {
      const recipeButton = event.target.closest('[data-machine-recipe]');
      if (recipeButton) {
        const machine = this.engine.getMachine(this.currentId);
        if (!machine) return;
        const id = recipeButton.dataset.machineRecipe;
        if (machine.kind !== 'furnace') this.engine.setRecipe(machine.id, id);
        else machine._uiInput = id;
        this.adapter.onChange?.(); this.render(); return;
      }
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = button.dataset.action, id = button.dataset.item;
      const machine = this.engine.getMachine(this.currentId);
      let result = true;
      if (action === 'close') { this.close(); return; }
      if (!machine) return;
      if (action === 'insert') result = this.engine.insert(machine.id, id, Number(button.dataset.amount || 1));
      if (action === 'take') {
        const amount = this.engine.take(machine.id, id); result = amount > 0;
        if (result) this.adapter.onToast?.(`Collected ${amount} ${this.engine.registry.items[id]?.name || id}.`);
      }
      if (action === 'take-all') {
        const collected = this.engine.collectAllOutput(machine.id); result = collected.total > 0;
        if (result) this.adapter.onToast?.(`Collected ${Object.entries(collected.items).map(([itemId, amount]) => `${amount} ${this.engine.registry.items[itemId]?.name || itemId}`).join(', ')}.${collected.blocked ? ' Inventory full; some items remain.' : ''}`);
      }
      if (action === 'crank') { const r = this.engine.crank(machine.id, 1); result = r.ok; if (r.ok && !r.complete) this.adapter.onToast?.(`Coiling: ${Math.round(r.progress * 100)}%`); }
      if (action === 'battery') result = this.engine.insertBattery(machine.id).ok;
      if (action === 'remove') { this.engine.removeMachine(machine.id); this.close(); this.adapter.onToast?.('Machine returned to inventory.'); return; }
      if (!result) this.adapter.onToast?.('That action is not available. Check the machine inputs and your inventory.');
      this.adapter.onChange?.(); this.render();
    }
    handleChange() {}
  }
  window.FTSIndustryUI = IndustryUI;
})();
