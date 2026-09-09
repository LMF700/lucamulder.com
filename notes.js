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
