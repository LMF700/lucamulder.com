let notes = [];
let currentNote = null;

// Load theme

const savedTheme = localStorage.getItem("theme");

if (savedTheme != null) {
    document.body.className = savedTheme;
}


// Refresh note list

function refreshNoteList() {

    const noteList = document.getElementById("noteList");

    noteList.innerHTML = "";

    for (const note of notes) {

        const button = document.createElement("button");

        button.textContent = note.title || "Untitled";

        button.onclick = function () {

            currentNote = note;

            document.getElementById("noNote").style.display = "none";
            document.getElementById("editor").style.display = "block";

            document.getElementById("title").value = note.title;
            document.getElementById("body").innerHTML = note.body;

        };

        noteList.appendChild(button);

    }

}


// New note

document.getElementById("new").onclick = function () {

    const note = {
        id: Date.now(),
        title: "",
        body: ""
    };


    notes.push(note);

    currentNote = note;


    document.getElementById("noNote").style.display = "none";
    document.getElementById("editor").style.display = "block";


    document.getElementById("title").value = "";
    document.getElementById("body").innerHTML = "";


    localStorage.setItem(
        "notes",
        JSON.stringify(notes)
    );


    refreshNoteList();

};


// Save note

document.getElementById("save").onclick = function () {

    if (currentNote == null) return;


    const body = document.getElementById("body");


    parseMarkup(body);


    currentNote.title =
        document.getElementById("title").value;


    currentNote.body =
        body.innerHTML;


    localStorage.setItem(
        "notes",
        JSON.stringify(notes)
    );


    refreshNoteList();

};


// Delete note

document.getElementById("delete").onclick = function () {

    if (currentNote == null) return;


    notes = notes.filter(function(note) {

        return note.id != currentNote.id;

    });


    localStorage.setItem(
        "notes",
        JSON.stringify(notes)
    );


    currentNote = null;


    document.getElementById("title").value = "";
    document.getElementById("body").innerHTML = "";


    document.getElementById("editor").style.display = "none";
    document.getElementById("noNote").style.display = "block";


    refreshNoteList();

};


// Load saved notes

const savedNotes = localStorage.getItem("notes");


if (savedNotes != null) {

    notes = JSON.parse(savedNotes);

    refreshNoteList();

}


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

    localStorage.setItem(
        "theme",
        "light"
    );

};


document.getElementById("twilightMode").onclick = function () {

    document.body.className = "twilight";

    localStorage.setItem(
        "theme",
        "twilight"
    );

};



// Sidebar

document.getElementById("sidebarToggle").onclick = function () {

    document.getElementById("sidebar")
        .classList.toggle("hidden");

};



// TwoNote markup parser
function parseMarkup(element) {

    console.log("Parser started");

    let html = element.innerHTML;

    console.log("Before:", html);


    html = html.replace(
        /\[Warn\]&lt;(.*?)&gt;/g,
        '<span class="warn">$1</span>'
    );


    html = html.replace(
        /\[Sunset\]&lt;(.*?)&gt;/g,
        '<span class="sunset">$1</span>'
    );


    console.log("After:", html);


    element.innerHTML = html;

}

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

    // Keep the editor selection when clicking the menu.
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

    if (!savedGemRange || savedGemRange.collapsed) {
        return;
    }

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
    if (!savedGemRange || savedGemRange.collapsed) {
        return;
    }

    // Only format text inside the note editor.
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

    // Extract the selection so formatting can span multiple text nodes.
    const contents = savedGemRange.extractContents();

    // Remove existing gem wrappers within the selected fragment.
    contents.querySelectorAll?.("[data-gem]").forEach(node => {
        node.replaceWith(...node.childNodes);
    });

    const gem = document.createElement("span");
    gem.className = `gem gem-${gemId}`;
    gem.dataset.gem = String(gemId);
    gem.appendChild(contents);

    savedGemRange.insertNode(gem);

    // Place the caret after the newly formatted text.
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
        event.shiftKey === false &&
        event.key.toLowerCase() === "g" &&
        !event.altKey
    ) {
        if (document.activeElement === editorBody) {
            event.preventDefault();
            openGemMenu();
        }
    }

    if (event.key === "Escape") {
        closeGemMenu();
    }
});

document.addEventListener("click", event => {
    if (
        !gemMenu.contains(event.target) &&
        event.target !== gemButton
    ) {
        closeGemMenu();
    }
});
