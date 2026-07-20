/* ==========================================================================
   comparison.js — builds the "Four Cities, Four Inclusion Pathways" charts
   from data/city_comparison.csv (see README.md for how to edit the data),
   then drives the chapter navigation and progress bar.
   Requires: data-loader.js and main.js.
   ========================================================================== */

(function () {
  "use strict";

  var statusEl = document.getElementById("data-status");
  var STAT_ACCENTS = ["var(--blue)", "var(--cyan)", "var(--red)", "var(--purple)"];
  var SEVERITY_CLASS = { "1": "h1c", "2": "h2c", "3": "h3c", "4": "h4c" };

  function fmtVal(v) {
    var n = parseFloat(v);
    if (isNaN(n)) return v;
    return (Math.round(n * 10) / 10).toString();
  }
  function hasTimingFlag(row) { return /timing/i.test(row.note || ""); }
  function byCityOrder(a, b) { return CITY_ORDER.indexOf(a.city) - CITY_ORDER.indexOf(b.city); }

  /* ---------- chapter 01: headline stat cards ---------- */
  function renderHeadline(rows) {
    var host = document.getElementById("stat-row");
    if (!host || !rows) return;
    host.innerHTML = rows.map(function (r, i) {
      var num;
      if (r.display) {
        num = '<div class="num">' + esc(r.display).replace(/%/, "<sup>%</sup>").replace(/\+$/, "<sup>+</sup>") + "</div>";
      } else {
        num = '<div class="num count" data-target="' + esc(r.value) + '">0</div>';
      }
      var tag = (r.note || "").split("—")[0].trim() || "Finding";
      return '<div class="stat-card" style="--ac:' + STAT_ACCENTS[i % 4] + '" data-reveal="' + (i ? i + 1 : "") + '">' +
             '<span class="tag">' + esc(tag) + "</span>" + num +
             '<div class="lbl">' + esc(r.indicator_name) + "</div></div>";
    }).join("");
  }

  /* ---------- lollipop charts ---------- */
  function renderLollipop(rows, hostId) {
    var host = document.getElementById(hostId);
    if (!host || !rows) return;
    rows = rows.slice().sort(byCityOrder);
    var max = Math.max.apply(null, rows.map(function (r) { return parseFloat(r.value) || 0; }));
    var scale = max * 1.15 || 1;
    host.innerHTML = rows.map(function (r) {
      var v = parseFloat(r.value) || 0;
      var pc = (v / scale * 100).toFixed(1) + "%";
      var flag = hasTimingFlag(r) ? ' <span class="flag">timing</span>' : "";
      return '<div class="lolli-row" style="--c:' + cityColor(r.city) + ";--w-pc:" + pc + '">' +
             '<span class="city">' + esc(r.city) + flag + "</span>" +
             '<span class="lolli-track"><span class="lolli-line"></span><span class="lolli-dot"></span></span>' +
             '<span class="val">' + fmtVal(r.value) + "<small>%</small></span></div>";
    }).join("");
  }

  /* ---------- chapter 03: archetype card bars + sample lines ---------- */
  function renderArchetypes(archRows, sampleRows) {
    if (archRows) {
      var byCity = groupRows(archRows, "city");
      document.querySelectorAll(".arch-stats[data-city]").forEach(function (host) {
        var rows = byCity[host.getAttribute("data-city")] || [];
        host.innerHTML = rows.map(function (r) {
          var v = parseFloat(r.value) || 0;
          return '<div class="mstat" style="--v:' + v + '%"><div class="top"><span>' + esc(r.indicator_name) +
                 "</span><b>" + fmtVal(r.value) + '%</b></div><div class="bar"><i></i></div></div>';
        }).join("");
      });
    }
    if (sampleRows) {
      var samples = {};
      sampleRows.forEach(function (r) { samples[r.city] = r; });
      document.querySelectorAll(".arch-head .n[data-city]").forEach(function (el) {
        var s = samples[el.getAttribute("data-city")];
        if (s) el.textContent = "N = " + s.value + " households · " + (s.note || s.year);
      });
    }
  }

  /* ---------- chapter 04: universal bottlenecks heat table ---------- */
  var ROW_ICONS = {
    insurance: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    care:      '<path d="M12 20s-7-4.5-7-9.5A4 4 0 0112 8a4 4 0 017 2.5C19 15.5 12 20 12 20z"/>',
    romanian:  '<path d="M21 12a8 8 0 01-8 8H4l2.5-2.5A8 8 0 1121 12z"/><path d="M8.5 11.5h7M8.5 14.5h4"/>',
    housing:   '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    curriculum:'<path d="M12 5c-2-1.5-5-2-8-1v14c3-1 6-.5 8 1 2-1.5 5-2 8-1V4c-3-1-6-.5-8 1z"/><path d="M12 5v14"/>'
  };
  function rowIcon(name) {
    var key = /insurance/i.test(name) ? "insurance" : /care/i.test(name) ? "care" :
              /romanian|language/i.test(name) ? "romanian" : /housing|income/i.test(name) ? "housing" :
              /curriculum|school|enrol/i.test(name) ? "curriculum" : null;
    if (!key) return "";
    return '<svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;display:inline-block;vertical-align:-4px;margin-right:10px">' + ROW_ICONS[key] + "</svg>";
  }
  function renderBottlenecks(rows) {
    var host = document.getElementById("heat-body");
    if (!host || !rows) return;
    // group by indicator (display_order marks the row), keep city order in columns
    var byIndicator = {};
    var order = [];
    rows.forEach(function (r) {
      if (!byIndicator[r.indicator_name]) { byIndicator[r.indicator_name] = {}; order.push(r.indicator_name); }
      byIndicator[r.indicator_name][r.city] = r;
    });
    host.innerHTML = order.map(function (name) {
      var cells = CITY_ORDER.map(function (city) {
        var r = byIndicator[name][city];
        if (!r) return "<td></td>";
        if (!r.value && r.display && !SEVERITY_CLASS[r.severity]) {
          return '<td><span class="note">' + esc(r.display) + "</span></td>";
        }
        var text = r.display || (fmtVal(r.value) + "%");
        var cls = SEVERITY_CLASS[r.severity] || "h4c";
        return '<td><span class="cell ' + cls + '">' + esc(text) + "</span></td>";
      }).join("");
      return '<tr><td class="rowlab">' + rowIcon(name) + esc(name) + "</td>" + cells + "</tr>";
    }).join("");
  }

  /* ---------- chapter 05: housing burden house figures ---------- */
  function renderHouses(rows) {
    var host = document.getElementById("house-grid");
    if (!host || !rows) return;
    host.innerHTML = rows.slice().sort(byCityOrder).map(function (r, i) {
      var v = parseFloat(r.value) || 0;
      var id = "hcl-" + (i + 1);
      var path = "M50 8 L92 42 L84 42 L84 92 L16 92 L16 42 L8 42 Z";
      return '<div class="house-card">' +
        '<div class="cname" style="color:' + cityInkColor(r.city) + '">' + esc(r.city).toUpperCase() + "</div>" +
        '<div class="house-fig"><svg viewBox="0 0 100 100" role="img" aria-label="' + esc(r.city) + ": " + fmtVal(r.value) + '% spend more than half of income on housing">' +
        '<defs><clipPath id="' + id + '"><path d="' + path + '"/></clipPath></defs>' +
        '<rect clip-path="url(#' + id + ')" width="100" height="100" fill="var(--paper-3)"/>' +
        '<rect class="hf" clip-path="url(#' + id + ')" width="100" height="100" fill="' + cityColor(r.city) + '" opacity=".87" ' +
        'style="transform-origin:50px 92px;transform:scaleY(0);transition:transform 1.3s cubic-bezier(.22,.61,.36,1)" data-fill="' + (v / 100) + '"/>' +
        '<path d="' + path + '" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/></svg></div>' +
        '<div class="pct">' + fmtVal(r.value) + '%</div>' +
        '<div class="cap">spend &gt;50% of income on housing &amp; utilities</div></div>';
    }).join("");
  }

  /* ---------- dot plots ---------- */
  function renderDotplot(rows, hostId) {
    var host = document.getElementById(hostId);
    if (!host || !rows) return;
    host.innerHTML = rows.map(function (r) {
      var v = parseFloat(r.value) || 0;
      return '<div class="dp-row" style="--c:' + cityColor(r.city) + ";--v:" + v + '%">' +
             '<span class="city">' + esc(r.city) + "</span>" +
             '<span class="dp-track"><span class="dp-dot"></span></span>' +
             '<span class="lab">' + fmtVal(r.value) + "% " + esc(r.indicator_name) + "</span></div>";
    }).join("");
  }

  /* ---------- chapter 06: slope chart (built as SVG) ---------- */
  function renderSlope(rows) {
    var host = document.getElementById("slope-chart");
    if (!host || !rows) return;
    var byCity = groupRows(rows, "city");
    function y(v) { return Math.max(30, 270 - v * 2.9); }

    var cities = Object.keys(byCity).map(function (city) {
      var before = null, now = null, note = "";
      byCity[city].forEach(function (r) {
        var v = parseFloat(r.value);
        if (/before/i.test(r.indicator_name)) { before = isNaN(v) ? null : v; note = note || r.note; }
        else { now = isNaN(v) ? null : v; }
      });
      return { city: city, before: before, now: now, note: note };
    }).filter(function (c) { return c.now !== null; });

    // simple label-collision dodge on the left column
    var lefts = cities.filter(function (c) { return c.before !== null; })
      .map(function (c) { return { c: c, ly: y(c.before) + 4 }; })
      .sort(function (a, b) { return a.ly - b.ly; });
    for (var i = 1; i < lefts.length; i++) {
      if (lefts[i].ly - lefts[i - 1].ly < 16) lefts[i - 1].ly = lefts[i].ly - 16;
    }

    var svg = ['<svg viewBox="0 0 640 300" role="img" aria-label="Employment before displacement versus employment now, by city">'];
    svg.push('<line x1="140" y1="30" x2="140" y2="268" stroke="var(--line)" stroke-width="1"/>');
    svg.push('<line x1="500" y1="30" x2="500" y2="268" stroke="var(--line)" stroke-width="1"/>');
    svg.push('<text class="slope-axis" x="140" y="292" text-anchor="middle">Before · Ukraine</text>');
    svg.push('<text class="slope-axis" x="500" y="292" text-anchor="middle">Now · Moldova</text>');

    var delay = 0;
    cities.forEach(function (c) {
      if (c.before !== null) {
        svg.push('<path class="slope-line" d="M140 ' + y(c.before).toFixed(1) + " L500 " + y(c.now).toFixed(1) +
                 '" stroke="' + cityColor(c.city) + '" style="transition-delay:' + delay + 's"/>');
        svg.push('<circle cx="140" cy="' + y(c.before).toFixed(1) + '" r="6" fill="' + cityColor(c.city) + '" stroke="#fff" stroke-width="2"/>');
        delay += 0.15;
      }
      svg.push('<circle cx="500" cy="' + y(c.now).toFixed(1) + '" r="6" fill="' + cityColor(c.city) + '" stroke="#fff" stroke-width="2"/>');
    });
    lefts.forEach(function (l) {
      svg.push('<text class="slope-val" x="128" y="' + l.ly.toFixed(1) + '" text-anchor="end" fill="' + cityInkColor(l.c.city) + '">' + fmtVal(l.c.before) + "%</text>");
    });
    cities.forEach(function (c) {
      var star = c.before === null ? "*" : "";
      svg.push('<text class="slope-val" x="512" y="' + (y(c.now) + 4).toFixed(1) + '" fill="' + cityInkColor(c.city) + '">' + fmtVal(c.now) + "% " + esc(c.city) + star + "</text>");
    });
    svg.push("</svg>");
    host.innerHTML = svg.join("");
  }

  /* ---------- care band cells ---------- */
  function renderCare(rows) {
    var host = document.getElementById("care-cells");
    if (!host || !rows) return;
    host.innerHTML = rows.slice().sort(byCityOrder).map(function (r) {
      return '<div class="care-cell"><div class="v">' + fmtVal(r.value) + '%</div><div class="c">' + esc(r.city).toUpperCase() + "</div></div>";
    }).join("");
  }

  /* ---------- chapter 07: service panel mini-bars ---------- */
  function renderMiniBars(groups) {
    document.querySelectorAll(".mini-bars[data-group]").forEach(function (host) {
      var rows = groups[host.getAttribute("data-group")];
      if (!rows) return;
      host.innerHTML = rows.slice().sort(byCityOrder).map(function (r) {
        var v = parseFloat(r.value) || 0;
        var shown = r.display || (fmtVal(r.value) + "%");
        return '<div class="mb" style="--c:' + cityColor(r.city) + ";--v:" + v + '%"><span>' + esc(r.city) +
               '</span><span class="t"><i></i></span><span class="v">' + esc(shown) + "</span></div>";
      }).join("");
    });
  }

  /* ---------- load & render everything ---------- */
  loadCSV("data/city_comparison.csv").then(function (rows) {
    var groups = groupRows(rows, "indicator_group");
    renderHeadline(groups.headline);
    renderLollipop(groups.employment, "lolli-employment");
    renderLollipop(groups.aid_dependence, "lolli-aid");
    renderLollipop(groups.employment_income, "lolli-empincome");
    renderArchetypes(groups.archetype, groups.sample);
    renderBottlenecks(groups.bottleneck);
    renderHouses(groups.housing_burden);
    renderDotplot(groups.housing_informality, "dp-informality");
    renderDotplot(groups.housing_tenure, "dp-tenure");
    renderSlope(groups.employment_slope);
    renderCare(groups.care_barrier);
    renderMiniBars(groups);
    if (statusEl) statusEl.hidden = true;
    if (window.CoS && window.CoS.refreshMotion) window.CoS.refreshMotion();
  }).catch(function (err) {
    showDataError(statusEl, err);
  });

  /* ---------- chapter nav: highlight active link + progress bar ---------- */
  var nav = document.getElementById("chapnav");
  var bar = document.getElementById("progress");
  if (nav) {
    var links = nav.querySelectorAll('a[href^="#"]');
    var sections = Array.prototype.map.call(links, function (a) {
      return document.querySelector(a.getAttribute("href"));
    });
    function onScroll() {
      var y = window.scrollY || document.documentElement.scrollTop;
      if (bar) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (h > 0 ? (y / h * 100) : 0) + "%";
      }
      var current = -1;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i] && sections[i].getBoundingClientRect().top <= window.innerHeight * 0.38) current = i;
      }
      Array.prototype.forEach.call(links, function (a, i) { a.classList.toggle("active", i === current); });
      if (current >= 0) {
        var active = links[current], box = active.parentElement;
        var r = active.offsetLeft - box.clientWidth / 2 + active.clientWidth / 2;
        if (box.scrollTo) box.scrollTo({ left: r, behavior: window.CoS.reducedMotion ? "auto" : "smooth" });
      }
    }
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (!ticking) { requestAnimationFrame(function () { onScroll(); ticking = false; }); ticking = true; }
    }, { passive: true });
    onScroll();
  }
})();
