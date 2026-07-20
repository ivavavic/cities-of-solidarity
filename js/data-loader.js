/* ==========================================================================
   data-loader.js — shared helpers for loading the CSV data files.
   The website reads /data/*.csv at runtime (the .xlsx files are the
   human-editable masters; see README.md for the update workflow).
   ========================================================================== */

/**
 * Minimal RFC-4180-style CSV parser.
 * Handles quoted fields, embedded commas, embedded newlines and "" escapes.
 * Returns an array of row objects keyed by the header row.
 */
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;
  // Normalise BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;      // CRLF
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }

  if (!rows.length) return [];
  var header = rows[0].map(function (h) { return h.trim(); });
  return rows.slice(1).map(function (r) {
    var obj = {};
    header.forEach(function (h, idx) { obj[h] = (r[idx] !== undefined ? r[idx] : "").trim(); });
    return obj;
  });
}

/**
 * Fetch and parse a CSV file. Relative URLs keep the site working when
 * GitHub Pages serves it from a project sub-path.
 * Rejects with a helpful message when opened via file:// (see README).
 */
function loadCSV(url) {
  return fetch(url).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status + " while loading " + url);
    return res.text();
  }).then(parseCSV).catch(function (err) {
    if (location.protocol === "file:") {
      throw new Error(
        "Data files cannot be loaded when the page is opened directly from disk (file://). " +
        "Start a small local server instead — e.g. run “python -m http.server” in the project " +
        "folder, or use the VS Code Live Server extension. See README.md."
      );
    }
    throw err;
  });
}

/** Group an array of row objects by a column value, preserving display_order. */
function groupRows(rows, column) {
  var groups = {};
  rows.forEach(function (r) {
    var key = r[column] || "";
    (groups[key] = groups[key] || []).push(r);
  });
  Object.keys(groups).forEach(function (k) {
    groups[k].sort(function (a, b) {
      return (parseFloat(a.display_order) || 0) - (parseFloat(b.display_order) || 0);
    });
  });
  return groups;
}

/** Escape a string for safe insertion into innerHTML. */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** City accent colours (must match the CSS custom properties). */
var CITY_COLORS = {
  "Comrat":   { c: "var(--comrat)",   ink: "var(--comrat-ink)" },
  "Bălți":    { c: "var(--balti)",    ink: "var(--balti-ink)" },
  "Chișinău": { c: "var(--chisinau)", ink: "var(--chisinau-ink)" },
  "Cahul":    { c: "var(--cahul)",    ink: "var(--cahul-ink)" }
};
var CITY_ORDER = ["Comrat", "Bălți", "Chișinău", "Cahul"];

function cityColor(city)    { return (CITY_COLORS[city] || { c: "var(--blue)" }).c; }
function cityInkColor(city) { return (CITY_COLORS[city] || { ink: "var(--blue-deep)" }).ink; }

/** Show a data-status element in its error state. */
function showDataError(el, err) {
  if (!el) return;
  el.hidden = false;
  el.classList.add("error");
  el.textContent = "Could not load the data file. " + (err && err.message ? err.message : "");
}
