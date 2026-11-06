let notes = [];
let folders = [];
let currentNote = null;
let selectedFolderId = null;
let expandedFolders = new Set();
let renamingFolderId = null;
let contextFolderId = null;
let draggedNoteId = null;

const NOTES_KEY = "notes";
const FOLDERS_KEY = "noteFolders";
const EXPANDED_KEY = "noteExpandedFolders";

// Load theme
const savedTheme = localStorage.getItem("theme");
if (savedTheme != null) {
    document.body.className = savedTheme;
}

// Load folders and expansion state
try {
    folders = JSON.parse(localStorage.getItem(FOLDERS_KEY) || "[]");
    if (!Array.isArray(folders)) folders = [];
} catch {
    folders = [];
}

try {
    const savedExpanded = JSON.parse(localStorage.getItem(EXPANDED_KEY) || "[]");
    expandedFolders = new Set(Array.isArray(savedExpanded) ? savedExpanded.map(String) : []);
} catch {
    expandedFolders = new Set();
}

function saveNotes() {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function saveFolders() {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expandedFolders]));
}

function makeFolderId() {
    return "folder-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function getFolder(folderId) {
    return folders.find(folder => String(folder.id) === String(folderId)) || null;
}

function getFolderChildren(folderId) {
    return folders.filter(folder => {
        if (folder.parentId == null) return folderId == null;
        return String(folder.parentId) === String(folderId);
    });
}

function getNote(noteId) {
    return notes.find(note => String(note.id) === String(noteId)) || null;
}

function moveNoteToFolder(noteId, folderId) {
    const note = getNote(noteId);
    if (!note) return;

    const destinationId = folderId == null || folderId === "" ? null : String(folderId);
    if (destinationId != null && !getFolder(destinationId)) return;
    if ((note.folderId == null && destinationId == null) ||
        (note.folderId != null && destinationId != null && String(note.folderId) === destinationId)) return;

    note.folderId = destinationId;
    if (destinationId != null) expandedFolders.add(destinationId);
    if (currentNote === note) selectedFolderId = destinationId;

    saveNotes();
    saveFolders();
    refreshNoteList();
}

function getNotesInFolder(folderId) {
    return notes.filter(note => {
        if (folderId == null) return note.folderId == null;
        return note.folderId != null && String(note.folderId) === String(folderId);
    });
}

function showEmptyState(message, detail) {
    const noNote = document.getElementById("noNote");
    noNote.innerHTML = "";

    const heading = document.createElement("p");
    heading.className = "big";
    heading.textContent = message;

    const description = document.createElement("p");
    description.textContent = detail;

    noNote.append(heading, description);
    noNote.style.display = "block";
    document.getElementById("editor").style.display = "none";
}

function showEditorForNote(note) {
    currentNote = note;
    selectedFolderId = note.folderId == null ? null : String(note.folderId);

    document.dispatchEvent(new CustomEvent("twonote:select", {
        detail: { noteId: note.id }
    }));

    document.getElementById("noNote").style.display = "none";
    document.getElementById("editor").style.display = "flex";
    document.getElementById("title").value = note.title || "";
    document.getElementById("body").innerHTML = note.body || "";

    refreshNoteList();
}

function selectFolder(folderId) {
    const clickedId = folderId == null ? null : String(folderId);

    // Clicking the currently selected folder deselects it.
    selectedFolderId = selectedFolderId === clickedId ? null : clickedId;

    currentNote = null;

    document.dispatchEvent(new CustomEvent("twonote:clear"));

    if (selectedFolderId === null) {
        showEmptyState(
            "No note has been selected.",
            "Select a note from the sidebar or create a new one."
        );
    } else {
        showEmptyState(
            getFolder(selectedFolderId)?.name || "Folder selected.",
            "This folder is selected. Create a note to add it here."
        );
    }

    refreshNoteList();
}

function createNote(folderId = selectedFolderId) {
    const note = {
        id: Date.now(),
        title: "",
        body: "",
        folderId: folderId == null ? null : String(folderId)
    };

    notes.push(note);
    saveNotes();
    showEditorForNote(note);

    document.getElementById("title").focus();
}

function createFolder(parentId = selectedFolderId) {
    const folder = {
        id: makeFolderId(),
        name: "New Folder",
        parentId: parentId == null ? null : String(parentId)
    };

    folders.push(folder);
    if (parentId != null) expandedFolders.add(String(parentId));
    expandedFolders.add(String(folder.id));
    selectedFolderId = String(folder.id);
    currentNote = null;
    saveFolders();

    document.dispatchEvent(new CustomEvent("twonote:clear"));
    showEmptyState(folder.name, "This folder is selected. Create a note to add it here.");

    renamingFolderId = String(folder.id);
    refreshNoteList();

    const input = document.querySelector(
        `.folder-rename-input[data-folder-id="${CSS.escape(String(folder.id))}"]`
    );
    if (input) {
        input.focus();
        input.select();
    }
}

function finishFolderRename(folderId, input, save) {
    const folder = getFolder(folderId);
    if (!folder) return;

    if (save) {
        const newName = input.value.trim();
        if (newName) folder.name = newName;
        saveFolders();
    }

    renamingFolderId = null;
    refreshNoteList();
}

function beginFolderRename(folderId) {
    renamingFolderId = String(folderId);
    refreshNoteList();

    const input = document.querySelector(
        `.folder-rename-input[data-folder-id="${CSS.escape(String(folderId))}"]`
    );

    if (input) {
        input.focus();
        input.select();
    }
}

// Sidebar rendering
function refreshNoteList() {
    const noteList = document.getElementById("noteList");
    noteList.replaceChildren();

    function addNoteDropTarget(container, folderId) {
        container.dataset.dropFolderId = folderId == null ? "" : String(folderId);
        container.addEventListener("dragover", event => {
            if (!draggedNoteId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            container.classList.add("note-drop-target");
        });
        container.addEventListener("dragleave", event => {
            if (!container.contains(event.relatedTarget)) {
                container.classList.remove("note-drop-target");
            }
        });
        container.addEventListener("drop", event => {
            if (!draggedNoteId) return;
            event.preventDefault();
            event.stopPropagation();
            container.classList.remove("note-drop-target");
            moveNoteToFolder(draggedNoteId, container.dataset.dropFolderId);
            draggedNoteId = null;
        });
    }

    function renderFolderContents(parentId, container) {
        addNoteDropTarget(container, parentId);
        const childFolders = getFolderChildren(parentId);
        const childNotes = getNotesInFolder(parentId);

        for (const folder of childFolders) {
            const folderId = String(folder.id);
            const isExpanded = expandedFolders.has(folderId);
            const entry = document.createElement("div");
            entry.className = "sidebar-entry";

            const arrow = document.createElement("button");
            arrow.type = "button";
            arrow.className = "folder-arrow";
            arrow.textContent = isExpanded ? "▾" : "▸";
            arrow.title = isExpanded ? "Collapse folder" : "Expand folder";
            arrow.setAttribute("aria-label", arrow.title);
            arrow.setAttribute("aria-expanded", String(isExpanded));
            arrow.addEventListener("click", event => {
                event.stopPropagation();
                if (expandedFolders.has(folderId)) {
                    expandedFolders.delete(folderId);
                } else {
                    expandedFolders.add(folderId);
                }
                saveFolders();
                refreshNoteList();
            });

            let card;
            if (renamingFolderId === folderId) {
                card = document.createElement("div");
                card.className = "sidebar-card folder-card";

                const icon = document.createElement("span");
                icon.className = "folder-symbol";
                icon.textContent = "📁";

                const input = document.createElement("input");
                input.type = "text";
                input.className = "folder-rename-input";
                input.value = folder.name;
                input.dataset.folderId = folderId;
                input.setAttribute("aria-label", "Folder name");

                input.addEventListener("keydown", event => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        finishFolderRename(folderId, input, true);
                    } else if (event.key === "Escape") {
                        event.preventDefault();
                        finishFolderRename(folderId, input, false);
                    }
                });
                input.addEventListener("blur", () => {
                    if (renamingFolderId === folderId) {
                        finishFolderRename(folderId, input, true);
                    }
                });

                card.append(icon, input);
            } else {
                card = document.createElement("button");
                card.type = "button";
                card.className = "sidebar-card folder-card";
                card.classList.toggle("is-selected", selectedFolderId === folderId);

                const icon = document.createElement("span");
                icon.className = "folder-symbol";
                icon.textContent = isExpanded ? "📂" : "📁";

                const name = document.createElement("span");
                name.className = "folder-name";
                name.textContent = folder.name || "Untitled folder";

                card.append(icon, name);
                card.addEventListener("click", () => selectFolder(folderId));
                card.addEventListener("dragover", event => {
                    if (!draggedNoteId) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "move";
                    card.classList.add("note-drop-target");
                });
                card.addEventListener("dragleave", () => card.classList.remove("note-drop-target"));
                card.addEventListener("drop", event => {
                    if (!draggedNoteId) return;
                    event.preventDefault();
                    event.stopPropagation();
                    card.classList.remove("note-drop-target");
                    moveNoteToFolder(draggedNoteId, folderId);
                    draggedNoteId = null;
                });
                card.addEventListener("contextmenu", event => {
                    event.preventDefault();
                    openFolderContextMenu(folderId, event.clientX, event.clientY);
                });
            }

            entry.append(arrow, card);
            container.appendChild(entry);

            if (isExpanded) {
                const children = document.createElement("div");
                children.className = "folder-children";
                renderFolderContents(folderId, children);
                container.appendChild(children);
            }
        }

        for (const note of childNotes) {
            const entry = document.createElement("div");
            entry.className = "sidebar-entry";

            const spacer = document.createElement("span");
            spacer.className = "folder-arrow-spacer";

            const button = document.createElement("button");
            button.type = "button";
            button.className = "sidebar-card note-card";
            button.classList.toggle("is-selected", currentNote === note);

            const icon = document.createElement("span");
            icon.textContent = "📝";
            icon.className = "folder-symbol";

            const name = document.createElement("span");
            name.className = "note-name";
            name.textContent = note.title || "Untitled";

            button.append(icon, name);
            button.draggable = true;

            button.addEventListener("dragstart", event => {
                draggedNoteId = String(note.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(note.id));
                button.classList.add("is-dragging");
            });

            button.addEventListener("dragend", () => {
                draggedNoteId = null;
                button.classList.remove("is-dragging");
                document.querySelectorAll(".note-drop-target").forEach(element => {
                    element.classList.remove("note-drop-target");
                });
            });

            button.addEventListener("click", () => showEditorForNote(note));

            entry.append(spacer, button);
            container.appendChild(entry);
        }
    }

    renderFolderContents(null, noteList);
}

// New note / folder buttons
document.getElementById("new").onclick = function () {
    createNote(selectedFolderId);
};

const newFolderButton = document.getElementById("newFolder");
if (newFolderButton) {
    newFolderButton.onclick = function () {
        createFolder(selectedFolderId);
    };
}

// Save note
document.getElementById("save").onclick = function () {
    if (currentNote == null) return;

    const body = document.getElementById("body");
    parseMarkup(body);

    currentNote.title = document.getElementById("title").value;
    currentNote.body = body.innerHTML;

    saveNotes();
    refreshNoteList();
};

// Delete note
document.getElementById("delete").onclick = function () {
    if (currentNote == null) return;

    notes = notes.filter(note => String(note.id) !== String(currentNote.id));
    saveNotes();

    document.dispatchEvent(new CustomEvent("twonote:clear"));
    currentNote = null;

    document.getElementById("title").value = "";
    document.getElementById("body").innerHTML = "";
    showEmptyState(
        selectedFolderId == null ? "No note has been selected." : (getFolder(selectedFolderId)?.name || "Folder selected."),
        selectedFolderId == null
            ? "Select a note from the sidebar or create a new one."
            : "This folder is selected. Create a note to add it here."
    );

    refreshNoteList();
};

// Delete folder and all nested contents
function deleteFolder(folderId) {
    const folder = getFolder(folderId);
    if (!folder) return;

    const descendants = new Set([String(folderId)]);
    let changed = true;

    while (changed) {
        changed = false;
        for (const candidate of folders) {
            if (candidate.parentId != null &&
                descendants.has(String(candidate.parentId)) &&
                !descendants.has(String(candidate.id))) {
                descendants.add(String(candidate.id));
                changed = true;
            }
        }
    }

    const containedNotes = notes.filter(note =>
        note.folderId != null && descendants.has(String(note.folderId))
    );

    const message = containedNotes.length
        ? `Delete "${folder.name}" and its ${containedNotes.length} note(s), including nested folders? This cannot be undone.`
        : `Delete "${folder.name}" and all its nested folders?`;

    if (!confirm(message)) return;

    notes = notes.filter(note =>
        note.folderId == null || !descendants.has(String(note.folderId))
    );
    folders = folders.filter(item => !descendants.has(String(item.id)));

    for (const id of descendants) expandedFolders.delete(id);

    if (selectedFolderId != null && descendants.has(selectedFolderId)) {
        selectedFolderId = folder.parentId == null ? null : String(folder.parentId);
    }

    if (currentNote && currentNote.folderId != null &&
        descendants.has(String(currentNote.folderId))) {
        currentNote = null;
        document.dispatchEvent(new CustomEvent("twonote:clear"));
        document.getElementById("title").value = "";
        document.getElementById("body").innerHTML = "";
        showEmptyState(
            selectedFolderId == null ? "No note has been selected." : (getFolder(selectedFolderId)?.name || "Folder selected."),
            "Select a note from the sidebar or create a new one."
        );
    }

    saveNotes();
    saveFolders();
    refreshNoteList();
}

// Folder context menu
const folderContextMenu = document.createElement("div");
folderContextMenu.id = "folderContextMenu";
folderContextMenu.hidden = true;
folderContextMenu.setAttribute("role", "menu");
folderContextMenu.innerHTML = `
    <button type="button" data-action="rename" role="menuitem">Rename</button>
    <button type="button" data-action="new-note" role="menuitem">New note inside</button>
    <button type="button" data-action="new-folder" role="menuitem">New subfolder</button>
    <div class="menu-divider"></div>
    <button type="button" data-action="delete" class="danger" role="menuitem">Delete folder</button>
`;
document.body.appendChild(folderContextMenu);

function closeFolderContextMenu() {
    folderContextMenu.hidden = true;
    contextFolderId = null;
}

function openFolderContextMenu(folderId, x, y) {
    contextFolderId = String(folderId);
    folderContextMenu.hidden = false;

    const menuWidth = 195;
    const menuHeight = 165;
    folderContextMenu.style.left = `${Math.max(6, Math.min(x, window.innerWidth - menuWidth - 6))}px`;
    folderContextMenu.style.top = `${Math.max(6, Math.min(y, window.innerHeight - menuHeight - 6))}px`;
}

folderContextMenu.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button || contextFolderId == null) return;

    const folderId = contextFolderId;
    const action = button.dataset.action;
    const folder = getFolder(folderId);
    closeFolderContextMenu();

    if (!folder) return;

    if (action === "rename") {
        selectedFolderId = folderId;
        beginFolderRename(folderId);
    } else if (action === "new-note") {
        selectedFolderId = folderId;
        createNote(folderId);
    } else if (action === "new-folder") {
        selectedFolderId = folderId;
        createFolder(folderId);
    } else if (action === "delete") {
        deleteFolder(folderId);
    }
});

document.addEventListener("click", event => {
    if (!folderContextMenu.contains(event.target)) closeFolderContextMenu();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeFolderContextMenu();
});

window.addEventListener("resize", closeFolderContextMenu);
document.getElementById("sidebar").addEventListener("scroll", closeFolderContextMenu);

// Load saved notes
const savedNotes = localStorage.getItem(NOTES_KEY);
if (savedNotes != null) {
    try {
        const parsed = JSON.parse(savedNotes);
        notes = Array.isArray(parsed) ? parsed : [];
    } catch {
        notes = [];
    }
}

// Legacy notes get assigned to the root without changing their content.
for (const note of notes) {
    if (!Object.prototype.hasOwnProperty.call(note, "folderId")) {
        note.folderId = null;
    }
}

refreshNoteList();

// Initial state
document.getElementById("editor").style.display = "none";
document.getElementById("noNote").style.display = "block";

// Rich text buttons
document.getElementById("bold").onclick = function () {
    document.execCommand("bold");
};

document.getElementById("italic").onclick = function () {
    document.execCommand("italic");
};

// Themes
document.getElementById("lightMode").onclick = function () {
    document.body.className = "light";
    localStorage.setItem("theme", "light");
};

document.getElementById("twilightMode").onclick = function () {
    document.body.className = "twilight";
    localStorage.setItem("theme", "twilight");
};

// Sidebar
document.getElementById("sidebarToggle").onclick = function () {
    document.getElementById("sidebar").classList.toggle("hidden");
};

// TwoNote markup parser
function parseMarkup(element) {
    let html = element.innerHTML;

    // Supports the [Warn]<text> and [Sunset]<text> markup forms.
    html = html.replace(/\[Warn\]<(.*?)>/gs, '<span class="warn">$1</span>');
    html = html.replace(/\[Sunset\]<(.*?)>/gs, '<span class="sunset">$1</span>');

    element.innerHTML = html;
}

// Gem text formatting
const gemButton = document.getElementById("gemButton");
const editorBody = document.getElementById("body");

const gemColors = [
    { id: 1, name: "Red", color: "#ff5268" },
    { id: 2, name: "Orange", color: "#ff9b45" },
    { id: 3, name: "Yellow", color: "#f6d64a" },
    { id: 4, name: "Green", color: "#56df91" },
    { id: 5, name: "Blue", color: "#55aaff" },
    { id: 6, name: "Purple", color: "#b18aff" },
    { id: 7, name: "Rose", color: "#ff91d2" },
    { id: 8, name: "White", color: "#d8e7f7" }
];

const gemMenu = document.createElement("div");
gemMenu.id = "gemMenu";
gemMenu.setAttribute("role", "dialog");
gemMenu.setAttribute("aria-label", "Choose a text gem");
gemMenu.hidden = true;

gemColors.forEach(gem => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gemOption";
    button.title = `${gem.name} (Gem ${gem.id})`;
    button.setAttribute("aria-label", gem.name);

    const swatch = document.createElement("span");
    swatch.className = "gemSwatch";
    swatch.style.setProperty("--gem-color", gem.color);
    swatch.textContent = "✦";

    const label = document.createElement("span");
    label.textContent = `${gem.id}. ${gem.name}`;

    button.append(swatch, label);

    button.addEventListener("mousedown", event => {
        event.preventDefault();
    });

    button.addEventListener("click", () => {
        applyGem(gem.id);
        closeGemMenu();
    });

    gemMenu.appendChild(button);
});

document.body.appendChild(gemMenu);

let savedGemRange = null;

function rememberGemSelection() {
    const selection = window.getSelection();

    if (
        selection &&
        selection.rangeCount > 0 &&
        editorBody.contains(selection.anchorNode) &&
        editorBody.contains(selection.focusNode)
    ) {
        savedGemRange = selection.getRangeAt(0).cloneRange();
    }
}

function openGemMenu() {
    rememberGemSelection();

    if (!savedGemRange || savedGemRange.collapsed) return;

    const rect = gemButton.getBoundingClientRect();

    gemMenu.style.left =
        `${Math.min(rect.left, window.innerWidth - 220)}px`;
    gemMenu.style.top =
        `${Math.min(rect.bottom + 8, window.innerHeight - 300)}px`;

    gemMenu.hidden = false;
}

function closeGemMenu() {
    gemMenu.hidden = true;
}

function applyGem(gemId) {
    if (!savedGemRange || savedGemRange.collapsed) return;

    if (
        !editorBody.contains(savedGemRange.startContainer) ||
        !editorBody.contains(savedGemRange.endContainer)
    ) {
        return;
    }

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedGemRange);

    const selectedText = savedGemRange.toString();
    if (!selectedText) return;

    const contents = savedGemRange.extractContents();

    contents.querySelectorAll?.("[data-gem]").forEach(node => {
        node.replaceWith(...node.childNodes);
    });

    const gem = document.createElement("span");
    gem.className = `gem gem-${gemId}`;
    gem.dataset.gem = String(gemId);
    gem.appendChild(contents);

    savedGemRange.insertNode(gem);

    const newRange = document.createRange();
    newRange.selectNodeContents(gem);
    newRange.collapse(false);

    selection.removeAllRanges();
    selection.addRange(newRange);
    savedGemRange = newRange.cloneRange();

    editorBody.focus();
}

gemButton.addEventListener("mousedown", rememberGemSelection);
gemButton.addEventListener("click", openGemMenu);

document.addEventListener("keydown", event => {
    if (
        event.ctrlKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "g" &&
        !event.altKey &&
        document.activeElement === editorBody
    ) {
        event.preventDefault();
        openGemMenu();
    }

    if (event.key === "Escape") closeGemMenu();
});

document.addEventListener("click", event => {
    if (!gemMenu.contains(event.target) && event.target !== gemButton) {
        closeGemMenu();
    }
});