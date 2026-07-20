/* ==========================================================================
   action-bank.js — loads data/action_bank.csv, renders the action cards and
   powers the sector / city / status / scale-up filters and keyword search.
   Requires: data-loader.js and main.js. See README.md for the data workflow.
   ========================================================================== */

(function () {
  "use strict";

  var statusEl = document.getElementById("data-status");
  var grid = document.getElementById("actions-grid");
  var countEl = document.getElementById("result-count");
  if (!grid) return;

  /* Sector accent colours: [bar/tint colour, readable ink colour] */
  var SECTOR_COLORS = {
    "Governance & Coordination":        ["var(--blue)",   "var(--blue-deep)"],
    "Access to Services & Information": ["var(--cyan)",   "#1273A0"],
    "Social Protection & Care":         ["var(--purple)", "#5C50B8"],
    "Health":                           ["var(--red)",    "#A83E2C"],
    "Education & Childcare":            ["var(--yellow)", "#8A6208"],
    "Housing & Infrastructure":         ["var(--brown)",  "#7C3C36"],
    "Mobility":                         ["var(--cyan)",   "#1273A0"],
    "Livelihoods & Employment":         ["var(--green)",  "#177A54"],
    "Food Security & Livelihoods":      ["var(--green)",  "#177A54"],
    "Women's Economic Empowerment":     ["var(--purple)", "#5C50B8"],
    "Digital Inclusion & Skills":       ["var(--cyan)",   "#1273A0"],
    "Social Cohesion":                  ["var(--yellow)", "#8A6208"],
    "Protection":                       ["var(--red)",    "#A83E2C"]
  };
  function sectorColor(s) { return (SECTOR_COLORS[s] || ["var(--blue)", "var(--blue-deep)"]); }

  /* Coarse scale-up category derived from the free-text scale_up_potential field */
  function scaleCategory(text) {
    var t = (text || "").toLowerCase();
    if (!t) return "";
    if (t.indexOf("high") === 0) return "High";
    if (t.indexOf("medium") === 0) return "Medium";
    if (t.indexOf("low") === 0) return "Low";
    if (t.indexOf("adaptable") !== -1) return "Adaptable";
    return "Other";
  }

  var actions = [];
  var controls = {
    q:      document.getElementById("f-search"),
    sector: document.getElementById("f-sector"),
    city:   document.getElementById("f-city"),
    status: document.getElementById("f-status"),
    scale:  document.getElementById("f-scale"),
    reset:  document.getElementById("f-reset")
  };

  function fillSelect(select, values, allLabel) {
    if (!select) return;
    select.innerHTML = '<option value="">' + allLabel + "</option>" +
      values.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + "</option>"; }).join("");
  }

  function fact(label, value) {
    if (!value) return "";
    return '<div class="fact"><span class="k">' + esc(label) + '</span><span class="v">' + esc(value) + "</span></div>";
  }

  function renderCard(a) {
    var col = sectorColor(a.sector);
    var statusClass = "st-" + (a.status || "concept").toLowerCase().replace(/[^a-z]+/g, "-");
    var longBlock = "";
    if (a.long_description && a.long_description !== a.short_description) {
      longBlock =
        '<button class="more" type="button" aria-expanded="false">Full description ' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>' +
        '<div class="long">' + esc(a.long_description) + "</div>";
    }
    return '<article class="action-card" style="--sc:' + col[0] + ";--sci:" + col[1] + '" data-id="' + esc(a.action_id) + '">' +
      '<div class="top"></div>' +
      '<div class="body">' +
        '<div class="meta-chips">' +
          '<span class="mchip sector">' + esc(a.sector) + "</span>" +
          '<span class="mchip city">' + esc(a.city) + "</span>" +
          (a.status ? '<span class="mchip status ' + statusClass + '">' + esc(a.status) + "</span>" : "") +
        "</div>" +
        "<h3>" + esc(a.action_title) + "</h3>" +
        '<span class="id">' + esc(a.action_id) + "</span>" +
        '<p class="desc">' + esc(a.short_description) + "</p>" +
        '<div class="facts">' +
          fact("Target group", a.target_group) +
          fact("Owner", a.implementation_owner) +
          fact("Partners", a.partners) +
          fact("Indicative cost", a.indicative_cost || "To be confirmed") +
          fact("Timeline", a.timeline) +
          fact("Scale-up", a.scale_up_potential) +
        "</div>" +
        longBlock +
      "</div>" +
      '<div class="foot"><span>' + esc(a.source_lap || "") + "</span></div>" +
    "</article>";
  }

  function matches(a, f) {
    if (f.sector && a.sector !== f.sector) return false;
    if (f.city && a.city !== f.city) return false;
    if (f.status && (a.status || "").toLowerCase() !== f.status.toLowerCase()) return false;
    if (f.scale && a._scale !== f.scale) return false;
    if (f.q) {
      var hay = (a.action_title + " " + a.short_description + " " + a.long_description + " " +
                 a.tags + " " + a.sector + " " + a.city + " " + a.partners + " " +
                 a.implementation_owner + " " + a.target_group).toLowerCase();
      var terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < terms.length; i++) {
        if (hay.indexOf(terms[i]) === -1) return false;
      }
    }
    return true;
  }

  function currentFilters() {
    return {
      q:      controls.q      ? controls.q.value.trim() : "",
      sector: controls.sector ? controls.sector.value : "",
      city:   controls.city   ? controls.city.value : "",
      status: controls.status ? controls.status.value : "",
      scale:  controls.scale  ? controls.scale.value : ""
    };
  }

  function render() {
    var f = currentFilters();
    var shown = actions.filter(function (a) { return matches(a, f); });
    if (countEl) {
      countEl.textContent = shown.length + " of " + actions.length + " actions shown";
    }
    if (!shown.length) {
      grid.innerHTML = '<div class="empty-state"><b>No actions match the current filters.</b><br>' +
        "Try clearing a filter or using a broader search term.</div>";
      return;
    }
    grid.innerHTML = shown.map(renderCard).join("");
  }

  /* Expand/collapse long descriptions (event delegation) */
  grid.addEventListener("click", function (e) {
    var btn = e.target.closest(".more");
    if (!btn) return;
    var card = btn.closest(".action-card");
    var open = card.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  loadCSV("data/action_bank.csv").then(function (rows) {
    actions = rows.filter(function (r) { return r.action_title; });
    actions.forEach(function (a) { a._scale = scaleCategory(a.scale_up_potential); });
    actions.sort(function (a, b) { return (parseFloat(a.display_order) || 0) - (parseFloat(b.display_order) || 0); });

    function uniq(key, mapFn) {
      var set = {};
      actions.forEach(function (a) {
        var v = mapFn ? mapFn(a) : a[key];
        if (v) set[v] = true;
      });
      return Object.keys(set).sort();
    }
    fillSelect(controls.sector, uniq("sector"), "All sectors");
    fillSelect(controls.city, uniq("city"), "All cities");
    fillSelect(controls.status, uniq("status", function (a) { return (a.status || "").toLowerCase(); }), "All statuses");
    fillSelect(controls.scale, uniq(null, function (a) { return a._scale; }), "All scale-up levels");

    ["sector", "city", "status", "scale"].forEach(function (k) {
      if (controls[k]) controls[k].addEventListener("change", render);
    });
    if (controls.q) controls.q.addEventListener("input", render);
    if (controls.reset) controls.reset.addEventListener("click", function () {
      if (controls.q) controls.q.value = "";
      ["sector", "city", "status", "scale"].forEach(function (k) { if (controls[k]) controls[k].value = ""; });
      render();
    });

    if (statusEl) statusEl.hidden = true;
    render();
  }).catch(function (err) {
    showDataError(statusEl, err);
  });
})();
