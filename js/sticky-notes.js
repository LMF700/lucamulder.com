/* TwoNote Sticky Notes add-on.
   Integrates with the existing notes array/currentNote in notes.js through
   the small custom events documented in notes-sticky-integration.txt. */
(() => {
    "use strict";

    const STORAGE_KEY = "twonoteStickyNotes";
    const COLORS = [
        { name: "Yellow", value: "#F5D76E" },
        { name: "Pink", value: "#F1A9C8" },
        { name: "Green", value: "#A8D5A2" },
        { name: "Blue", value: "#9CCFF0" },
        { name: "Purple", value: "#C2A8EA" },
        { name: "Orange", value: "#F5B779" },
        { name: "White", value: "#F0F0E8" }
    ];

    const editorContainer = document.getElementById("editorContainer");
    const addButton = document.getElementById("addStickyNote");
    if (!editorContainer || !addButton) return;

    let activeNoteId = null;
    let placing = false;
    let stickyData = loadAll();
    let dragState = null;
    let resizeObserver = null;

    const layer = document.createElement("div");
    layer.id = "stickyLayer";
    layer.setAttribute("aria-label", "Sticky notes workspace");
    editorContainer.appendChild(layer);

    const placementStatus = document.createElement("div");
    placementStatus.id = "stickyPlacementStatus";
    placementStatus.textContent = "Click to place a subnote, cancel with Esc";
    placementStatus.hidden = true;
    editorContainer.appendChild(placementStatus);

    function loadAll() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        } catch {
            return {};
        }
    }

    function saveAll() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stickyData));
    }

    function getNotesForActive() {
        if (activeNoteId == null) return [];
        if (!Array.isArray(stickyData[activeNoteId])) stickyData[activeNoteId] = [];
        return stickyData[activeNoteId];
    }

    function persistNote(note) {
        saveAll();
        // Keep the main note's data in sync too, if the existing app has exposed it.
        document.dispatchEvent(new CustomEvent("twonote:stickies-changed", {
            detail: { noteId: activeNoteId, stickyNotes: getNotesForActive() }
        }));
    }

    function makeId() {
        return "sticky-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    }

    function setPlacementMode(enabled) {
        placing = enabled;
        editorContainer.classList.toggle("sticky-placement-mode", placing);
        placementStatus.hidden = !placing;
        addButton.setAttribute("aria-pressed", String(placing));
        addButton.textContent = placing ? "Cancel placement" : "＋ Sticky Note";
    }

    function selectMainNote(noteId) {
        activeNoteId = noteId == null ? null : String(noteId);
        setPlacementMode(false);
        render();
    }

    function render() {
        layer.replaceChildren();
        if (resizeObserver) resizeObserver.disconnect();
        resizeObserver = "ResizeObserver" in window
            ? new ResizeObserver(entries => {
                for (const entry of entries) {
                    const id = entry.target.dataset.stickyId;
                    const item = getNotesForActive().find(n => n.id === id);
                    if (!item || item.collapsed) continue;
                    const rect = entry.target.getBoundingClientRect();
                    const parentRect = layer.getBoundingClientRect();
                    item.width = Math.max(170, Math.round(rect.width));
                    item.height = Math.max(100, Math.round(rect.height));
                    item.x = Math.max(0, Math.round(rect.left - parentRect.left));
                    item.y = Math.max(0, Math.round(rect.top - parentRect.top));
                    saveAll();
                }
            })
            : null;

        for (const item of getNotesForActive()) {
            const card = document.createElement("section");
            card.className = "sticky-note" + (item.collapsed ? " is-collapsed" : "");
            card.dataset.stickyId = item.id;
            card.style.setProperty("--sticky-color", item.color || COLORS[0].value);
            card.style.left = `${Math.max(0, Number(item.x) || 24)}px`;
            card.style.top = `${Math.max(0, Number(item.y) || 24)}px`;
            if (!item.collapsed) {
                card.style.width = `${Math.max(170, Number(item.width) || 240)}px`;
                card.style.height = `${Math.max(120, Number(item.height) || 190)}px`;
            }

            const header = document.createElement("div");
            header.className = "sticky-header";

            const grip = document.createElement("button");
            grip.type = "button";
            grip.className = "sticky-grip";
            grip.title = "Move sticky note";
            grip.setAttribute("aria-label", "Move sticky note");
            grip.textContent = "⠿";
            grip.addEventListener("pointerdown", event => beginDrag(event, item, card));

            const heading = document.createElement("input");
            heading.className = "sticky-title";
            heading.type = "text";
            heading.placeholder = "Sticky Note";
            heading.value = item.title || "";
            heading.setAttribute("aria-label", "Sticky note title");
            heading.addEventListener("input", () => {
                item.title = heading.value;
                saveAll();
            });

            const colorButton = document.createElement("button");
            colorButton.type = "button";
            colorButton.className = "sticky-tool";
            colorButton.textContent = "●";
            colorButton.title = "Change color";
            colorButton.setAttribute("aria-label", "Change sticky note color");
            colorButton.style.color = item.color || COLORS[0].value;
            colorButton.addEventListener("click", () => openPalette(card, item));

            const collapseButton = document.createElement("button");
            collapseButton.type = "button";
            collapseButton.className = "sticky-tool";
            collapseButton.textContent = item.collapsed ? "□" : "−";
            collapseButton.title = item.collapsed ? "Expand note" : "Collapse note";
            collapseButton.setAttribute("aria-label", collapseButton.title);
            collapseButton.addEventListener("click", () => {
                item.collapsed = !item.collapsed;
                persistNote(item);
                render();
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "sticky-tool sticky-delete";
            deleteButton.textContent = "×";
            deleteButton.title = "Delete sticky note";
            deleteButton.setAttribute("aria-label", "Delete sticky note");
            deleteButton.addEventListener("click", () => {
                stickyData[activeNoteId] = getNotesForActive().filter(n => n.id !== item.id);
                saveAll();
                render();
            });

            header.append(grip, heading, colorButton, collapseButton, deleteButton);
            card.appendChild(header);

            if (!item.collapsed) {
                const content = document.createElement("textarea");
                content.className = "sticky-content";
                content.placeholder = "Write anything here...";
                content.value = item.content || "";
                content.setAttribute("aria-label", "Sticky note content");
                content.addEventListener("input", () => {
                    item.content = content.value;
                    saveAll();
                });
                card.appendChild(content);
                if (resizeObserver) resizeObserver.observe(card);
            } else {
                const preview = document.createElement("button");
                preview.type = "button";
                preview.className = "sticky-collapsed-preview";
                preview.textContent = (item.title || item.content || "Sticky Note").slice(0, 48);
                preview.title = "Expand sticky note";
                preview.addEventListener("click", () => {
                    item.collapsed = false;
                    persistNote(item);
                    render();
                });
                card.appendChild(preview);
            }

            // Keep clicks and pointer activity on a card from triggering placement.
            card.addEventListener("click", event => event.stopPropagation());
            layer.appendChild(card);
        }
    }

    function openPalette(card, item) {
        const old = card.querySelector(".sticky-palette");
        if (old) {
            old.remove();
            return;
        }
        const palette = document.createElement("div");
        palette.className = "sticky-palette";
        palette.setAttribute("role", "group");
        palette.setAttribute("aria-label", "Sticky note colors");
        for (const color of COLORS) {
            const swatch = document.createElement("button");
            swatch.type = "button";
            swatch.className = "sticky-color-swatch";
            swatch.style.backgroundColor = color.value;
            swatch.title = color.name;
            swatch.setAttribute("aria-label", color.name);
            swatch.setAttribute("aria-pressed", String((item.color || COLORS[0].value) === color.value));
            swatch.addEventListener("click", event => {
                event.stopPropagation();
                item.color = color.value;
                persistNote(item);
                render();
            });
            palette.appendChild(swatch);
        }
        card.appendChild(palette);
    }

    function beginDrag(event, item, card) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const layerRect = layer.getBoundingClientRect();
        dragState = {
            item, card,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            x: Number(item.x) || 24,
            y: Number(item.y) || 24,
            layerRect
        };
        card.classList.add("is-moving");
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    document.addEventListener("pointermove", event => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        const { item, card, startX, startY, x, y, layerRect } = dragState;
        item.x = Math.max(0, Math.round(x + event.clientX - startX));
        item.y = Math.max(0, Math.round(y + event.clientY - startY));
        item.x = Math.min(item.x, Math.max(0, layerRect.width - 80));
        item.y = Math.min(item.y, Math.max(0, layerRect.height - 45));
        card.style.left = `${item.x}px`;
        card.style.top = `${item.y}px`;
    });

    document.addEventListener("pointerup", event => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        dragState.card.classList.remove("is-moving");
        saveAll();
        dragState = null;
    });

    addButton.addEventListener("click", () => setPlacementMode(!placing));

    editorContainer.addEventListener("click", event => {
        if (!placing || activeNoteId == null) return;
        if (event.target.closest(".sticky-note") || event.target === addButton) return;
        const rect = layer.getBoundingClientRect();
        const item = {
            id: makeId(),
            title: "",
            content: "",
            color: COLORS[0].value,
            x: Math.max(8, Math.round(event.clientX - rect.left - 120)),
            y: Math.max(8, Math.round(event.clientY - rect.top - 80)),
            width: 240,
            height: 190,
            collapsed: false
        };
        getNotesForActive().push(item);
        persistNote(item);
        setPlacementMode(false);
        render();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && placing) setPlacementMode(false);
    });

    // Existing notes.js dispatches this whenever a note is selected or created.
    document.addEventListener("twonote:select", event => {
        selectMainNote(event.detail?.noteId);
    });
    document.addEventListener("twonote:clear", () => selectMainNote(null));

    // If a note is already selected when this add-on initializes.
    document.addEventListener("DOMContentLoaded", () => {
        if (activeNoteId == null) render();
    });
})();
