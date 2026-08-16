(function () {
  "use strict";

  var SHEET_ID = "1uYER1VkLKmOkxeB8sdENLGrdn1zKniywxEtBZrkctfA";
  // The plain export?format=csv endpoint doesn't send CORS headers, so
  // fetch() fails from a different origin even though the sheet is public.
  // The gviz endpoint is built for cross-origin embedding and sends them,
  // so it's tried first; the export endpoint is kept as a fallback.
  var CSV_URLS = [
    "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:csv&gid=0",
    "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/export?format=csv&gid=0"
  ];

  var form = document.getElementById("seat-form");
  var resultEl = document.getElementById("seat-result");
  var firstInput = document.getElementById("first-name");

  var guestsPromise = null;

  function normalize(value) {
    return (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      var next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\r") {
        // skip
      } else if (char === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += char;
      }
    }

    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== "";
      });
    });
  }

  // The sheet's header row labels don't line up with where the actual
  // data lives, so we read by fixed position rather than trusting the
  // header text: A-D are name/menu, E is a dietary note, F is table number.
  var COLUMNS = { first: 0, last: 1, starter: 2, main: 3, dietary: 4, table: 5 };

  function fetchCSV(urls) {
    return fetch(urls[0]).then(function (response) {
      if (!response.ok) throw new Error("Failed to load guest list");
      return response.text();
    }).catch(function (err) {
      if (urls.length <= 1) throw err;
      return fetchCSV(urls.slice(1));
    });
  }

  function loadGuests() {
    return fetchCSV(CSV_URLS).then(function (text) {
      var rows = parseCSV(text);
      if (rows.length < 2) return [];

      return rows.slice(1).map(function (r) {
        return {
          first: (r[COLUMNS.first] || "").trim(),
          last: (r[COLUMNS.last] || "").trim(),
          starter: (r[COLUMNS.starter] || "").trim(),
          main: (r[COLUMNS.main] || "").trim(),
          dietary: (r[COLUMNS.dietary] || "").trim(),
          table: (r[COLUMNS.table] || "").trim()
        };
      });
    });
  }

  function getGuests() {
    if (!guestsPromise) guestsPromise = loadGuests();
    return guestsPromise;
  }

  function renderLoading() {
    resultEl.className = "seat-result loading";
    resultEl.textContent = "Looking you up…";
  }

  function renderError() {
    resultEl.className = "seat-result not-found";
    resultEl.textContent = "We couldn't load the seating list. Please check your connection and try again, or ask a member of the wedding party.";
  }

  function renderNotFound() {
    resultEl.className = "seat-result not-found";
    resultEl.textContent = "We couldn't find that name. Please check the spelling, or ask a member of the wedding party.";
  }

  function renderChoices(matches, promptText) {
    resultEl.className = "seat-result";
    resultEl.textContent = "";

    var prompt = document.createElement("p");
    prompt.className = "result-name";
    prompt.textContent = promptText;
    resultEl.appendChild(prompt);

    var list = document.createElement("div");
    list.className = "name-choices";

    matches.forEach(function (guest) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "name-choice";
      button.textContent = guest.first + " " + guest.last;
      button.addEventListener("click", function () {
        renderResult(guest);
      });
      list.appendChild(button);
    });

    resultEl.appendChild(list);
  }

  function addMenuRow(label, value) {
    if (!value) return;
    var row = document.createElement("div");
    row.className = "menu-row";

    var labelEl = document.createElement("span");
    labelEl.className = "menu-label";
    labelEl.textContent = label;

    var valueEl = document.createElement("span");
    valueEl.className = "menu-value";
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    resultEl.appendChild(row);
  }

  function renderResult(guest) {
    resultEl.className = "seat-result";
    resultEl.textContent = "";

    var name = document.createElement("p");
    name.className = "result-name";
    name.textContent = guest.first + " " + guest.last;
    resultEl.appendChild(name);

    var table = document.createElement("p");
    table.className = "result-table";
    table.textContent = guest.table ? "Table " + guest.table : "Table to be confirmed";
    resultEl.appendChild(table);

    addMenuRow("Starter", guest.starter);
    addMenuRow("Main", guest.main);

    if (guest.dietary) {
      var dietaryNote = document.createElement("p");
      dietaryNote.className = "dietary-note";
      dietaryNote.textContent = "We've noted the following dietary requirements: " + guest.dietary;
      resultEl.appendChild(dietaryNote);

      var dietaryFollowUp = document.createElement("p");
      dietaryFollowUp.className = "dietary-note";
      dietaryFollowUp.textContent = "Please do kindly check with our servers on the day, who will be happy to confirm what's suitable for your requirements.";
      resultEl.appendChild(dietaryFollowUp);
    }

    var note = document.createElement("p");
    note.className = "seat-note";
    note.textContent = "Cake and desserts will be served canapé style later in the evening. We hope you enjoy your meal!";
    resultEl.appendChild(note);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var first = normalize(firstInput.value);
    if (!first) return;

    renderLoading();

    getGuests().then(function (guests) {
      var exactMatches = guests.filter(function (g) {
        return normalize(g.first) === first;
      });

      if (exactMatches.length === 1) {
        renderResult(exactMatches[0]);
        return;
      }

      if (exactMatches.length > 1) {
        renderChoices(exactMatches, "A few guests share that first name — which one are you?");
        return;
      }

      // Match in either direction: typed text may be the start of a longer
      // recorded name ("Clio" -> "Cliodhna"), or the recorded name may be a
      // shortened form of what was typed ("Raphael" -> "Raph").
      var partialMatches = guests.filter(function (g) {
        var guestFirst = normalize(g.first);
        if (!guestFirst) return false;
        return guestFirst.indexOf(first) === 0 || first.indexOf(guestFirst) === 0;
      });

      if (partialMatches.length > 0) {
        renderChoices(partialMatches, "We couldn't find an exact match. Did you mean:");
      } else {
        renderNotFound();
      }
    }).catch(function () {
      renderError();
    });
  });

  // Warm the guest list cache on load so the first search feels instant.
  getGuests().catch(function () {});
})();
