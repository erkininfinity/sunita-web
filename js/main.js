/* ==========================================================================
   SENERGY — interactions
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     ЗАГЛУШКА: единственное место, где задаётся номер WhatsApp.
     Формат — только цифры, с кодом страны.
     ---------------------------------------------------------------------- */
  var WA_PHONE = "77000000000";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ======================================================================
     WhatsApp links
     ====================================================================== */

  function applyPhone() {
    qsa('a[href*="wa.me"]').forEach(function (a) {
      var query = a.href.split("?")[1];
      a.href = "https://wa.me/" + WA_PHONE + (query ? "?" + query : "");
    });
  }

  /* ======================================================================
     Header, drawer, active nav
     ====================================================================== */

  function initHeader() {
    var hdr = qs("#hdr");
    var burger = qs("#burger");
    var drawer = qs("#drawer");

    function onScroll() {
      hdr.classList.toggle("is-stuck", window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    function closeDrawer() {
      if (!drawer.classList.contains("is-open")) return;
      drawer.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      document.body.classList.remove("is-locked");
    }

    burger.addEventListener("click", function () {
      var open = drawer.classList.toggle("is-open");
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("is-locked", open);
      if (open) {
        var first = qs(".drawer__link", drawer);
        if (first) first.focus();
      }
    });

    qsa(".drawer__link, .drawer__foot a", drawer).forEach(function (link) {
      link.addEventListener("click", closeDrawer);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) {
        closeDrawer();
        burger.focus();
      }
    });
  }

  function initActiveNav() {
    var links = qsa(".nav__link");
    var targets = links
      .map(function (link) {
        var el = qs(link.getAttribute("href"));
        return el ? { link: link, el: el } : null;
      })
      .filter(Boolean);

    if (!targets.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var match = targets.filter(function (t) {
            return t.el === entry.target;
          })[0];
          links.forEach(function (l) {
            l.classList.toggle("is-active", l === match.link);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    targets.forEach(function (t) {
      observer.observe(t.el);
    });
  }

  /* ======================================================================
     Scroll reveal
     ====================================================================== */

  function initReveal() {
    var items = qsa(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-in");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ======================================================================
     Accordions (one open per group)
     ====================================================================== */

  function initAccordions() {
    qsa("[data-acc]").forEach(function (group, groupIndex) {
      var items = qsa(".acc__item", group);

      items.forEach(function (item, index) {
        var btn = qs(".acc__btn", item);
        var panel = qs(".acc__panel", item);
        if (!btn) return;

        if (panel) {
          var id = "acc-" + groupIndex + "-" + index;
          btn.id = id + "-btn";
          panel.id = id + "-panel";
          btn.setAttribute("aria-controls", panel.id);
          panel.setAttribute("role", "region");
          panel.setAttribute("aria-labelledby", btn.id);
        }

        btn.addEventListener("click", function () {
          var willOpen = !item.classList.contains("is-open");

          items.forEach(function (other) {
            other.classList.remove("is-open");
            var otherBtn = qs(".acc__btn", other);
            if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
          });

          item.classList.toggle("is-open", willOpen);
          btn.setAttribute("aria-expanded", String(willOpen));

          if (willOpen) updateDaysBar(item);
        });
      });
    });
  }

  /* Program progress bar follows the opened day */
  function updateDaysBar(item) {
    var bar = qs("#daysBar");
    if (!bar) return;
    var numEl = qs(".acc__num b", item);
    if (!numEl) return;
    var day = parseInt(numEl.textContent, 10);
    if (!day) return;
    bar.style.width = Math.round((day / 14) * 100) + "%";
  }

  /* ======================================================================
     "Read more" disclosures
     ====================================================================== */

  function initMore() {
    qsa(".more").forEach(function (block) {
      var btn = qs(".more__btn", block);
      if (!btn) return;
      btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", function () {
        var open = block.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(open));
      });
    });
  }

  /* ======================================================================
     Tabs (horizontal) and vertical tabs
     ====================================================================== */

  function initTabs(rootSelector, btnSelector, panelSelector, prefix) {
    qsa(rootSelector).forEach(function (root, rootIndex) {
      var buttons = qsa(btnSelector, root);
      var panels = qsa(panelSelector, root);

      function select(btn) {
        var key = btn.getAttribute("data-tab");

        buttons.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", String(active));
          b.tabIndex = active ? 0 : -1;
        });

        panels.forEach(function (p) {
          p.hidden = p.getAttribute("data-panel") !== key;
        });
      }

      buttons.forEach(function (btn, index) {
        var key = btn.getAttribute("data-tab");
        var panel = panels.filter(function (p) {
          return p.getAttribute("data-panel") === key;
        })[0];

        if (panel) {
          var id = prefix + "-" + rootIndex + "-" + index;
          btn.id = id + "-tab";
          panel.id = id + "-panel";
          btn.setAttribute("aria-controls", panel.id);
          panel.setAttribute("role", "tabpanel");
          panel.setAttribute("aria-labelledby", btn.id);
          panel.tabIndex = 0;
        }

        btn.tabIndex = btn.classList.contains("is-active") ? 0 : -1;

        btn.addEventListener("click", function () {
          select(btn);
        });

        btn.addEventListener("keydown", function (e) {
          var step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          var next = buttons[(index + step + buttons.length) % buttons.length];
          select(next);
          next.focus();
        });
      });
    });
  }

  /* ======================================================================
     Flip cards (touch / keyboard support)
     ====================================================================== */

  function initFlips() {
    qsa(".flip").forEach(function (card) {
      card.setAttribute("aria-pressed", "false");

      function toggle() {
        var flipped = card.classList.toggle("is-flipped");
        card.setAttribute("aria-pressed", String(flipped));
      }

      card.addEventListener("click", toggle);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  /* ======================================================================
     Slider
     ====================================================================== */

  function initSliders() {
    qsa("[data-slider]").forEach(function (slider) {
      var track = qs(".slider__track", slider);
      var prev = qs("[data-slider-prev]", slider);
      var next = qs("[data-slider-next]", slider);
      if (!track) return;

      function step() {
        var slide = qs(".slider__slide", track);
        var gap = parseFloat(getComputedStyle(track).columnGap || "16") || 16;
        return slide ? slide.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
      }

      if (prev) {
        prev.addEventListener("click", function () {
          track.scrollBy({ left: -step(), behavior: reduceMotion ? "auto" : "smooth" });
        });
      }
      if (next) {
        next.addEventListener("click", function () {
          track.scrollBy({ left: step(), behavior: reduceMotion ? "auto" : "smooth" });
        });
      }
    });
  }

  /* ======================================================================
     Diary range
     ====================================================================== */

  function initDiary() {
    var range = qs("#trust");
    var value = qs("#trustValue");
    if (!range || !value) return;

    function paint() {
      value.textContent = range.value;
      var pct = ((range.value - range.min) / (range.max - range.min)) * 100;
      range.style.background =
        "linear-gradient(90deg, var(--blue-500) 0%, var(--lilac-500) " +
        pct +
        "%, var(--blue-100) " +
        pct +
        "%)";
    }

    range.addEventListener("input", paint);
    paint();
  }

  /* ======================================================================
     Reading progress + floating button
     ====================================================================== */

  function initScrollUi() {
    var bar = qs("#readbar");
    var fab = qs("#fab");
    var ticking = false;

    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var progress = max > 0 ? window.scrollY / max : 0;
      if (bar) bar.style.transform = "scaleX(" + progress + ")";
      if (fab) fab.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.6);
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );

    update();
  }

  /* ======================================================================
     Form → WhatsApp
     ====================================================================== */

  function initForm() {
    var form = qs("#joinForm");
    if (!form) return;
    var status = qs("#formStatus");

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (!form.reportValidity()) return;

      var name = qs("#fName").value.trim();
      var phone = qs("#fPhone").value.trim();
      var format = qs("#fFormat").value;
      var note = qs("#fNote").value.trim();

      var text =
        "Здравствуйте! Хочу участвовать в марафоне SENERGY.\n" +
        "Имя: " + name + "\n" +
        "Телефон: " + phone + "\n" +
        "Формат: " + format +
        (note ? "\nКомментарий: " + note : "");

      var url = "https://wa.me/" + WA_PHONE + "?text=" + encodeURIComponent(text);
      var win = window.open(url, "_blank");
      if (win) {
        win.opener = null;
      } else {
        /* Встроенные браузеры (Instagram и т.п.) часто блокируют window.open */
        window.location.href = url;
      }

      if (status) {
        status.textContent = "Открываем WhatsApp — отправьте готовое сообщение, и мы ответим.";
        status.classList.add("is-ok");
      }
      form.reset();
    });
  }

  /* ======================================================================
     Misc
     ====================================================================== */

  function initYear() {
    var el = qs("#year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* ======================================================================
     Boot
     ====================================================================== */

  function boot() {
    applyPhone();
    initHeader();
    initActiveNav();
    initReveal();
    initAccordions();
    initMore();
    initTabs("[data-tabs]", ".tabs__btn", ".tabs__panel", "tab");
    initTabs("[data-vtabs]", ".vtabs__btn", ".vtabs__panel", "vtab");
    initFlips();
    initSliders();
    initDiary();
    initScrollUi();
    initForm();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
