/* Loqelo pre-launch site. Vanilla JS, no dependencies. */
(function () {
  "use strict";

  var CFG = Object.assign({
    ga4Id: "", turnstileSiteKey: "", endpoint: "api/subscribe.php", previewMode: false,
    languages: ["en", "pl", "nl"], defaultLanguage: "en", launch: { year: 2027, month: 2 }, base: ""
  }, window.LOQELO_CONFIG || {});

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* One passive scroll listener drives every scroll-linked effect, once per frame. */
  var frameFns = [], ticking = false;
  function onFrame(fn) { frameFns.push(fn); }
  function runFrame() { ticking = false; for (var i = 0; i < frameFns.length; i++) frameFns[i](); }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(runFrame); } }, { passive: true });
  window.addEventListener("resize", function () { if (!ticking) { ticking = true; requestAnimationFrame(runFrame); } });

  /* =====================================================
     Analytics (GA4, loaded only after consent)
     Events never contain emails, countries typed or any form value.
     ===================================================== */
  var gaReady = false;
  function loadGA() {
    if (gaReady || !CFG.ga4Id) return;
    gaReady = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    window.gtag("js", new Date());
    window.gtag("config", CFG.ga4Id, { allow_google_signals: false, allow_ad_personalization_signals: false, page_location: location.origin + location.pathname, language: root.lang });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CFG.ga4Id);
    document.head.appendChild(s);
  }
  function track(name, params) {
    if (CFG.previewMode && window.console) console.debug("[analytics]", name, params || {});
    if (gaReady && window.gtag) window.gtag("event", name, params || {});
  }

  function consentInit() {
    var banner = $(".cookie");
    var saved = null;
    try { saved = JSON.parse(store.get("loqelo_consent") || "null"); } catch (e) {}
    if (saved && saved.v === "granted") loadGA();
    if (CFG.ga4Id && !saved) banner.hidden = false;
    $$("[data-consent]", banner).forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-consent");
        store.set("loqelo_consent", JSON.stringify({ v: v, t: new Date().toISOString() }));
        banner.hidden = true;
        if (v === "granted") loadGA();
        else if (gaReady) { location.reload(); }
      });
    });
    $$("[data-cookie-prefs]").forEach(function (b) {
      b.addEventListener("click", function () { banner.hidden = false; $("[data-consent=granted]", banner).focus(); });
    });
  }

  /* =====================================================
     i18n
     ===================================================== */
  var dict = {}, base = null, lang = root.getAttribute("data-lang") || CFG.defaultLanguage;
  var cache = {};
  function fetchLang(l) {
    if (cache[l]) return Promise.resolve(cache[l]);
    return fetch(CFG.base + "i18n/" + l + ".json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("i18n " + r.status);
      return r.json();
    }).then(function (j) { cache[l] = j; return j; });
  }
  function merge(a, b) {
    var o = Array.isArray(a) ? a.slice() : Object.assign({}, a);
    Object.keys(b || {}).forEach(function (k) {
      o[k] = (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a && typeof a[k] === "object") ? merge(a[k], b[k]) : b[k];
    });
    return o;
  }
  function t(key) {
    var v = key.split(".").reduce(function (o, k) { return o && o[k]; }, dict);
    return v == null ? key.split(".").reduce(function (o, k) { return o && o[k]; }, base || {}) : v;
  }
  function applyI18n() {
    $$("[data-i18n]").forEach(function (el) { var v = t(el.getAttribute("data-i18n")); if (typeof v === "string") el.textContent = v; });
    $$("[data-i18n-html]").forEach(function (el) { var v = t(el.getAttribute("data-i18n-html")); if (typeof v === "string") el.innerHTML = v; });
    $$("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var p = pair.split(":"); var v = t(p[1]);
        if (typeof v === "string") el.setAttribute(p[0], v);
      });
    });
    document.title = t("meta.title");
    root.lang = lang;
    root.setAttribute("data-lang", lang);
    root.dir = (dict._meta && dict._meta.dir) || "ltr";
    $(".lang__cur").textContent = lang.toUpperCase();
    renderLangUI();
    window.LoqeloI18n = { t: t, lang: lang };
    document.dispatchEvent(new CustomEvent("loqelo:lang"));
  }
  function setLang(l, user) {
    if (CFG.languages.indexOf(l) < 0) l = CFG.defaultLanguage;
    var p = Promise.all([fetchLang(CFG.defaultLanguage), l === CFG.defaultLanguage ? null : fetchLang(l).catch(function () { return null; })]);
    return p.then(function (r) {
      base = r[0];
      if (r[1] === null && l !== CFG.defaultLanguage) l = CFG.defaultLanguage; // graceful fallback
      dict = r[1] ? merge(base, r[1]) : base;
      var prev = lang; lang = l;
      applyI18n();
      if (user) {
        store.set("loqelo_lang", l);
        if (prev !== l) track("language_change", { language: l });
        if (location.search.indexOf("lang=") > -1) history.replaceState(null, "", location.pathname + location.hash);
      }
    }).catch(function () { /* keep server-rendered English */ }).then(function () { root.classList.remove("i18n-pending"); });
  }
  var NAMES = Object.assign({ en: "English", pl: "Polski", nl: "Nederlands", de: "Deutsch", fr: "Français", es: "Español", it: "Italiano" }, CFG.languageNames || {});
  function langName(l) { var d = cache[l] && cache[l]._meta; return d ? d.nativeName : (NAMES[l] || l.toUpperCase()); }
  function renderLangUI() {
    var list = $(".lang__list");
    list.innerHTML = "";
    CFG.languages.forEach(function (l, i) {
      var li = document.createElement("li");
      li.className = "lang__opt"; li.setAttribute("role", "option"); li.id = "lang-opt-" + l; li.tabIndex = -1;
      li.setAttribute("aria-selected", String(l === lang)); li.setAttribute("data-l", l);
      li.innerHTML = "<span></span><small>" + l.toUpperCase() + "</small>";
      li.firstChild.textContent = langName(l);
      list.appendChild(li);
    });
    $$("[data-lang-inline]").forEach(function (box) {
      box.innerHTML = ""; box.className = (box.className.replace(/\s*lang-inline/, "")) + " lang-inline";
      box.setAttribute("role", "group"); box.setAttribute("aria-label", t("a11y.language"));
      CFG.languages.forEach(function (l) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = langName(l); b.lang = l;
        b.setAttribute("aria-pressed", String(l === lang));
        b.addEventListener("click", function () { setLang(l, true); });
        box.appendChild(b);
      });
    });
  }
  function langPickerInit() {
    var wrap = $("[data-lang-picker]"), btn = $(".lang__btn", wrap), list = $(".lang__list", wrap);
    function open() { list.hidden = false; btn.setAttribute("aria-expanded", "true"); var s = $("[aria-selected=true]", list) || list.firstChild; s && s.focus(); }
    function close(f) { list.hidden = true; btn.setAttribute("aria-expanded", "false"); if (f) btn.focus(); }
    btn.addEventListener("click", function () { list.hidden ? open() : close(); });
    list.addEventListener("click", function (e) { var o = e.target.closest(".lang__opt"); if (o) { setLang(o.getAttribute("data-l"), true); close(true); } });
    list.addEventListener("keydown", function (e) {
      var opts = $$(".lang__opt", list), i = opts.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (opts[i]) { setLang(opts[i].getAttribute("data-l"), true); close(true); } }
      else if (e.key === "Escape" || e.key === "Tab") { close(e.key === "Escape"); }
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
  }

  /* =====================================================
     Header + mobile menu
     ===================================================== */
  function headerInit() {
    var hdr = $(".hdr"), burger = $(".hdr__burger"), menu = $("#mnav");
    var lastY = window.scrollY;
    var onScroll = function () {
      var y = window.scrollY, dy = y - lastY;
      hdr.classList.toggle("is-stuck", y > 8);
      // Hide while reading downwards, bring back on any upward scroll. Never hide while the
      // header is in use (menu, language list or keyboard focus inside it).
      var busy = !menu.hidden || hdr.contains(document.activeElement) || !$(".lang__list").hidden;
      if (reduceMotion || busy || y < 480) hdr.classList.remove("is-hidden");
      else if (dy > 6) hdr.classList.add("is-hidden");
      else if (dy < -6) hdr.classList.remove("is-hidden");
      if (Math.abs(dy) > 6 || y < 480) lastY = y;
    };
    onScroll(); onFrame(onScroll);
    hdr.addEventListener("focusin", function () { hdr.classList.remove("is-hidden"); });
    // Scrollspy: underline the nav item for the section in view
    var links = $$(".hdr__nav a");
    if ("IntersectionObserver" in window) {
      var spy = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var a = links.filter(function (l) { return l.getAttribute("href") === "#" + e.target.id; })[0];
          if (!a) return;
          if (e.isIntersecting) { links.forEach(function (l) { l.classList.remove("is-current"); l.removeAttribute("aria-current"); }); a.classList.add("is-current"); a.setAttribute("aria-current", "true"); }
          else if (a.classList.contains("is-current")) { a.classList.remove("is-current"); a.removeAttribute("aria-current"); }
        });
      }, { rootMargin: "-40% 0px -55% 0px" });
      ["how", "customers", "providers"].forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
    }
    function setMenu(open) {
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", t(open ? "a11y.menuClose" : "a11y.menuOpen"));
      menu.hidden = !open;
      if (open) { hdr.classList.add("is-stuck"); var f = $("a", menu); f && f.focus(); } else onScroll();
    }
    burger.addEventListener("click", function () { setMenu(burger.getAttribute("aria-expanded") !== "true"); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { setMenu(false); burger.focus(); } });
    window.addEventListener("resize", function () { if (window.innerWidth >= 1024 && !menu.hidden) setMenu(false); });
  }

  /* =====================================================
     CTA routing: links with data-audience preselect the form tab
     ===================================================== */
  function ctaInit() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-cta]");
      if (!a) return;
      var aud = a.getAttribute("data-audience");
      track("waitlist_cta_click", { cta_location: a.getAttribute("data-cta"), audience: aud || "unspecified" });
      if (aud && window.LoqeloForm) window.LoqeloForm.setAudience(aud);
      if (a.getAttribute("href") === "#waitlist") {
        e.preventDefault();
        var card = $(".wl__card");
        card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: window.innerWidth < 1024 ? "start" : "center" });
        history.replaceState(null, "", "#waitlist");
        setTimeout(function () {
          var el = $("#f-email"); if (el && !$(".form").hidden) el.focus({ preventScroll: true });
          if (!reduceMotion) { card.classList.remove("is-arrive"); void card.offsetWidth; card.classList.add("is-arrive"); }
        }, reduceMotion ? 0 : 650);
      }
    });
  }

  /* =====================================================
     Hero: live "Describe it" demo
     ===================================================== */
  function demoInit() {
    var box = $("[data-demo]"); if (!box) return;
    var typed = $(".describe__typed", box), chipsEl = $(".describe__chips", box);
    var idx = 0, timer = null, running = false, visible = true;

    function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function chipHTML(c) {
      return '<span class="svc c-' + c[1] + '"><i><svg aria-hidden="true"><use href="#i-' + c[2] + '"/></svg></i>' + esc(c[0]) + "</span>";
    }
    function render(item, n) {
      var html = "", left = n, done = 0;
      item.parts.forEach(function (p) {
        var text = typeof p === "string" ? p : p.h;
        var show = text.slice(0, Math.max(0, left)); left -= text.length;
        if (typeof p === "string") html += esc(show);
        else if (show.length) {
          var complete = show.length === text.length;
          if (complete) done++;
          html += '<mark class="' + (complete ? "c-" + p.c : "") + '">' + esc(show) + "</mark>";
        }
      });
      typed.innerHTML = html;
      var shown = chipsEl.children.length;
      for (var i = shown; i < done && i < item.chips.length; i++) chipsEl.insertAdjacentHTML("beforeend", chipHTML(item.chips[i]));
    }
    function total(item) { return item.parts.reduce(function (s, p) { return s + (typeof p === "string" ? p : p.h).length; }, 0); }
    function items() { var d = t("demo"); return Array.isArray(d) ? d : []; }

    function play() {
      var list = items(); if (!list.length) return;
      var item = list[idx % list.length], n = 0, len = total(item);
      chipsEl.innerHTML = "";
      if (reduceMotion) { render(item, len); return; }
      running = true;
      (function step() {
        if (!visible) { timer = setTimeout(step, 400); return; }
        n++; render(item, n);
        if (n < len) { timer = setTimeout(step, 28 + Math.random() * 46); }
        else {
          timer = setTimeout(function () {
            box.style.transition = "opacity .35s"; typed.style.opacity = "0"; chipsEl.style.opacity = "0";
            typed.style.transition = chipsEl.style.transition = "opacity .35s";
            timer = setTimeout(function () { typed.style.opacity = chipsEl.style.opacity = "1"; idx++; play(); }, 380);
          }, 2800);
        }
      })();
    }
    function restart() { clearTimeout(timer); idx = 0; play(); }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting && !document.hidden; }).observe(box);
    }
    document.addEventListener("visibilitychange", function () { visible = !document.hidden; });
    document.addEventListener("loqelo:lang", restart);
    play();
  }

  /* =====================================================
     How it works: sticky viewer follows the active step
     ===================================================== */
  function howInit() {
    var steps = $$(".step"), imgs = $$(".how__frame img"), bar = $(".how__progress span");
    if (!steps.length || !("IntersectionObserver" in window)) return;
    var current = 0;
    function activate(i) {
      current = i;
      steps.forEach(function (s, j) { s.classList.toggle("is-active", j === i); });
      // Screens leave in the direction you scroll and arrive from the other side
      imgs.forEach(function (im, j) {
        im.classList.toggle("is-active", j === i);
        im.classList.toggle("is-before", j < i);
        im.classList.toggle("is-after", j > i);
      });
      if (bar) bar.style.transform = "translateX(" + i * 100 + "%)";
    }
    // One rail joins the three step markers and fills as the reader moves through them
    var list = $(".steps"), nums = $$(".step__num"), inView = false;
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) progress(); }).observe(list);
    function progress() {
      if (!inView) return;
      var lr = list.getBoundingClientRect();
      var dots = nums.map(function (n) { var r = n.getBoundingClientRect(); return r.bottom - lr.top + 7; });
      var top = dots[0], h = dots[dots.length - 1] - top;
      var mid = window.innerHeight * 0.55 - lr.top;
      var fill = Math.max(0, Math.min(h, mid - top));
      list.style.setProperty("--rt", top + "px");
      list.style.setProperty("--rh", h + "px");
      list.style.setProperty("--rf", (reduceMotion ? (fill > 0 ? fill : 0) : fill) + "px");
      steps.forEach(function (s, i) { s.classList.toggle("is-reached", mid >= dots[i] - 2); });
    }
    onFrame(progress);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) activate(+e.target.getAttribute("data-step")); });
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach(function (s) { io.observe(s); });
  }

  /* =====================================================
     Video: nothing downloads until the visitor presses play
     ===================================================== */
  function videoInit() {
    var p = $("[data-player]"); if (!p) return;
    var btn = $(".player__play", p);
    btn.addEventListener("click", function () {
      var conn = navigator.connection || {};
      var small = conn.saveData || /2g/.test(conn.effectiveType || "") || (p.clientWidth * (window.devicePixelRatio || 1)) < 1400;
      var v = document.createElement("video");
      v.src = CFG.base + "assets/video/loqelo-" + (small ? "720" : "1080") + ".mp4";
      v.controls = true; v.playsInline = true; v.preload = "auto";
      v.poster = $(".player__poster", p).currentSrc || "";
      v.setAttribute("aria-label", t("video.play"));
      var loader = document.createElement("span"); loader.className = "player__loader"; loader.setAttribute("aria-hidden", "true");
      p.classList.add("is-loading");
      p.appendChild(v); p.appendChild(loader);
      btn.remove();
      var ready = function () { p.classList.remove("is-loading"); p.classList.add("is-playing"); loader.remove(); };
      v.addEventListener("playing", ready, { once: true });
      v.addEventListener("waiting", function () { if (!p.classList.contains("is-playing")) return; });
      v.addEventListener("error", ready, { once: true });
      v.play().catch(function () { ready(); });
      v.focus();
      track("video_play", { video_title: "loqelo_promo" });
      var q = [25, 50, 75, 100], sent = {};
      v.addEventListener("timeupdate", function () {
        var pct = v.currentTime / (v.duration || 1) * 100;
        q.forEach(function (m) { if (pct >= m - 0.5 && !sent[m]) { sent[m] = 1; track("video_progress", { video_percent: m }); } });
      });
    });
  }

  /* =====================================================
     Launch timeline: today → launch month
     ===================================================== */
  function timelineInit() {
    var tl = $("[data-timeline]"); if (!tl) return;
    var list = $(".timeline__months", tl), fill = $(".timeline__fill", tl);
    function build() {
      var now = new Date(), L = CFG.launch;
      var launchIdx = L.year * 12 + (L.month - 1), nowIdx = now.getFullYear() * 12 + now.getMonth();
      var start = Math.min(nowIdx, launchIdx), rows = [];
      for (var m = start; m <= launchIdx; m++) rows.push(m);
      var fmt;
      try { fmt = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric" }); } catch (e) { fmt = { format: function (d) { return d.toDateString(); } }; }
      list.innerHTML = "";
      rows.forEach(function (m) {
        var d = new Date(Math.floor(m / 12), m % 12, 1);
        var li = document.createElement("li"); li.className = "tm"; li.style.setProperty("--i", rows.indexOf(m));
        var label = fmt.format(d); label = label.charAt(0).toUpperCase() + label.slice(1);
        var dot = '<span class="tm__dot">' + (m === launchIdx ? '<img src="' + CFG.base + 'assets/img/pin.svg" width="44" height="44" alt="">' : "") + "</span>";
        var tag = "";
        if (m === launchIdx) { li.classList.add("is-launch"); tag = '<span class="tm__tag">' + t("launch.launch") + "</span>"; }
        else if (m === nowIdx) { li.classList.add("is-now"); tag = '<span class="tm__tag">' + t("launch.today") + "</span>"; }
        else if (m < nowIdx) li.classList.add("is-past");
        li.innerHTML = dot + "<span></span>" + tag;
        li.children[1].textContent = label;
        list.appendChild(li);
      });
      // progress: today's position along the track
      var span = Math.max(1, launchIdx - start);
      var pos = Math.min(1, ((nowIdx - start) + (now.getDate() - 1) / 31) / span);
      tl.style.setProperty("--tl", pos);
      if (tl.classList.contains("is-in")) fill.style.height = (pos * 100) + "%";
    }
    build();
    document.addEventListener("loqelo:lang", build);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { tl.classList.add("is-in"); fill.style.height = (parseFloat(tl.style.getPropertyValue("--tl")) * 100) + "%"; io.disconnect(); }
      }, { threshold: .4 });
      io.observe(tl);
    } else { tl.classList.add("is-in"); build(); }
  }

  /* =====================================================
     Country combobox
     ===================================================== */
  var ISO = "AF AX AL DZ AS AD AO AI AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BR IO VG BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF KP MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA KR SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UY VI UZ VU VA VE VN WF EH YE ZM ZW".split(" ");
  function norm(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }

  function comboInit(form) {
    var wrap = $("[data-combo]", form), input = $("input[role=combobox]", wrap), hidden = $("input[name=country]", wrap), list = $(".combo__list", wrap);
    var countries = [], activeIdx = -1, shown = [];
    var region = (navigator.language || "").split("-")[1];
    function build() {
      var dn = null, en = null;
      try { dn = new Intl.DisplayNames([lang], { type: "region" }); en = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) {}
      countries = ISO.map(function (c) {
        var n = dn ? dn.of(c) : c, e = en ? en.of(c) : c;
        return { code: c, name: n, en: norm(e), key: norm(n) + " " + norm(e) + " " + c.toLowerCase() };
      }).sort(function (a, b) { return a.name.localeCompare(b.name, lang); });
      if (hidden.value) { var cur = find(hidden.value); if (cur) input.value = cur.name; }
    }
    function find(code) { for (var i = 0; i < countries.length; i++) if (countries[i].code === code) return countries[i]; return null; }
    function filter(q) {
      q = norm(q);
      if (!q) return countries;
      var a = [], b = [], c = [];
      countries.forEach(function (x) {
        var names = x.key.split(" " ), full = norm(x.name);
        if (full.indexOf(q) === 0 || x.key.split("  ")[0].indexOf(q) === 0 || x.en.indexOf(q) === 0) a.push(x);
        else if (names.some(function (w) { return w.indexOf(q) === 0; })) b.push(x);
        else if (x.key.indexOf(q) > -1) c.push(x);
      });
      return a.concat(b, c);
    }
    function render(q) {
      shown = filter(q);
      list.innerHTML = "";
      var frag = document.createDocumentFragment();
      var sug = !norm(q) && region && find(region);
      if (sug) {
        var g = document.createElement("li"); g.className = "combo__group"; g.setAttribute("role", "presentation"); g.textContent = t("form.suggested"); frag.appendChild(g);
        shown = [sug].concat(shown);
      }
      shown.forEach(function (c, i) {
        var li = document.createElement("li");
        li.className = "combo__opt"; li.setAttribute("role", "option"); li.id = "cty-" + i; li.setAttribute("data-code", c.code);
        li.setAttribute("aria-selected", String(c.code === hidden.value));
        li.textContent = c.name;
        frag.appendChild(li);
      });
      if (!shown.length) { var e = document.createElement("li"); e.className = "combo__empty"; e.setAttribute("role", "presentation"); e.textContent = t("form.countryEmpty"); frag.appendChild(e); }
      list.appendChild(frag);
      setActive(shown.length ? 0 : -1, true);
    }
    function setActive(i, noScroll) {
      var opts = $$(".combo__opt", list);
      opts.forEach(function (o) { o.classList.remove("is-active"); });
      activeIdx = i;
      if (i > -1 && opts[i]) {
        opts[i].classList.add("is-active");
        input.setAttribute("aria-activedescendant", opts[i].id);
        if (!noScroll) opts[i].scrollIntoView({ block: "nearest" });
      } else input.removeAttribute("aria-activedescendant");
    }
    function open() { if (!list.hidden) return; render(hidden.value ? "" : input.value); list.hidden = false; input.setAttribute("aria-expanded", "true"); }
    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
    function choose(code) {
      var c = find(code); if (!c) return;
      hidden.value = c.code; input.value = c.name; close();
      form.dispatchEvent(new CustomEvent("loqelo:country"));
    }
    input.addEventListener("focus", open);
    input.addEventListener("click", open);
    input.addEventListener("input", function () { hidden.value = ""; if (list.hidden) { list.hidden = false; input.setAttribute("aria-expanded", "true"); } render(input.value); });
    input.addEventListener("keydown", function (e) {
      var n = $$(".combo__opt", list).length;
      if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) open(); else setActive(Math.min(n - 1, activeIdx + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, activeIdx - 1)); }
      else if (e.key === "Enter") { if (!list.hidden && activeIdx > -1) { e.preventDefault(); choose($$(".combo__opt", list)[activeIdx].getAttribute("data-code")); } }
      else if (e.key === "Escape") { if (!list.hidden) { e.preventDefault(); close(); } }
      else if (e.key === "Tab") { if (!list.hidden && activeIdx > -1 && input.value && !hidden.value) choose($$(".combo__opt", list)[activeIdx].getAttribute("data-code")); close(); }
    });
    list.addEventListener("mousedown", function (e) { e.preventDefault(); });
    list.addEventListener("click", function (e) { var o = e.target.closest(".combo__opt"); if (o) choose(o.getAttribute("data-code")); });
    input.addEventListener("blur", function () {
      setTimeout(function () {
        if (!hidden.value && input.value) {
          var q = norm(input.value), m = countries.filter(function (c) { return norm(c.name) === q || c.key.split(" ").indexOf(q) > -1 && q.length > 2; });
          if (m.length === 1) choose(m[0].code);
        }
        close();
        form.dispatchEvent(new CustomEvent("loqelo:country-blur"));
      }, 120);
    });
    build();
    document.addEventListener("loqelo:lang", build);
    return { reset: function () { hidden.value = ""; input.value = ""; }, set: function (c) { choose(c); close(); } };
  }

  /* =====================================================
     Waitlist form
     ===================================================== */
  function formInit() {
    var form = $("#wl-form"); if (!form) return;
    var card = $(".wl__card"), done = $(".done", card), alertEl = $(".form__alert", form);
    var tabs = $$(".seg__btn", card);
    var email = $("#f-email"), consent = $("input[name=consent]", form);
    var combo = comboInit(form);
    var audience = "customer", started = {}, touched = {}, busy = false;
    var ts = $("input[name=ts]", form);
    ts.value = String(Date.now());
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function setAudience(a, focusTab) {
      if (a !== "customer" && a !== "provider") return;
      var changed = audience !== a;
      audience = a;
      form.setAttribute("data-audience", a);
      $(".seg", card).setAttribute("data-active", a);
      if (changed && !reduceMotion) [$("[data-country-label]", form), $(".form__submit-lbl", form)].forEach(function (el) {
        el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap");
      });
      tabs.forEach(function (b) {
        var on = b.getAttribute("data-aud") === a;
        b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
        if (on) { $("#wl-panel").setAttribute("aria-labelledby", b.id); if (focusTab) b.focus(); }
      });
      $("[data-country-label]", form).setAttribute("data-i18n", a === "customer" ? "form.countryCustomer" : "form.countryProvider");
      $(".form__submit-lbl", form).setAttribute("data-i18n", a === "customer" ? "form.submitCustomer" : "form.submitProvider");
      $("[data-country-label]", form).textContent = t(a === "customer" ? "form.countryCustomer" : "form.countryProvider");
      $(".form__submit-lbl", form).textContent = t(a === "customer" ? "form.submitCustomer" : "form.submitProvider");
      if (!done.hidden) showForm();
    }
    window.LoqeloForm = { setAudience: setAudience };
    $(".seg", card).setAttribute("data-active", audience);

    tabs.forEach(function (b, i) {
      b.addEventListener("click", function () { setAudience(b.getAttribute("data-aud")); });
      b.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); var n = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]; setAudience(n.getAttribute("data-aud"), true); }
      });
    });

    // Optional radio can be cleared by clicking the selected chip again.
    $$("input[name=account_type]", form).forEach(function (r) {
      r.addEventListener("mousedown", function () { r._was = r.checked; });
      r.addEventListener("click", function () { if (r._was) { r.checked = false; r._was = false; } });
    });

    function markStart() {
      if (started[audience]) return;
      started[audience] = true;
      track("form_start", { form_type: audience });
    }
    form.addEventListener("focusin", markStart);
    form.addEventListener("input", markStart);

    function fieldOf(el) { return el.closest(".field"); }
    function setErr(el, msg) {
      var f = fieldOf(el), err = $(".field__err", f);
      f.classList.toggle("is-invalid", !!msg);
      f.classList.toggle("is-valid", !msg && el.type !== "checkbox" && !!(el.value || "").trim());
      el.setAttribute("aria-invalid", msg ? "true" : "false");
      err.hidden = !msg; err.textContent = msg || "";
    }
    function vEmail() {
      var v = email.value.trim();
      if (!v) return t("form.errEmail");
      if (!EMAIL_RE.test(v) || v.length > 254) return t("form.errEmailFormat");
      return "";
    }
    function vCountry() { return $("input[name=country]", form).value ? "" : t("form.errCountry"); }
    function vConsent() { return consent.checked ? "" : t("form.errConsent"); }
    var cInput = $("#f-country");

    email.addEventListener("blur", function () { if (email.value.trim()) { touched.email = true; setErr(email, vEmail()); } });
    email.addEventListener("input", function () { if (touched.email) setErr(email, vEmail()); });
    form.addEventListener("loqelo:country", function () { touched.country = true; setErr(cInput, ""); });
    form.addEventListener("loqelo:country-blur", function () { if (touched.country || cInput.value) { touched.country = true; setErr(cInput, vCountry()); } });
    consent.addEventListener("change", function () { if (touched.consent) setErr(consent, vConsent()); });
    document.addEventListener("loqelo:lang", function () {
      // re-translate any visible errors
      if (touched.email) setErr(email, vEmail());
      if (touched.country) setErr(cInput, vCountry());
      if (touched.consent) setErr(consent, vConsent());
      setAudience(audience);
    });

    function showAlert(msg, info) { alertEl.textContent = msg; alertEl.classList.toggle("is-info", !!info); alertEl.hidden = !msg; }

    // Optional Cloudflare Turnstile
    var tsWidget = null;
    if (CFG.turnstileSiteKey) {
      window.loqeloTurnstile = function () {
        tsWidget = window.turnstile.render($("[data-turnstile]", form), { sitekey: CFG.turnstileSiteKey, language: lang, appearance: "interaction-only" });
      };
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=loqeloTurnstile"; s.async = true; s.defer = true;
      document.head.appendChild(s);
    }

    function showDone(status) {
      var title, msg;
      if (status === "already") { title = t("form.dupTitle"); msg = t(audience === "customer" ? "form.dupCustomer" : "form.dupProvider"); }
      else if (status === "pending_confirmation") { title = t("form.okConfirmTitle"); msg = t("form.okConfirm"); }
      else if (audience === "customer") { title = t("form.okCustomerTitle"); msg = t("form.okCustomer"); }
      else { title = t("form.okProviderTitle"); msg = t("form.okProvider"); }
      $(".done__title", done).textContent = title;
      $(".done__msg", done).textContent = msg;
      $(".done__preview", done).hidden = !CFG.previewMode;
      var cross = $("[data-cross]", done);
      cross.textContent = t(audience === "customer" ? "form.crossToProvider" : "form.crossToCustomer");
      morph(function () { form.hidden = true; done.hidden = false; });
      // re-trigger the check animation and the celebration
      var ic = $(".done__ic svg", done); ic.style.animation = "none"; void ic.offsetWidth; ic.style.animation = "";
      done.classList.remove("is-celebrate"); void done.offsetWidth; if (!reduceMotion) done.classList.add("is-celebrate");
      done.focus({ preventScroll: true });
    }
    // Animate the card's height when its content swaps, so the page doesn't jump.
    function morph(swap) {
      if (reduceMotion || !card.animate) { swap(); return; }
      var from = card.offsetHeight; swap(); var to = card.offsetHeight;
      if (Math.abs(from - to) < 2) return;
      card.style.overflow = "hidden";
      var anim = card.animate([{ height: from + "px" }, { height: to + "px" }], { duration: 450, easing: "cubic-bezier(.16,1,.3,1)" });
      anim.onfinish = anim.oncancel = function () { card.style.overflow = ""; };
    }
    function showForm(keep) {
      if (!done.hidden) morph(function () { done.hidden = true; form.hidden = false; });
      done.hidden = true; form.hidden = false;
      if (!keep) { form.reset(); combo.reset(); }
      consent.checked = false;
      $$(".field", form).forEach(function (f) { f.classList.remove("is-invalid", "is-valid"); var e = $(".field__err", f); if (e) e.hidden = true; });
      touched = {}; showAlert("");
      ts.value = String(Date.now());
    }
    $("[data-again]", done).addEventListener("click", function () { showForm(); email.focus(); });
    $("[data-cross]", done).addEventListener("click", function () {
      var keepEmail = email.value, keepCountry = $("input[name=country]", form).value;
      setAudience(audience === "customer" ? "provider" : "customer");
      showForm(true);
      email.value = keepEmail; if (keepCountry) combo.set(keepCountry);
      consent.focus();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      touched = { email: true, country: true, consent: true };
      var errs = [[email, vEmail()], [cInput, vCountry()], [consent, vConsent()]];
      var first = null;
      errs.forEach(function (p) {
        setErr(p[0], p[1]);
        if (p[1] && !first) first = p[0];
        if (p[1] && !reduceMotion) { var f = fieldOf(p[0]); f.classList.remove("is-shake"); void f.offsetWidth; f.classList.add("is-shake"); }
      });
      if (first) {
        showAlert(t("form.errSummary"));
        first.focus();
        track("form_error", { form_type: audience, error_type: "validation" });
        return;
      }
      showAlert("");
      var at = $("input[name=account_type]:checked", form);
      var payload = {
        audience: audience,
        email: email.value.trim(),
        country: $("input[name=country]", form).value,
        account_type: at ? at.value : "",
        consent: true,
        consent_text: t("form.consent").replace(/<[^>]+>/g, ""),
        language: lang,
        website: $("input[name=website]", form).value,
        ts: ts.value,
        turnstile: (window.turnstile && tsWidget !== null) ? window.turnstile.getResponse(tsWidget) : ""
      };
      track("form_submit", { form_type: audience });
      busy = true; form.classList.add("is-busy"); form.setAttribute("aria-busy", "true");
      $(".form__submit-lbl", form).textContent = t("form.submitting");

      var req;
      if (CFG.previewMode) {
        req = new Promise(function (res) { setTimeout(function () { res({ ok: true, status: "subscribed" }); }, 900); });
      } else {
        var ctrl = "AbortController" in window ? new AbortController() : null;
        var to = setTimeout(function () { ctrl && ctrl.abort(); }, 20000);
        req = fetch(CFG.endpoint, {
          method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload), credentials: "same-origin", signal: ctrl ? ctrl.signal : undefined
        }).then(function (r) {
          clearTimeout(to);
          return r.json().catch(function () { return { ok: false, error: "server" }; }).then(function (j) { j._http = r.status; return j; });
        }, function (err) { clearTimeout(to); return { ok: false, error: "network" }; });
      }

      req.then(function (res) {
        busy = false; form.classList.remove("is-busy"); form.removeAttribute("aria-busy");
        setAudience(audience);
        if (window.turnstile && tsWidget !== null) window.turnstile.reset(tsWidget);
        if (res && res.ok) {
          if (res.status !== "already") {
            track("sign_up", { method: audience });
            track(audience === "customer" ? "waitlist_signup_customer" : "waitlist_signup_provider", {});
          } else track("form_duplicate", { form_type: audience });
          showDone(res.status);
          return;
        }
        var code = (res && res.error) || "server";
        if (code === "validation" && res.fields) {
          if (res.fields.email) setErr(email, t("form.errEmailFormat"));
          if (res.fields.country) setErr(cInput, t("form.errCountry"));
          if (res.fields.consent) setErr(consent, t("form.errConsent"));
          showAlert(t("form.errSummary"));
        } else {
          showAlert(t({ network: "form.errNetwork", rate_limited: "form.errRate", spam: "form.errSpam" }[code] || "form.errServer"));
        }
        track("form_error", { form_type: audience, error_type: code });
        alertEl.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }

  /* =====================================================
     Hero: word-by-word headline + depth on the product stage
     ===================================================== */
  var heroTitle = $(".hero__title");
  if (heroTitle && !reduceMotion) heroTitle.classList.add("is-pending");
  // Typewriter variant (used on version 2): the heading types itself once on load.
  var typeTimer = null;
  function typeTitle(animate) {
    clearTimeout(typeTimer);
    var full = $$("[data-i18n]", heroTitle).map(function (el) { return el.textContent; }).join(" ").replace(/\s+/g, " ").trim();
    var chars = [];
    $$("[data-i18n]", heroTitle).forEach(function (el) {
      var text = el.textContent; el.innerHTML = "";
      text.split(/(\s+)/).forEach(function (w) {
        if (!w) return;
        if (/^\s+$/.test(w)) { el.appendChild(document.createTextNode(" ")); return; }
        var word = document.createElement("span"); word.className = "tw";
        w.split("").forEach(function (c) { var ch = document.createElement("span"); ch.className = "ch"; ch.textContent = c; word.appendChild(ch); chars.push(ch); });
        el.appendChild(word);
      });
      el.setAttribute("aria-hidden", "true");
    });
    var sr = $(".hero__sr", heroTitle);
    if (!sr) { sr = document.createElement("span"); sr.className = "vh hero__sr"; heroTitle.insertBefore(sr, heroTitle.firstChild); }
    sr.textContent = full;
    var caret = $(".tcaret", heroTitle) || document.createElement("span");
    caret.className = "tcaret"; caret.setAttribute("aria-hidden", "true");
    heroTitle.classList.remove("is-pending", "is-typed");
    if (!animate || reduceMotion) {
      chars.forEach(function (c) { c.classList.add("on"); });
      caret.remove(); heroTitle.classList.add("is-typed"); return;
    }
    var i = 0;
    chars[0].parentNode.insertBefore(caret, chars[0]);
    (function next() {
      if (i >= chars.length) {
        heroTitle.classList.add("is-typed");
        typeTimer = setTimeout(function () { caret.classList.add("is-done"); }, 1600);
        return;
      }
      var c = chars[i++]; c.classList.add("on");
      c.parentNode.insertBefore(caret, c.nextSibling);
      var pause = /[.,]/.test(c.textContent) ? 260 : (c.nextSibling === caret && !caret.nextSibling ? 140 : 0);
      typeTimer = setTimeout(next, 55 + Math.random() * 45 + pause);
    })();
  }

  function splitTitle(animate) {
    if (!heroTitle) return;
    if (heroTitle.hasAttribute("data-typewriter")) { typeTitle(animate); return; }
    var i = 0;
    $$("[data-i18n]", heroTitle).forEach(function (el) {
      var words = el.textContent.split(/(\s+)/);
      el.innerHTML = "";
      words.forEach(function (w) {
        if (!w) return;
        if (/^\s+$/.test(w)) { el.appendChild(document.createTextNode(" ")); return; }
        var o = document.createElement("span"); o.className = "w";
        var inner = document.createElement("span"); inner.className = "w__i"; inner.textContent = w; inner.style.setProperty("--i", i++);
        o.appendChild(inner); el.appendChild(o);
      });
    });
    heroTitle.classList.toggle("is-static", !animate || reduceMotion);
    heroTitle.classList.remove("is-pending");
  }
  var titleSplitOnce = false;
  document.addEventListener("loqelo:lang", function () { splitTitle(!titleSplitOnce); titleSplitOnce = true; });
  setTimeout(function () { if (!titleSplitOnce) { splitTitle(true); titleSplitOnce = true; } }, 1800); // safety net

  function stageInit() {
    var stage = $(".stage"), hero = $(".hero");
    if (!stage || reduceMotion || !window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    // Layers move by depth: the photo least, the floating pins most.
    var layers = [[".stage__photo", 6], [".stage__phone", 11], [".describe", 16], [".pin--a", 22], [".pin--b", 20], [".pin--c", 24]]
      .map(function (l) { return [$(l[0], stage), l[1]]; }).filter(function (l) { return l[0]; });
    var tx = 0, ty = 0, raf = null;
    function apply() {
      raf = null;
      layers.forEach(function (l) { l[0].style.setProperty("--px", (tx * l[1]).toFixed(1) + "px"); l[0].style.setProperty("--py", (ty * l[1]).toFixed(1) + "px"); });
    }
    hero.addEventListener("pointermove", function (e) {
      if (window.innerWidth < 1024) return;
      var r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * -1; ty = ((e.clientY - r.top) / r.height - 0.5) * -1;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    hero.addEventListener("pointerleave", function () { tx = ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
  }

  /* =====================================================
     Categories: tap the services you'd use
     Nothing is stored or sent with the form; GA4 (after consent) counts
     which categories people pick, with no personal data.
     ===================================================== */
  function catsInit() {
    var btns = $$(".cat__btn"), bar = $("[data-cats-bar]"); if (!btns.length || !bar) return;
    var num = $(".cats__num", bar);
    function update(bump) {
      var n = btns.filter(function (b) { return b.getAttribute("aria-pressed") === "true"; }).length;
      num.textContent = n;
      if (n && bar.hidden) bar.hidden = false; else if (!n) bar.hidden = true;
      if (bump && n && !reduceMotion) { num.classList.remove("is-bump"); void num.offsetWidth; num.classList.add("is-bump"); }
    }
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", String(on));
        if (on) track("category_select", { category: b.getAttribute("data-cat") });
        update(true);
      });
    });
    $("[data-cats-clear]", bar).addEventListener("click", function () {
      btns.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      update(false); btns[0].focus();
    });
  }

  /* =====================================================
     Audience panels: screens drift gently with scroll
     ===================================================== */
  function panelsInit() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var shots = $$(".panel__shot img"), visible = [];
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var i = visible.indexOf(e.target); if (e.isIntersecting && i < 0) visible.push(e.target); if (!e.isIntersecting && i > -1) visible.splice(i, 1); });
      drift();
    });
    shots.forEach(function (s) { io.observe(s); });
    function drift() {
      var vh = window.innerHeight;
      visible.forEach(function (img) {
        var r = img.getBoundingClientRect();
        var t = (r.top + r.height / 2 - vh / 2) / vh; // -1 .. 1
        img.style.setProperty("--py", (t * -18).toFixed(1) + "px");
      });
    }
    onFrame(drift);
  }

  /* =====================================================
     Reveal on scroll: only content that starts below the fold, so the
     first screen and any linked section are complete immediately.
     ===================================================== */
  function revealInit() {
    if (reduceMotion) return;
    $$(".hero__copy > *:not(.hero__title), .stage > *").forEach(function (el, i) { el.classList.add("rv-load"); el.style.animationDelay = (i * 70 + 150) + "ms"; });
    if (!("IntersectionObserver" in window) || location.hash) return;
    var groups = [[".how__head"], [".step__body", ".step__shot"], [".how__viewer"], [".film__head"], [".player"], [".panel"]];
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -12% 0px" });
    var vh = window.innerHeight;
    groups.forEach(function (sel) {
      $$(sel.join(",")).forEach(function (el, i) {
        if (el.getBoundingClientRect().top < vh) return;
        el.classList.add("rv");
        if (el.classList.contains("panel")) el.style.setProperty("--d", (i % 2) * 120 + "ms");
        io.observe(el);
      });
    });
  }

  /* ===================================================== */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  revealInit();
  stageInit();
  catsInit();
  panelsInit();
  headerInit();
  langPickerInit();
  ctaInit();
  formInit();
  videoInit();
  howInit();
  setLang(lang, false).then(function () { demoInit(); timelineInit(); });
  consentInit();
  if (location.hash === "#waitlist-customer") window.LoqeloForm.setAudience("customer");
  if (location.hash === "#waitlist-provider") window.LoqeloForm.setAudience("provider");
})();
