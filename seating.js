(function () {
  "use strict";

  var SHEET_ID = "1uYER1VkLKmOkxeB8sdENLGrdn1zKniywxEtBZrkctfA";
  var CSV_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/export?format=csv&gid=0";

  var form = document.getElementById("seat-form");
  var resultEl = document.getElementById("seat-result");
  var firstInput = document.getElementById("first-name");
  var lastInput = document.getElementById("last-name");

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

  function findColumn(headers, keywords) {
    var normalizedHeaders = headers.map(normalize);
    for (var k = 0; k < keywords.length; k++) {
      var idx = normalizedHeaders.findIndex(function (h) {
        return h.indexOf(keywords[k]) !== -1;
      });
      if (idx !== -1) return idx;
    }
    return -1;
  }

  function loadGuests() {
    return fetch(CSV_URL).then(function (response) {
      if (!response.ok) throw new Error("Failed to load guest list");
      return response.text();
    }).then(function (text) {
      var rows = parseCSV(text);
      if (rows.length < 2) return [];

      var headers = rows[0];
      var cols = {
        first: findColumn(headers, ["first name", "first"]),
        last: findColumn(headers, ["last name", "surname", "last"]),
        table: findColumn(headers, ["table number", "table"]),
        starter: findColumn(headers, ["starter", "appetiser", "appetizer", "first course"]),
        main: findColumn(headers, ["main course", "main"])
      };

      return rows.slice(1).map(function (r) {
        return {
          first: cols.first !== -1 ? (r[cols.first] || "").trim() : "",
          last: cols.last !== -1 ? (r[cols.last] || "").trim() : "",
          table: cols.table !== -1 ? (r[cols.table] || "").trim() : "",
          starter: cols.starter !== -1 ? (r[cols.starter] || "").trim() : "",
          main: cols.main !== -1 ? (r[cols.main] || "").trim() : ""
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
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var first = normalize(firstInput.value);
    var last = normalize(lastInput.value);
    if (!first || !last) return;

    renderLoading();

    getGuests().then(function (guests) {
      var match = guests.find(function (g) {
        return normalize(g.first) === first && normalize(g.last) === last;
      });
      if (match) {
        renderResult(match);
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
