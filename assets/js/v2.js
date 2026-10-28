/* Loqelo version 2: page-specific behaviour. Shared features (language, form, analytics,
   video, timeline) come from app.js; this file only adds what the V2 layout needs. */
(function () {
  "use strict";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BASE = (window.LOQELO_CONFIG && window.LOQELO_CONFIG.base) || "";
  var THUMBS = ["v2-req-lawn.webp", "v2-req-tap.webp", "v2-req-boxes.webp"];
  function t(k) { return window.LoqeloI18n ? window.LoqeloI18n.t(k) : ""; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- Hero strip: example requests, as the platform would read them ---------- */
  var strip = $("[data-strip]"), track = strip && $(".v2strip__track", strip);
  var idx = 0, timer = null, paused = false, pauseBtn = null;
  function renderStrip() {
    if (!track) return;
    var items = t("demo"); if (!Array.isArray(items)) return;
    track.innerHTML = items.map(function (it, i) {
      var text = it.parts.map(function (p) { return typeof p === "string" ? esc(p) : '<mark class="c-' + p.c + '">' + esc(p.h) + "</mark>"; }).join("");
      var chips = it.chips.map(function (c) { return '<span class="svc c-' + c[1] + '"><i><svg aria-hidden="true"><use href="#i-' + c[2] + '"/></svg></i>' + esc(c[0]) + "</span>"; }).join("");
      return '<article class="reqcard" aria-roledescription="slide" aria-label="' + (i + 1) + " / " + items.length + '">' +
        '<img src="' + BASE + "assets/img/" + THUMBS[i % THUMBS.length] + '" width="320" height="240" alt="" loading="lazy">' +
        '<div class="reqcard__body"><p class="reqcard__label">' + esc(t("v2.exampleLabel")) + '</p><p class="reqcard__text">“' + text + '”</p><div class="reqcard__chips">' + chips + "</div></div></article>";
    }).join("");
    go(idx, true);
  }
  function go(i, instant) {
    var cards = $$(".reqcard", track); if (!cards.length) return;
    idx = (i + cards.length) % cards.length;
    var x = cards[idx].offsetLeft - cards[0].offsetLeft;
    track.style.transition = instant || reduceMotion ? "none" : "";
    track.style.transform = "translateX(" + (-x) + "px)";
    cards.forEach(function (c, j) { c.classList.toggle("is-current", j === idx); c.classList.toggle("is-past", j < idx); c.setAttribute("aria-hidden", String(j !== idx && window.innerWidth < 640)); });
  }
  function schedule() { clearTimeout(timer); if (!paused && !reduceMotion) timer = setTimeout(function () { go(idx + 1); schedule(); }, 5000); }
  if (strip) {
    // A visible pause control: the strip moves on its own, so people must be able to stop it.
    pauseBtn = document.createElement("button");
    pauseBtn.type = "button"; pauseBtn.className = "v2strip__pause";
    pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M9 6v12M15 6v12"/><path class="i-play" d="M8 5.5v13l10.5-6.5z"/></svg>';
    function setPaused(p) { paused = p; pauseBtn.setAttribute("aria-pressed", String(p)); pauseBtn.setAttribute("aria-label", t(p ? "a11y.play" : "a11y.pause") || (p ? "Play" : "Pause")); strip.classList.toggle("is-paused", p); schedule(); }
    pauseBtn.addEventListener("click", function () { setPaused(!paused); });
    strip.appendChild(pauseBtn);
    if (reduceMotion) { pauseBtn.hidden = true; }
    strip.addEventListener("mouseenter", function () { clearTimeout(timer); });
    strip.addEventListener("mouseleave", schedule);
    strip.addEventListener("focusin", function () { clearTimeout(timer); });
    strip.addEventListener("focusout", schedule);
    window.addEventListener("resize", function () { go(idx, true); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) clearTimeout(timer); else schedule(); });
    setPaused(false);
  }

  /* ---------- Seal: brand line set around the Q mark ---------- */
  function renderSeal() {
    var tp = $("[data-seal]"); if (!tp) return;
    var base = t("v2.seal") || "Everything your place needs • Loqelo • ", s = base;
    while (s.length < 58) s += base;
    tp.textContent = s;
    tp.setAttribute("textLength", "486"); tp.setAttribute("lengthAdjust", "spacingAndGlyphs");
  }

  /* ---------- Links that point back to the main folder ---------- */
  function fixLinks() { $$('a[href="privacy.html"]').forEach(function (a) { a.setAttribute("href", BASE + "privacy.html"); }); }

  document.addEventListener("loqelo:lang", function () { renderStrip(); renderSeal(); fixLinks(); if (pauseBtn) pauseBtn.setAttribute("aria-label", t(paused ? "a11y.play" : "a11y.pause")); schedule(); });

  /* ---------- Reveal cards that start below the fold ---------- */
  if (!reduceMotion && "IntersectionObserver" in window && !location.hash) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -10% 0px" });
    var vh = window.innerHeight;
    [".v2about__photo", ".facts", ".svccard", ".v2step", ".audcard", ".v2launch__box"].forEach(function (sel) {
      $$(sel).forEach(function (el, i) {
        if (el.getBoundingClientRect().top < vh) return;
        el.classList.add("rv"); el.style.setProperty("--d", (i % 4) * 90 + "ms"); io.observe(el);
      });
    });
  }
})();
