/* Loqelo version 3: page-specific behaviour. Shared features come from app.js. */
(function () {
  "use strict";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BASE = (window.LOQELO_CONFIG && window.LOQELO_CONFIG.base) || "";
  function t(k) { return window.LoqeloI18n ? window.LoqeloI18n.t(k) : ""; }

  // Ticker: duplicate the list once so the loop is seamless.
  var track = $("[data-ticker]");
  function fillTicker() {
    if (!track) return;
    $$(".is-clone", track).forEach(function (n) { n.remove(); });
    $$("span", track).forEach(function (s) { var c = s.cloneNode(true); c.classList.add("is-clone"); c.removeAttribute("data-i18n"); track.appendChild(c); });
  }

  // Sticker: the launch badge text set around a circle.
  function renderSticker() {
    var tp = $("[data-sticker]"); if (!tp) return;
    var base = (t("hero.badge") || "Launching February 2027") + " • ", s = base;
    while (s.length < 48) s += base;
    tp.textContent = s;
    tp.setAttribute("textLength", "462"); tp.setAttribute("lengthAdjust", "spacingAndGlyphs");
  }

  function fixLinks() { $$('a[href="privacy.html"]').forEach(function (a) { a.setAttribute("href", BASE + "privacy.html"); }); }

  document.addEventListener("loqelo:lang", function () { fillTicker(); renderSticker(); fixLinks(); });

  // Reveal blocks that start below the fold.
  if (!reduceMotion && "IntersectionObserver" in window && !location.hash) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -10% 0px" });
    var vh = window.innerHeight;
    [".v3cat", ".v3cats__photo", ".v3row", ".v3step", ".v3film .player", ".v3launch__card"].forEach(function (sel) {
      $$(sel).forEach(function (el, i) {
        if (el.getBoundingClientRect().top < vh) return;
        el.classList.add("rv"); el.style.setProperty("--d", (i % 4) * 90 + "ms"); io.observe(el);
      });
    });
  }
})();
