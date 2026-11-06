/* BiNote Sprawl module. Load after notes.js and before sticky-notes.js. */
(() => {
    "use strict";

    const SPRAWLERS_KEY = "twonoteSprawlers";
    const ICONS = {
        note: "../assets/noteicons/normal.png",
        sprawler: "../assets/noteicons/sprawler.png",
        folder: "../assets/noteicons/nfolder.png",
        shelf: "../assets/noteicons/sfolder.png",
        landing: "../assets/landing.png"
    };

    let sprawlers = loadSprawlers();
    let activeShelfId = null;
    let activeShelfItem = null;
    let activeSprawlerId = null;
    let menuNoteId = null;
    let menuShelfId = null;
    let selectedCell = null;

    function loadSprawlers() {
        try {
            const value = JSON.parse(localStorage.getItem(SPRAWLERS_KEY) || "[]");
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    }

    function saveSprawlers() {
        localStorage.setItem(SPRAWLERS_KEY, JSON.stringify(sprawlers));
    }

    function id(prefix) {
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function getSprawler(sprawlerId) {
        return sprawlers.find(item => String(item.id) === String(sprawlerId)) || null;
    }

    function isShelf(folder) {
        return folder && folder.type === "sprawlshelf";
    }

    function icon(src, alt) {
        const image = document.createElement("img");
        image.src = src;
        image.alt = alt;
        image.className = "sprawl-icon";
        image.onerror = () => { image.hidden = true; };
        return image;
    }

    function saveAll() {
        saveNotes();
        saveFolders();
        saveSprawlers();
    }

    // Creation menu replaces the old one-click New Note action.
    const newButton = document.getElementById("new");
    const createMenu = document.createElement("div");
    createMenu.id = "sprawlCreateMenu";
    createMenu.hidden = true;
    createMenu.innerHTML = `
        <button type="button" data-create="text">Text note</button>
        <button type="button" data-create="sprawler">Sprawler</button>
        <button type="button" data-create="shelf">Sprawlshelf</button>
    `;
    document.body.appendChild(createMenu);

    function closeCreateMenu() { createMenu.hidden = true; }
    newButton.onclick = null;
    newButton.textContent = "＋ New";
    newButton.addEventListener("click", event => {
        event.stopPropagation();
        const rect = newButton.getBoundingClientRect();
        createMenu.style.left = `${Math.max(8, rect.left)}px`;
        createMenu.style.top = `${Math.min(window.innerHeight - 150, rect.bottom + 5)}px`;
        createMenu.hidden = !createMenu.hidden;
    });

    createMenu.addEventListener("click", event => {
        const button = event.target.closest("button[data-create]");
        if (!button) return;
        const type = button.dataset.create;
        closeCreateMenu();
        if (type === "text") createNote(selectedFolderId);
        if (type === "sprawler") createSprawler(selectedFolderId);
        if (type === "shelf") createShelf(selectedFolderId);
    });

    document.addEventListener("click", event => {
        if (!createMenu.contains(event.target) && event.target !== newButton) closeCreateMenu();
    });

    function createShelf(parentId = selectedFolderId) {
        const shelf = {
            id: id("shelf"),
            name: "New Sprawlshelf",
            type: "sprawlshelf",
            parentId: parentId == null ? null : String(parentId),
            landingNoteId: null
        };
        folders.push(shelf);
        if (shelf.parentId != null) expandedFolders.add(shelf.parentId);
        expandedFolders.add(String(shelf.id));
        selectedFolderId = String(shelf.id);
        saveFolders();
        window.__sprawlRenamingShelf = String(shelf.id);
        renderSidebar();
        beginShelfRename(shelf);
    }

    function createSprawler(folderId = selectedFolderId) {
        const item = {
            id: id("sprawler"),
            type: "sprawler",
            title: "Untitled Sprawler",
            folderId: folderId == null ? null : String(folderId),
            rows: 20,
            cols: 10,
            cells: {}
        };
        sprawlers.push(item);
        if (item.folderId != null) expandedFolders.add(item.folderId);
        saveSprawlers();
        renderSidebar();
        openSprawler(item);
    }

    function beginShelfRename(shelf) {
        renderSidebar();
        const input = document.querySelector(`.sprawl-rename[data-id="${CSS.escape(String(shelf.id))}"]`);
        if (!input) return;
        input.focus();
        input.select();
    }

    function finishShelfRename(shelf, input, save) {
        const value = input.value.trim();
        if (save && value) shelf.name = value;
        saveFolders();
        renderSidebar();
    }

    // Shelf navigation and spreadsheet workspace.
    const shelfBar = document.createElement("nav");
    shelfBar.id = "sprawlShelfBar";
    shelfBar.hidden = true;
    shelfBar.setAttribute("aria-label", "Sprawlshelf contents");
    document.getElementById("editorContainer").appendChild(shelfBar);

    const sprawlerView = document.createElement("section");
    sprawlerView.id = "sprawlerView";
    sprawlerView.hidden = true;
    document.getElementById("editorContainer").appendChild(sprawlerView);
    document.getElementById("editorContainer").appendChild(shelfBar);

    function clearWorkspace() {
        activeSprawlerId = null;
        sprawlerView.hidden = true;
        shelfBar.hidden = activeShelfId == null;
        document.getElementById("editor").style.display = "none";
        document.getElementById("noNote").style.display = "none";
    }

    function openShelf(shelf) {
        if (!isShelf(shelf)) return;
        activeShelfId = String(shelf.id);
        activeShelfItem = null;
        currentNote = null;
        selectedFolderId = activeShelfId;
        document.dispatchEvent(new CustomEvent("twonote:clear"));
        const landing = shelf.landingNoteId == null ? null : getNote(shelf.landingNoteId);
        const contents = getShelfItems(shelf.id);
        if (landing) {
            activeShelfItem = `note:${landing.id}`;
            showEditorForNote(landing);
        } else {
            const first = contents.find(item => item.kind === "sprawler");
            if (first) openShelfItem(first);
            else {
                clearWorkspace();
                showEmptyState("Empty Sprawlshelf", "Create a Sprawler or a nested Sprawlshelf to get started.");
                shelfBar.hidden = false;
            }
        }
        renderShelfBar();
        renderSidebar();
    }

    function getShelfItems(shelfId) {
        const childFolders = folders.filter(folder => String(folder.parentId) === String(shelfId));
        const childSprawlers = sprawlers.filter(item => String(item.folderId) === String(shelfId));
        return [
            ...childFolders.map(item => ({ kind: "shelf", item })),
            ...childSprawlers.map(item => ({ kind: "sprawler", item }))
        ];
    }

    function openShelfItem(entry) {
        if (!entry) return;
        activeShelfItem = `${entry.kind}:${entry.item.id}`;
        if (entry.kind === "shelf") {
            openShelf(entry.item);
            return;
        }
        openSprawler(entry.item);
        renderShelfBar();
    }

    function renderShelfBar() {
        if (activeShelfId == null) {
            shelfBar.hidden = true;
            return;
        }
        const shelf = folders.find(folder => String(folder.id) === activeShelfId);
        if (!isShelf(shelf)) {
            activeShelfId = null;
            shelfBar.hidden = true;
            return;
        }
        shelfBar.hidden = false;
        shelfBar.replaceChildren();

        const heading = document.createElement("span");
        heading.className = "sprawl-shelf-label";
        heading.textContent = shelf.name || "Sprawlshelf";
        shelfBar.appendChild(heading);

        if (shelf.landingNoteId != null && getNote(shelf.landingNoteId)) {
            const landingButton = makeShelfTab(
                "Landing",
                `note:${shelf.landingNoteId}`,
                activeShelfItem === `note:${shelf.landingNoteId}`
            );
            landingButton.prepend(icon(ICONS.landing, "Landing document"));
            landingButton.addEventListener("click", () => {
                const note = getNote(shelf.landingNoteId);
                if (!note) return;
                activeShelfItem = `note:${note.id}`;
                showEditorForNote(note);
                renderShelfBar();
            });
            shelfBar.appendChild(landingButton);
        }

        for (const entry of getShelfItems(shelf.id)) {
            const item = entry.item;
            const tab = makeShelfTab(
                item.name || item.title || (entry.kind === "shelf" ? "Sprawlshelf" : "Untitled Sprawler"),
                `${entry.kind}:${item.id}`,
                activeShelfItem === `${entry.kind}:${item.id}`
            );
            tab.prepend(icon(entry.kind === "shelf" ? ICONS.shelf : ICONS.sprawler, entry.kind));
            tab.addEventListener("click", () => openShelfItem(entry));
            shelfBar.appendChild(tab);
        }
    }

    function makeShelfTab(label, key, selected) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "sprawl-shelf-tab" + (selected ? " is-active" : "");
        button.dataset.item = key;
        const text = document.createElement("span");
        text.textContent = label;
        button.appendChild(text);
        return button;
    }

    function openSprawler(item) {
        if (!item) return;
        activeSprawlerId = String(item.id);
        activeShelfItem = activeShelfId == null ? null : `sprawler:${item.id}`;
        currentNote = null;
        document.dispatchEvent(new CustomEvent("twonote:clear"));
        document.getElementById("noNote").style.display = "none";
        document.getElementById("editor").style.display = "none";
        sprawlerView.hidden = false;
        renderSprawler();
        renderShelfBar();
        renderSidebar();
    }

    function columnName(index) {
        let name = "";
        let n = index + 1;
        while (n > 0) {
            const remainder = (n - 1) % 26;
            name = String.fromCharCode(65 + remainder) + name;
            n = Math.floor((n - 1) / 26);
        }
        return name;
    }

    function cellKey(row, col) {
        return `${columnName(col)}${row + 1}`;
    }

    function readCell(item, key, stack = new Set()) {
        const raw = String(item.cells[key] ?? "");
        if (!raw.startsWith("=")) return raw;
        if (stack.has(key)) return "#CYCLE!";
        stack.add(key);

        const expression = raw.slice(1).replace(/([A-Z]+[1-9][0-9]*)/g, reference => {
            const value = readCell(item, reference, stack);
            const number = Number(value);
            return Number.isFinite(number) ? String(number) : "0";
        });
        stack.delete(key);

        if (!/^[0-9+\-*/().\s]+$/.test(expression)) return "#ERROR!";

        try {
            // A tiny arithmetic parser avoids evaluating arbitrary JavaScript.
            const tokens = expression.match(/\d+(?:\.\d+)?|[()+\-*/]/g) || [];
            if (tokens.join("") !== expression.replace(/\s/g, "")) return "#ERROR!";

            let position = 0;

            function factor() {
                const token = tokens[position++];
                if (token === "+") return factor();
                if (token === "-") return -factor();

                if (token === "(") {
                    const value = expressionValue();
                    if (tokens[position++] !== ")") throw Error("paren");
                    return value;
                }

                const number = Number(token);
                if (!Number.isFinite(number)) throw Error("number");
                return number;
            }

            function term() {
                let value = factor();
                while (tokens[position] === "*" || tokens[position] === "/") {
                    const operator = tokens[position++];
                    const right = factor();
                    value = operator === "*" ? value * right : value / right;
                }
                return value;
            }

            function expressionValue() {
                let value = term();
                while (tokens[position] === "+" || tokens[position] === "-") {
                    const operator = tokens[position++];
                    const right = term();
                    value = operator === "+" ? value + right : value - right;
                }
                return value;
            }

            const result = expressionValue();
            if (position !== tokens.length || !Number.isFinite(result)) return "#ERROR!";
            return String(Number(result.toFixed(8)));
        } catch {
            return "#ERROR!";
        }
    }

    function renderSprawler() {
        const item = getSprawler(activeSprawlerId);
        if (!item) return;

        if (!item.cells || typeof item.cells !== "object") item.cells = {};
        item.rows = Math.max(1, Number(item.rows) || 20);
        item.cols = Math.max(1, Number(item.cols) || 10);
        sprawlerView.replaceChildren();

        const top = document.createElement("div");
        top.className = "sprawler-toolbar";

        const title = document.createElement("input");
        title.className = "sprawler-title";
        title.value = item.title || "Untitled Sprawler";
        title.setAttribute("aria-label", "Sprawler title");
        title.addEventListener("input", () => {
            item.title = title.value;
            saveSprawlers();
            renderSidebar();
            if (activeShelfId != null) renderShelfBar();
        });

        const addRow = document.createElement("button");
        addRow.type = "button";
        addRow.textContent = "+ Row";
        addRow.addEventListener("click", () => {
            item.rows++;
            saveSprawlers();
            renderSprawler();
        });

        const addCol = document.createElement("button");
        addCol.type = "button";
        addCol.textContent = "+ Column";
        addCol.addEventListener("click", () => {
            item.cols++;
            saveSprawlers();
            renderSprawler();
        });

        const deleteSprawler = document.createElement("button");
        deleteSprawler.type = "button";
        deleteSprawler.textContent = "Delete";
        deleteSprawler.className = "sprawler-delete";
        deleteSprawler.addEventListener("click", () => {
            if (!confirm(`Delete "${item.title || "Untitled Sprawler"}"? This cannot be undone.`)) return;

            sprawlers = sprawlers.filter(entry => String(entry.id) !== String(item.id));
            saveSprawlers();
            activeSprawlerId = null;
            sprawlerView.hidden = true;

            if (activeShelfId != null) {
                const shelf = folders.find(entry => String(entry.id) === activeShelfId);
                if (shelf) openShelf(shelf);
            } else {
                showEmptyState("Sprawler deleted.", "Select another item or create a new one.");
            }

            renderSidebar();
        });

        top.append(title, addRow, addCol, deleteSprawler);

        const formulaBar = document.createElement("div");
        formulaBar.className = "sprawler-formula-bar";

        const address = document.createElement("span");
        address.textContent = selectedCell || "A1";

        const formulaInput = document.createElement("input");
        formulaInput.placeholder = "Cell value or formula (e.g. =A1+B1)";
        formulaInput.value = item.cells[selectedCell || "A1"] ?? "";
        formulaInput.addEventListener("change", () => {
            const key = selectedCell || "A1";
            item.cells[key] = formulaInput.value;
            saveSprawlers();
            renderSprawler();
        });

        formulaBar.append(address, formulaInput);

        const scroller = document.createElement("div");
        scroller.className = "sprawler-grid-scroll";

        const table = document.createElement("table");
        table.className = "sprawler-grid";

        const head = document.createElement("tr");
        const corner = document.createElement("th");
        corner.textContent = "";
        head.appendChild(corner);

        for (let col = 0; col < item.cols; col++) {
            const th = document.createElement("th");
            th.textContent = columnName(col);
            head.appendChild(th);
        }

        const thead = document.createElement("thead");
        thead.appendChild(head);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        for (let row = 0; row < item.rows; row++) {
            const tr = document.createElement("tr");

            const rowHead = document.createElement("th");
            rowHead.textContent = String(row + 1);
            tr.appendChild(rowHead);

            for (let col = 0; col < item.cols; col++) {
                const key = cellKey(row, col);
                const td = document.createElement("td");
                const input = document.createElement("input");

                input.className = "sprawler-cell";
                input.value = readCell(item, key);
                input.title = key;
                input.setAttribute("aria-label", key);
                input.dataset.cell = key;

                input.addEventListener("focus", () => {
                    selectedCell = key;
                    address.textContent = key;
                    formulaInput.value = item.cells[key] ?? "";
                });

                input.addEventListener("change", () => {
                    item.cells[key] = input.value;
                    saveSprawlers();
                    renderSprawler();

                    const next = sprawlerView.querySelector(`[data-cell="${CSS.escape(key)}"]`);
                    if (next) next.focus();
                });

                td.appendChild(input);
                tr.appendChild(td);
            }

            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        scroller.appendChild(table);
        sprawlerView.append(top, formulaBar, scroller);
    }

    // Right-click note menu, including the landing pin toggle.
    const noteMenu = document.createElement("div");
    noteMenu.id = "sprawlNoteMenu";
    noteMenu.hidden = true;
    noteMenu.innerHTML = `<button type="button" data-action="pin"></button>`;
    document.body.appendChild(noteMenu);

    function closeNoteMenu() {
        noteMenu.hidden = true;
        menuNoteId = null;
        menuShelfId = null;
    }

    function openNoteMenu(note, x, y) {
        const shelf = folders.find(folder =>
            String(folder.id) === String(note.folderId) && isShelf(folder)
        );
        if (!shelf) return;

        menuNoteId = String(note.id);
        menuShelfId = String(shelf.id);

        const button = noteMenu.querySelector("button");
        button.textContent = String(shelf.landingNoteId) === String(note.id)
            ? "Unpin from landing"
            : "Pin to landing";

        noteMenu.hidden = false;
        noteMenu.style.left = `${Math.max(6, Math.min(x, window.innerWidth - 205))}px`;
        noteMenu.style.top = `${Math.max(6, Math.min(y, window.innerHeight - 55))}px`;
    }

    noteMenu.addEventListener("click", () => {
        const note = getNote(menuNoteId);
        const shelf = folders.find(folder =>
            String(folder.id) === menuShelfId && isShelf(folder)
        );

        if (!note || !shelf) return closeNoteMenu();

        if (String(shelf.landingNoteId) === String(note.id)) {
            shelf.landingNoteId = null;
        } else {
            shelf.landingNoteId = note.id;
        }

        saveFolders();
        closeNoteMenu();

        if (currentNote && String(currentNote.id) === String(note.id)) {
            landingStatus.hidden = String(shelf.landingNoteId) !== String(note.id);
        }

        if (activeShelfId === String(shelf.id)) {
            if (shelf.landingNoteId == null && activeShelfItem === `note:${note.id}`) {
                activeShelfItem = null;
                const first = getShelfItems(shelf.id).find(entry => entry.kind === "sprawler");

                if (first) {
                    openShelfItem(first);
                } else {
                    clearWorkspace();
                    showEmptyState(
                        "Empty Sprawlshelf",
                        "Create a Sprawler or a nested Sprawlshelf to get started."
                    );
                    shelfBar.hidden = false;
                }
            }

            renderShelfBar();
        }

        renderSidebar();
    });

    document.addEventListener("click", event => {
        if (!noteMenu.contains(event.target)) closeNoteMenu();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeNoteMenu();
    });

    // Replace the sidebar renderer while retaining the original note/folder data.
    function renderSidebar() {
        const list = document.getElementById("noteList");
        list.replaceChildren();

        function addDropTarget(container, folderId) {
            container.dataset.dropFolderId = folderId == null ? "" : String(folderId);

            container.addEventListener("dragover", event => {
                if (!window.__sprawlDraggedId) return;
                event.preventDefault();
                container.classList.add("note-drop-target");
            });

            container.addEventListener("dragleave", event => {
                if (!container.contains(event.relatedTarget)) {
                    container.classList.remove("note-drop-target");
                }
            });

            container.addEventListener("drop", event => {
                if (!window.__sprawlDraggedId) return;
                event.preventDefault();

                const dragged = window.__sprawlDraggedId;
                const note = getNote(dragged);
                const sprawler = getSprawler(dragged);
                const destination = container.dataset.dropFolderId || null;

                if (note) moveNoteToFolder(note.id, destination);

                if (sprawler) {
                    sprawler.folderId = destination;
                    saveSprawlers();
                    renderSidebar();
                }

                window.__sprawlDraggedId = null;
                container.classList.remove("note-drop-target");
            });
        }

        function addCard(container, label, src, className, click, context) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `sidebar-card ${className}`;

            const image = icon(src, "");
            const text = document.createElement("span");
            text.className = "note-name";
            text.textContent = label;

            button.append(image, text);
            button.addEventListener("click", click);

            if (context) {
                button.addEventListener("contextmenu", event => {
                    event.preventDefault();
                    context(event);
                });
            }

            container.appendChild(button);
            return button;
        }

        function renderChildren(parentId, container) {
            addDropTarget(container, parentId);

            const childFolders = folders.filter(folder =>
                (folder.parentId == null ? parentId == null : String(folder.parentId) === String(parentId))
            );

            const childNotes = notes.filter(note =>
                (note.folderId == null ? parentId == null : String(note.folderId) === String(parentId))
            );

            const childSprawlers = sprawlers.filter(item =>
                (item.folderId == null ? parentId == null : String(item.folderId) === String(parentId))
            );

            for (const folder of childFolders) {
                const folderId = String(folder.id);
                const expanded = expandedFolders.has(folderId);

                const entry = document.createElement("div");
                entry.className = "sidebar-entry";

                const arrow = document.createElement("button");
                arrow.type = "button";
                arrow.className = "folder-arrow";
                arrow.textContent = expanded ? "▾" : "▸";

                arrow.addEventListener("click", event => {
                    event.stopPropagation();

                    if (expandedFolders.has(folderId)) {
                        expandedFolders.delete(folderId);
                    } else {
                        expandedFolders.add(folderId);
                    }

                    saveFolders();
                    renderSidebar();
                });

                let card;

                if (window.__sprawlRenamingShelf === folderId) {
                    card = document.createElement("div");
                    card.className = "sidebar-card folder-card";

                    const input = document.createElement("input");
                    input.className = "folder-rename-input sprawl-rename";
                    input.dataset.id = folderId;
                    input.value = folder.name || "";

                    input.addEventListener("keydown", event => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            window.__sprawlRenamingShelf = null;
                            finishShelfRename(folder, input, true);
                        }

                        if (event.key === "Escape") {
                            window.__sprawlRenamingShelf = null;
                            finishShelfRename(folder, input, false);
                        }
                    });

                    input.addEventListener("blur", () => {
                        if (window.__sprawlRenamingShelf === folderId) {
                            window.__sprawlRenamingShelf = null;
                            finishShelfRename(folder, input, true);
                        }
                    });

                    card.append(
                        icon(isShelf(folder) ? ICONS.shelf : ICONS.folder, ""),
                        input
                    );

                    setTimeout(() => {
                        input.focus();
                        input.select();
                    }, 0);
                } else {
                    card = addCard(
                        entry,
                        folder.name || "Untitled folder",
                        isShelf(folder) ? ICONS.shelf : ICONS.folder,
                        `folder-card ${isShelf(folder) ? "sprawlshelf-card" : ""}`,
                        () => {
                            if (isShelf(folder)) openShelf(folder);
                            else selectFolder(folderId);
                        },
                        event => openFolderMenu(folder, event.clientX, event.clientY)
                    );

                    card.classList.toggle(
                        "is-selected",
                        selectedFolderId === folderId || activeShelfId === folderId
                    );

                    card.addEventListener("dragover", event => {
                        if (window.__sprawlDraggedId) {
                            event.preventDefault();
                            event.stopPropagation();
                            card.classList.add("note-drop-target");
                        }
                    });

                    card.addEventListener("drop", event => {
                        if (!window.__sprawlDraggedId) return;

                        event.preventDefault();
                        event.stopPropagation();

                        const note = getNote(window.__sprawlDraggedId);
                        const item = getSprawler(window.__sprawlDraggedId);

                        if (note) moveNoteToFolder(note.id, folderId);

                        if (item) {
                            item.folderId = folderId;
                            saveSprawlers();
                            renderSidebar();
                        }

                        window.__sprawlDraggedId = null;
                    });
                }

                entry.append(arrow, card);
                container.appendChild(entry);

                if (expanded) {
                    const children = document.createElement("div");
                    children.className = "folder-children";
                    renderChildren(folderId, children);
                    container.appendChild(children);
                }
            }

            for (const note of childNotes) {
                const entry = document.createElement("div");
                entry.className = "sidebar-entry";

                const spacer = document.createElement("span");
                spacer.className = "folder-arrow-spacer";

                const button = addCard(
                    entry,
                    note.title || "Untitled",
                    ICONS.note,
                    "note-card",
                    () => {
                        activeShelfId = null;
                        shelfBar.hidden = true;
                        sprawlerView.hidden = true;
                        showEditorForNote(note);
                    },
                    event => openNoteMenu(note, event.clientX, event.clientY)
                );

                button.classList.toggle("is-selected", currentNote === note);
                button.draggable = true;
                button.addEventListener("dragstart", () => {
                    window.__sprawlDraggedId = String(note.id);
                });
                button.addEventListener("dragend", () => {
                    window.__sprawlDraggedId = null;
                });

                entry.prepend(spacer);
                container.appendChild(entry);
            }

            for (const item of childSprawlers) {
                const entry = document.createElement("div");
                entry.className = "sidebar-entry";

                const spacer = document.createElement("span");
                spacer.className = "folder-arrow-spacer";

                const button = addCard(
                    entry,
                    item.title || "Untitled Sprawler",
                    ICONS.sprawler,
                    "sprawler-card",
                    () => {
                        activeShelfId = null;
                        shelfBar.hidden = true;
                        openSprawler(item);
                    }
                );

                button.classList.toggle("is-selected", activeSprawlerId === String(item.id));
                button.draggable = true;
                button.addEventListener("dragstart", () => {
                    window.__sprawlDraggedId = String(item.id);
                });
                button.addEventListener("dragend", () => {
                    window.__sprawlDraggedId = null;
                });

                entry.prepend(spacer);
                container.appendChild(entry);
            }
        }

        renderChildren(null, list);

        const newFolderControl = document.getElementById("newFolder");
        if (newFolderControl) {
            newFolderControl.hidden = isShelf(getFolder(selectedFolderId));
        }
    }

    // Folder menu adds shelf-specific actions and preserves standard folder actions.
    const folderMenu = document.getElementById("folderContextMenu");

    function openFolderMenu(folder, x, y) {
        menuShelfId = String(folder.id);
        folderMenu.replaceChildren();

        const actions = [
            ["rename", "Rename"],
            ["new-note", "New note inside"],
            ["new-sprawler", "New Sprawler inside"],
            ["new-shelf", "New Sprawlshelf inside"],
            ...(!isShelf(folder) ? [["new-folder", "New subfolder"]] : []),
            ["delete", isShelf(folder) ? "Delete Sprawlshelf" : "Delete folder"]
        ];

        for (const [action, label] of actions) {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.action = action;
            button.textContent = label;

            if (action === "delete") button.className = "danger";
            folderMenu.appendChild(button);
        }

        folderMenu.hidden = false;
        folderMenu.style.left = `${Math.max(6, Math.min(x, window.innerWidth - 205))}px`;
        folderMenu.style.top = `${Math.max(6, Math.min(y, window.innerHeight - 245))}px`;
    }

    if (folderMenu) {
        folderMenu.addEventListener("click", event => {
            const button = event.target.closest("button[data-action]");
            if (!button || menuShelfId == null) return;

            const folder = folders.find(item => String(item.id) === menuShelfId);
            const action = button.dataset.action;
            const folderId = menuShelfId;

            folderMenu.hidden = true;
            menuShelfId = null;

            if (!folder) return;

            if (action === "rename") {
                if (isShelf(folder)) {
                    window.__sprawlRenamingShelf = folderId;
                    renderSidebar();
                } else {
                    beginFolderRename(folderId);
                }
            } else if (action === "new-note") {
                createNote(folderId);
            } else if (action === "new-sprawler") {
                createSprawler(folderId);
            } else if (action === "new-shelf") {
                createShelf(folderId);
            } else if (action === "new-folder") {
                createFolder(folderId);
            } else if (action === "delete") {
                deleteFolder(folderId);
            }
        });
    }

    // Override the original renderer and refresh after all legacy operations.
    refreshNoteList = renderSidebar;

    document.addEventListener("twonote:select", () => {
        if (activeShelfId != null) renderShelfBar();
    });

    const oldNewFolder = document.getElementById("newFolder");
    if (oldNewFolder) {
        oldNewFolder.addEventListener("click", () => {
            closeCreateMenu();
        });
    }

    // Add a tiny status marker to the note editor when it is the shelf landing.
    const landingStatus = document.createElement("div");
    landingStatus.id = "sprawlLandingStatus";
    landingStatus.hidden = true;
    landingStatus.textContent = "Pinned as this Sprawlshelf's landing document";
    document.getElementById("editor").prepend(landingStatus);

    const originalShowEditorForNote = showEditorForNote;

    showEditorForNote = function(note) {
        sprawlerView.hidden = true;
        document.getElementById("editor").style.display = "flex";
        document.getElementById("noNote").style.display = "none";

        originalShowEditorForNote(note);

        const pinnedShelf = folders.find(folder =>
            isShelf(folder) && String(folder.landingNoteId) === String(note.id)
        );

        landingStatus.hidden = !pinnedShelf;

        if (pinnedShelf) {
            activeShelfId = String(pinnedShelf.id);
            activeShelfItem = `note:${note.id}`;
            renderShelfBar();
        }
    };

    // Keep landing references and Sprawler storage consistent when content is deleted or moved.
    const deleteButton = document.getElementById("delete");
    const originalDeleteHandler = deleteButton.onclick;

    deleteButton.onclick = function() {
        const deletedId = currentNote == null ? null : String(currentNote.id);

        if (originalDeleteHandler) {
            originalDeleteHandler.call(this);
        }

        if (deletedId != null) {
            let changed = false;

            for (const shelf of folders) {
                if (isShelf(shelf) && String(shelf.landingNoteId) === deletedId) {
                    shelf.landingNoteId = null;
                    changed = true;
                }
            }

            if (changed) saveFolders();

            landingStatus.hidden = true;

            if (activeShelfId != null) renderShelfBar();
        }
    };

    const originalMoveNoteToFolder = moveNoteToFolder;

    moveNoteToFolder = function(noteId, folderId) {
        originalMoveNoteToFolder(noteId, folderId);

        const note = getNote(noteId);
        let changed = false;

        for (const shelf of folders) {
            if (
                isShelf(shelf) &&
                String(shelf.landingNoteId) === String(noteId) &&
                (!note || String(note.folderId) !== String(shelf.id))
            ) {
                shelf.landingNoteId = null;
                changed = true;
            }
        }

        if (changed) saveFolders();

        if (currentNote && String(currentNote.id) === String(noteId)) {
            landingStatus.hidden = true;
        }

        if (activeShelfId != null) renderShelfBar();
    };

    const originalDeleteFolder = deleteFolder;

    deleteFolder = function(folderId) {
        const root = folders.find(item => String(item.id) === String(folderId));
        if (!root) return;

        const descendants = new Set([String(folderId)]);
        let grew = true;

        while (grew) {
            grew = false;

            for (const folder of folders) {
                if (
                    folder.parentId != null &&
                    descendants.has(String(folder.parentId)) &&
                    !descendants.has(String(folder.id))
                ) {
                    descendants.add(String(folder.id));
                    grew = true;
                }
            }
        }

        const removedNoteIds = new Set(
            notes
                .filter(note => note.folderId != null && descendants.has(String(note.folderId)))
                .map(note => String(note.id))
        );

        const before = folders.length;
        originalDeleteFolder(folderId);

        if (folders.length === before) return;

        sprawlers = sprawlers.filter(item =>
            item.folderId == null || !descendants.has(String(item.folderId))
        );

        for (const shelf of folders) {
            if (
                shelf.landingNoteId != null &&
                removedNoteIds.has(String(shelf.landingNoteId))
            ) {
                shelf.landingNoteId = null;
            }
        }

        if (activeShelfId != null && descendants.has(activeShelfId)) {
            activeShelfId = null;
        }

        saveAll();
        renderShelfBar();
        renderSidebar();
    };

    const originalOpenShelfItem = openShelfItem;

    // Initial paint after notes.js has loaded all existing notes and folders.
    renderSidebar();
})();