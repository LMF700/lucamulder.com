# Fill The Sea — Industry Engine Prototype (v1.8)

This is the current FTS prototype foundation (v1.7), combining the expansive procedural world and exploration systems with an asset-independent industrial simulation. It is a static HTML/CSS/JavaScript project. There is no build step, package installation, server-side code, database, or external API.

## Run it

For local testing, open the folder with VS Code and use the Live Server extension, or run a basic static file server from this folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. GitHub Pages can host the same files directly. Upload the **contents** of this folder to the repository root (not the enclosing ZIP directory).

The game uses fallbacks for missing art. You can run and test the systems before all sprites are ready.

## What's included

- Procedural 48,000 × 28,000 world with 25 broad, flat-topped elevation shelves, substantial brown cliff faces, jumpable ledges and no ramps, plus one large Empty Sea on the middle elevation shelf, close to spawn, and many resource deposits. The renderer draws the entire visible viewport and shades every ground surface from the full-world elevation range.
- Player movement, jumping, exploration, mining/woodcutting tools, shelters, uncommon storms, and optional resource highlighting. The Compass is not part of the starting loadout; its North-pointing behaviour is deferred until after v2.0.
- Coordinate convention: **X = screen-horizontal, Y = screen-vertical (height), Z = depth**. Changing Y moves strictly vertically on screen. Z adds a small oblique offset for perspective. A/D moves screen-left/right; W/S moves screen-up/down across the projected ground plane, with projection compensation so neither direction drifts diagonally.
- Exactly 36 inventory slots: nine HOTBAR slots first, followed by 27 backpack slots. Drag-and-drop or click-to-move/swap works between any hotbar and backpack slots. A consumed stack clears its slot completely, and the mouse wheel cycles the hotbar.
- Item, machine, and recipe registries kept outside the simulation.
- Machine placement and inspection; configurable machine recipes; input/output buffers; manual machine cranking; pickup/removal.
- Automatic, self-powered conveyor belts that transfer items between nearby machine outputs and inputs.
- Mechanical shaft networks and waterwheel-driven drills.
- Electrical connections from Voltite-fed Mains Supplies to Accumulators, including battery charging and the Accumulator's ×10 channel multiplier.
- Dedicated Tungsten Shaft molten-metal feed lines from Furnaces to Casting Machines. They are separate from mechanical drive shafts.
- Casting recipes, removable casts, molten-metal hazard handling, and machine failure callbacks.
- A pixel-art asset loader with nearest-neighbour rendering and fallbacks when artwork is missing.



## v1.8 deposit mining and machine collection

- The Stone Pickaxe can hand-mine every mineral deposit: Stone, Iron, Copper, Zinc, Silicon, Clay and Voltite. The yield is 4 Stone, 2 units of other minerals, or 1 Voltite per swing. Mining checks inventory capacity before consuming deposit stock. Trees remain the Stone Axe's job.
- Drills can be placed on any mineable mineral deposit, snap to its centre, and produce that deposit's corresponding raw resource. Drills still require a Waterwheel/shaft mechanical power network and retain the existing `1 resource per 50 accumulated Power` rule.
- A placed Drill reserves its deposit while installed. Picking up the Drill releases the deposit; manually depleted deposits stop their attached Drill.
- Left-click a placed machine to collect all collectible output buffers at once. If the inventory has limited free capacity, the machine transfers what fits and retains the remainder. Process fluids such as molten metal are not collectible and stay in the machine buffer for Tungsten Shaft transport.
- Machines with collectible output display a small `+ count · CLICK` indicator. The machine inspector also has a Collect All action. If a machine has no output, clicking it in select/remote mode opens its normal inspector.

## v1.7 inventory and movement QoL

- Recipe definitions are intentionally left as-is in this build so they can be rebalanced separately after the interface changes.

- Inventory is exactly 36 slots: the nine-slot HOTBAR is shown first, followed by 27 backpack slots. The Stone Pickaxe and Stone Axe start in hotbar slots 1 and 2.
- Drag a stack between any two hotbar/backpack slots to move it or swap it with the destination. You can also click one occupied slot and then another slot to move/swap. Right-clicking a hotbar slot moves its item back into the backpack.
- When an item stack reaches zero, its references are cleared from slots; its icon and name disappear so no empty stack remains visible.
- A/D moves strictly left/right on screen. W/S moves along the other screen-aligned direction on the projected ground plane, with the world-to-screen transform compensated so it does not drift diagonally. Diagonal movement is normalized.
- Molten iron, brass and copper are now internal process-fluid IDs. They are not items, cannot be picked up or manually inserted, have no artwork requirements, and can only travel through Tungsten Shaft feed connections. Machine buffers still show their fluid quantities.

## v1.0 terrain and movement update

- The Empty Sea is generated just beyond the shoreline from spawn, on the same shelf. In v1.5, both move to the middle elevation tier.
- The first shelf is 3,600 world units wide; the middle Sea shelf is 3,200 world units wide. Other shelves remain broad and procedurally varied.
- Grass surfaces are much flatter, with reduced noise and taller brown cliff faces between elevation shelves.
- Generated ramps have been removed entirely. Walk off a ledge to fall; jump to climb a higher shelf. Jump height was increased to make one-shelf climbs possible.


## v1.1 terrain shading and free channel endpoints

- Grass and exposed soil now shade progressively brighter with elevation. Lower shelves are darker; upper shelves retain the vivid reference green.
- Channel construction no longer requires clicking a yellow helper dot. Click or drag from any valid terrain position to another position to create a free endpoint.
- Existing yellow dots, source bodies, the Empty Sea footprint, and existing channel segments remain snap targets for convenient connections.
- Free endpoints become reusable junctions, so later channel segments can branch from them. Preview costs are calculated from world-space distance.

## v1.2 resource hitbox alignment (history)

- Resource interaction bounds now use the same projection, image aspect-ratio calculation, scaling and bottom-centre sprite anchor as the renderer. This fixes the common offset where the old click target was at the PNG bottom anchor while the visible sprite occupied pixels above it.
- Stone, iron, special mineral deposits, trees and water sources now use bounds matched to their displayed sprite or fallback vector shape.
- Overlapping resources are resolved by normalized distance to their visible bounds; depleted and off-camera deposits cannot be selected.
- Press **F3** to display the clickable bounds in-world while debugging.

## v1.1 layer shading and channel endpoints (history)

- Grass and exposed soil shade progressively brighter with elevation. Lower shelves are darker, while the highest shelves retain the vivid green from the visual references.
- Channel endpoints can be placed anywhere on valid terrain: click once to set a start, then click elsewhere, or drag from the start to the destination.
- Yellow dots are optional snapping helpers. Clicking an existing node, an existing channel, a water source body, or the Empty Sea footprint still connects to that object.
- Free endpoints become reusable junctions, allowing later channel runs to branch from them. The placement preview calculates item cost using world-space distance.

## Controls

| Input | Action |
|---|---|
| A / D or ← / → | Move horizontally along world X (screen X) |
| W / S or ↑ / ↓ | Move screen-up/down across the projected ground plane, with the oblique Z offset cancelled |
| Space | Jump up one elevation shelf; walking off a ledge drops you down |
| Tab | Open/close inventory |
| Drag between any hotbar/backpack slots | Move or swap the slot contents |
| Click one slot, then another | Move or swap the slot contents |
| Right-click a hotbar slot in inventory | Move it back to the backpack |
| Mouse wheel | Cycle available hotbar items |
| 1–9 | Select a hotbar slot |
| Click a Craft button | Craft the selected inventory recipe when materials and a free slot are available; the open category and scroll position are preserved |
| Channel construction: click/drag from any terrain point to any other point | Place endpoints freely; yellow dots are optional snap helpers |
| E | Crouch/stand beneath a completed shelter |
| H or Highlight Resources button | Toggle resource highlights for visible deposits |
| R | Rotate a selected conveyor belt; otherwise generate a new world |
| Esc | Cancel the current build/link action |

When the inventory is open, the player is paused. Machines and the world simulation continue when the inventory is closed.

## Industrial use

### Place and configure machines

Craft a machine through the inventory, move it to a hotbar slot, select it, and click the terrain to place it. Click a placed machine to inspect it. The inspector lets you choose a recipe, insert items from the backpack, crank the Coiling Device, insert Accumulator batteries, collect output, and remove the machine. With no active build/link tool selected, left-clicking a machine directly collects all of its collectible output; click again in select mode to open its inspector.

Machines run when their selected recipe has all required inputs and output space. Products stay in the output buffer until collected or extracted by a conveyor belt.

### Conveyor belts

Conveyor Belts are self-powered. Select a belt and click to place it; press `R` to rotate its direction in 90-degree steps. Place the input end against a machine with output and point the belt away from that machine. A belt can hand an item to a following belt or to a machine at its output end. Belts move one item at a time.

The prototype uses proximity-based belt connections rather than a full belt-routing editor. Align the belt segments and machine ports carefully.

### Waterwheel and Drill

Place a Waterwheel over a flowing channel. Place a Drill on any mineral deposit. Select ordinary Shafts and click the Waterwheel, then the Drill, to connect their mechanical network.

For a water flow `F` in L/s, the current prototype uses:

- RPM = `F / 4`
- Force = `F / 2`
- Power/s = `(RPM × Force) / 6`
- One unit of ore is mined per 50 accumulated Power.

The Waterwheel's current assumed maximum flow is 180 L/s. This is an editable balance value in `data/registry.js`.

### Electrical supply and Accumulator

Place a Mains Supply beside a Voltite deposit. Craft Mains Cable, select it, and click the Mains Supply followed by an Accumulator placed over a channel. The powered Accumulator charges and applies a ×10 water multiplier while it has charge. It can also be charged by inserting Batteries through its inspector.

### Molten-metal casting (internal process fluids)

Place a Furnace and a Casting Machine. Select a Tungsten Shaft, click the Furnace first, and then the Casting Machine. This creates a dedicated molten-metal feed line. It is **not** a mechanical power shaft. Select the appropriate Cast and double-click the Casting Machine while holding it to install/swap the pattern. Molten metals are internal machine fluids, not collectible items: they have no inventory slots or item icons, cannot be manually inserted or collected, and move only through the dedicated Tungsten Shaft line. Unsafe fluid handling still triggers the casting hazard callback.

## Recipes and editable assumptions

The recipes explicitly supplied in the game design are represented directly in `data/registry.js`:

- Drill: 1 Drill Bit + 6 Polished Stone + 1 Shaft.
- Conveyor Belt: 1 Belt + 1 Conveyor Chassis.
- Casting Machine: 2 Brass Plate + 4 Iron Plate.
- Coiling Device: 2 Brass Ingots + 1 Shaft.
- Brass Kiln: 1 Blast Burner + 4 Kiln Parts.
- Flattener: 1 Iron Flattener + 2 Iron Ingots + 1 Shaft.
- Condenser: 1 Condenser Frame + 5 Glass.
- Belt: 1 Rubber in a Flattener.
- Rubber: 5 Tree Sap in a Condenser.
- Shaft: 2 Stone in the inventory.
- Condenser Frame: 6 Iron in a Flattener.
- Kiln Part: 2 Iron in a Flattener.
- Glass: 1 Sand in a Furnace.
- Iron Plate: 1 Iron in a Flattener.
- Brass Plate: 1 Brass in a Flattener.
- Sand: 1 Stone in a Furnace.
- Blast Burner: 1 Furnace + 1 Blasting Frame + 1 Smokestack.

Transistors are **not** a player hand-crafting recipe. The prototype includes a Transistor Fabricator machine; the Board Assembly Device consumes a Blank Board, 24 Transistors, and 2 Glass to make a Logic Board. The Board Assembly Device supports normal inventory insertion and automatic conveyor input.

Some recipe details and costs were not specified in the design notes, so the current registry includes clearly editable prototype assumptions for those parts. Examples include the Waterwheel build cost and maximum flow, Drill Bit recipe, Transistor Fabricator input recipe, Blank Board recipe, Transformer casting recipe, Conveyor Chassis recipe, process durations, and several utility machine recipes. Change these in `data/registry.js`, not in the engine. The Coiling Device requires 36 crank actions per Copper Coil in this prototype.

## Artwork: exact paths and dimensions

The authoritative list of image files expected by the current item/world registry is:

**`assets/asset-manifest.json`**

It contains every exact path (93 unique PNGs), the roles that use each file, and size notes. Molten iron, brass and copper are internal process fluids, so they deliberately have no image files. The folders are included in this project with `.gitkeep` files so you can copy artwork into the correct locations.

Important sizing rules:

- Item and tool icons: **32×32 PNG**. The inventory displays them at 32×32.
- Machine sprites: **variable dimensions**. Use the size you want that machine to occupy in the world. The renderer uses the PNG's native width and height by default. Set `worldScale` in that machine's definition in `data/registry.js` only if you intentionally want it scaled.
- Terrain/resource/character/effect sprites: use their natural proportions; world objects are scaled to the display sizes called by the renderer.
- Transparent PNG backgrounds are preferred.
- Pixel art is drawn with nearest-neighbour sampling (`imageSmoothingEnabled = false`).

No asset is required for the project to start. Missing images fall back to built-in glyphs and vector shapes. When your art is ready, put it at the manifest path; no JS changes are needed for an existing registered image.

## Project files

- `index.html` — page structure and script loading order.
- `style.css` — Verdana UI, black/white panels, inventory, inspector, responsive layout.
- `game.js` — world generation, player, terrain renderer, resources, water network, weather, shelters, tools, inventory, crafting, screen projection, and input handling.
- `data/registry.js` — item, machine, and recipe definitions; edit this to add or rebalance content.
- `systems/industry-engine.js` — machine simulation, buffers, conveyor transport, mechanical networks, electrical networks, molten-metal feed, and rendering hooks.
- `systems/industry-ui.js` — contextual machine inspector; no permanent factory dashboard.
- `systems/asset-loader.js` — PNG loader, cache, fallback icons, and pixel-art-safe rendering support.
- `assets/asset-manifest.json` — exact artwork file paths and sizing guidance.
- `tests/industry-smoke.test.js` — Node-based smoke tests for industrial systems.
- `tests/resource-hitbox-regression.test.js` — regression checks for rendered resource bounds and pointer hit testing.

## Tests

Run the logic smoke tests from the project folder with:

```bash
for test in tests/*.test.js; do node "$test"; done
```

The test suites cover project assets/registries, movement and world generation, layer shading and free channel endpoints, resource hitbox geometry, high-contrast global elevation colours, starter inventory, storm rarity, resource highlighting, 36-slot hotbar/backpack transfers, exhausted-slot cleanup, waterwheel/drill power, machine processing, manual coiling, Accumulator charging, casting safety, Transistor/Logic Board production, conveyor transfer, and internal Tungsten Shaft process-fluid transfer.

## Prototype boundaries

- Water flow and resource logistics are simplified logical simulations, not fluid or factory physics simulations.
- Conveyor routing is proximity-based and moves one item at a time.
- Machine placement is currently click-to-place and uses machine-specific world dimensions; there is no tile-grid factory editor.
- Production balances marked as assumptions are intended to be changed after playtesting.
- Visual browser playtesting has not been completed in this environment; use the local test server above to check final layout and art integration.


## v1.3 screen-wide height handling and resource picking

- Elevation shelves now have a soft, green colour transition band between low and high levels (160 world units wide). The band extends across the full depth of each shelf boundary and is rendered anywhere it is visible on screen.
- The transition is visual only. Actual terrain height remains stepped, so this does not introduce walkable ramps; players still jump up or fall down between levels.
- Resource hit-testing now checks projected screen-space sprite bounds across the full world resource lists. It no longer rejects a resource just because it is outside a camera/player-centred interaction radius.
- Each resource's clickable screen rectangle is calculated using its own local terrain height and the same world-to-screen projection used to draw it. Player proximity is still checked separately when actually mining or chopping, so this does not allow remote harvesting.
- Removed the F3 resource-hitbox outline overlay entirely. No debug outlines are drawn.


## v1.4 global world-height gradient

- Removed the previous grass shading that interpolated by horizontal X shelf index. Grass now derives its colour from the actual world-space Y elevation, using one global minimum-to-maximum height range for the entire generated world.
- The gradient is camera-independent and player-independent: all terrain points at the same world Y receive the same green shade, including visible terrain far from the player. The low and high endpoints match the supplied swatch (dark green at low Y, bright green at high Y).
- The terrain remains sharply stepped. Colour changes are visual only and do not alter collision, height, cliff geometry, or movement.
- Adjacent terrain surface quads overlap their own fill colour by a thin antialiased edge, eliminating the fine bright seams that made the rendered surface look like a grid. No grid or debug outlines are drawn.


## v1.5 full-world terrain colour and middle-elevation basin

- The terrain colour ramp is calculated from the minimum and maximum elevations across **all 25 generated layers**, with a small allowance for procedural surface variation. It is independent of the player and camera. Every rendered terrain cell samples the same global world-Y gradient.
- The Empty Sea is centred on layer 12, the true middle tier of the 25-layer world. Its shelf is deliberately wider (3,200 world units) so the large basin fits without crossing into adjacent elevation shelves.
- The player spawns on the same middle elevation shelf, just outside the Empty Sea shoreline, so the basin remains close to the starting area while still anchoring the world's middle elevation.
- Terrain mesh sampling now derives its X/Z bounds from the full canvas dimensions and the world projection. This draws ground across the visible screen instead of rendering only a compact patch around the player.


## v1.5 full-world terrain colour and middle-elevation basin

- The terrain colour ramp is calculated from the minimum and maximum elevations across **all 25 generated layers**, with a small allowance for procedural surface variation. It is independent of the player and camera. Every rendered terrain cell samples the same global world-Y gradient.
- The Empty Sea is centred on layer 12, the true middle tier of the 25-layer world. Its shelf is deliberately wider (3,200 world units) so the large basin fits without crossing into adjacent elevation shelves.
- The player spawns on the same middle elevation shelf, just outside the Empty Sea shoreline, so the basin remains close to the starting area while anchoring the world's middle elevation.
- Terrain mesh sampling now derives its X/Z bounds from the full canvas dimensions and the world projection. This draws ground across the visible screen instead of rendering only a compact patch around the player.


## v1.6 quality-of-life update

- Terrain elevation colouring has a stronger, Chromebook-visible contrast: deep green at the lowest world heights, a saturated green at the middle, and vivid lime green at the highest. The colour remains a single global world-Y gradient independent of player and camera position.
- Storms are uncommon. The first weather check happens after 10–15 minutes of clear weather; each check has a 22% chance to begin a storm warning. Failed checks add another 6–12 minutes of clear weather. Storms last 24–36 seconds, followed by 10–16 minutes of clear weather.
- Added a Resource Highlight toggle using **H** or the top-right Highlight Resources button. Active stone, iron, copper, zinc, silicon, clay, Voltite, trees and water sources visible in the current view receive a coloured ground marker and readable label. This is a navigation aid, not a hitbox/debug outline.
- A new world starts with exactly one Stone Pickaxe and one Stone Axe. The nine-slot hotbar is the first section of the 36-slot inventory. It starts with the Stone Pickaxe and Stone Axe in slots 1 and 2; the remaining seven hotbar slots and all 27 backpack slots are empty. All materials, channel stocks, chutes, modules, machines and other devices start at zero.
- The Compass is not included in the starting loadout. A compass that points North is explicitly deferred to a post-v2.0 update; no North compass behaviour is implemented in this version.


## v1.8.4 — Stonecutter-style crafting

- Removed the collapsible recipe accordion menus from the inventory crafting panel.
- Drag a material from the inventory into the crafting input slot.
- The output list filters to recipes that use that material.
- Select an output to see its required materials and craft it when requirements are met.
- The selected input and output remain selected across inventory refreshes.
- Furnace drag-to-input and automatic smelting remain separate machine interactions.


### v1.8.4 Stonecutter icon interface
- Removed accordion-based recipe navigation from the crafting screen.
- Dropping an input material filters the available outputs into a compact icon grid.
- Output choices are icon-only buttons with hover titles, accessible labels, quantity badges, and a missing-material indicator.


## v1.8.5 — Machine-wide Stonecutter interface
- Restored the original inventory crafting layout and recipe groups from v1.8.3. Hand crafting and machine construction remain unchanged.
- Removed recipe dropdowns from recipe-driven machine inspectors. Machines now show output choices as icon buttons.
- Drag an ingredient from inventory into the machine input slot to filter compatible outputs and select a matching recipe. Additional ingredients can be inserted using compact icon buttons.
- Furnace remains automatic: dragging a supported raw material into its input starts the matching smelting process.
- Non-processing utility machines retain their status controls and telemetry.


## v1.8.6 — Inventory and machine interaction QoL
- Inventory slots now track individual stack quantities, with a maximum stack size of 64.
- Newly acquired items fill hotbar stacks and empty hotbar slots before the backpack.
- Clicking a populated slot picks up its full stack; clicking an empty slot moves it there. Clicking another populated slot swaps stacks.
- Dragging a stack to one slot moves/merges it; dragging across multiple compatible slots distributes the stack as evenly as possible, respecting the 64-item stack limit.
- Right-clicking a compatible machine while holding a matching hotbar item inserts one unit. Accumulator batteries and Casting Machine casts use their dedicated insertion actions.
- Inventory crafting and the machine Stonecutter interfaces are unchanged.
