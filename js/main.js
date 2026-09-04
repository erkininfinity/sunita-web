/* ===========================================================================
   SENERGY — compact document interactions
   ========================================================================== */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function initHeader() {
    var header = qs("#hdr");
    var burger = qs("#burger");
    var drawer = qs("#drawer");
    if (!header || !burger || !drawer) return;

    function updateHeader() {
      header.classList.toggle("is-stuck", window.scrollY > 24);
    }

    function closeDrawer() {
      drawer.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Открыть меню");
      document.body.classList.remove("is-locked");
    }

    burger.addEventListener("click", function () {
      var isOpen = drawer.classList.toggle("is-open");
      burger.classList.toggle("is-open", isOpen);
      burger.setAttribute("aria-expanded", String(isOpen));
      burger.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
      document.body.classList.toggle("is-locked", isOpen);
      if (isOpen) {
        var firstLink = qs(".drawer__link", drawer);
        if (firstLink) firstLink.focus();
      }
    });

    qsa("a", drawer).forEach(function (link) {
      link.addEventListener("click", closeDrawer);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && drawer.classList.contains("is-open")) {
        closeDrawer();
        burger.focus();
      }
    });

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
  }

  function initActiveNav() {
    var links = qsa(".nav__link");
    var targets = links.map(function (link) {
      var section = qs(link.getAttribute("href"));
      return section ? { link: link, section: section } : null;
    }).filter(Boolean);

    if (!targets.length || !("IntersectionObserver" in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var current = targets.find(function (target) {
          return target.section === entry.target;
        });
        if (!current) return;
        links.forEach(function (link) {
          link.classList.toggle("is-active", link === current.link);
        });
      });
    }, { rootMargin: "-38% 0px -56% 0px" });

    targets.forEach(function (target) {
      observer.observe(target.section);
    });
  }

  function initReveal() {
    var items = qsa(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (item) {
        item.classList.add("is-in");
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries, currentObserver) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        currentObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.06 });

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  function initTabs(rootSelector, buttonSelector, panelSelector, idPrefix) {
    qsa(rootSelector).forEach(function (root, rootIndex) {
      var buttons = qsa(buttonSelector, root);
      var panels = qsa(panelSelector, root);
      if (!buttons.length || !panels.length) return;

      function select(selectedButton) {
        var selectedKey = selectedButton.getAttribute("data-tab");

        buttons.forEach(function (button) {
          var isActive = button === selectedButton;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-selected", String(isActive));
          button.tabIndex = isActive ? 0 : -1;
        });

        panels.forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-panel") !== selectedKey;
        });
      }

      buttons.forEach(function (button, index) {
        var key = button.getAttribute("data-tab");
        var panel = panels.find(function (candidate) {
          return candidate.getAttribute("data-panel") === key;
        });

        if (panel) {
          var id = idPrefix + "-" + rootIndex + "-" + index;
          button.id = id + "-tab";
          panel.id = id + "-panel";
          button.setAttribute("aria-controls", panel.id);
          panel.setAttribute("role", "tabpanel");
          panel.setAttribute("aria-labelledby", button.id);
          panel.tabIndex = 0;
        }

        button.addEventListener("click", function () {
          select(button);
        });

        button.addEventListener("keydown", function (event) {
          var direction = 0;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") direction = 1;
          if (event.key === "ArrowLeft" || event.key === "ArrowUp") direction = -1;
          if (!direction) return;

          event.preventDefault();
          var nextButton = buttons[(index + direction + buttons.length) % buttons.length];
          select(nextButton);
          nextButton.focus();
        });
      });

      select(buttons.find(function (button) {
        return button.classList.contains("is-active");
      }) || buttons[0]);
    });
  }

  function initScrollUi() {
    var progressBar = qs("#readbar");
    var backToTop = qs("#fab");
    var ticking = false;

    function update() {
      var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      var progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      if (progressBar) progressBar.style.transform = "scaleX(" + progress + ")";
      if (backToTop) backToTop.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.7);
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  function initRegistration() {
    var modal = qs("#register-modal");
    var form = qs("#register-form");
    var triggers = qsa(".js-register");
    if (!modal || !form || !triggers.length) return;

    var previousFocus = null;
    var closeTimer = null;
    var nameInput = qs('[name="name"]', form);

    function openModal(event) {
      if (event) event.preventDefault();
      if (closeTimer) window.clearTimeout(closeTimer);
      previousFocus = document.activeElement;
      modal.hidden = false;
      document.body.classList.add("is-locked");
      window.requestAnimationFrame(function () {
        modal.classList.add("is-open");
        if (nameInput) nameInput.focus();
      });
    }

    function closeModal() {
      modal.classList.remove("is-open");
      document.body.classList.remove("is-locked");
      closeTimer = window.setTimeout(function () {
        modal.hidden = true;
      }, 280);
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }
    }

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", openModal);
    });

    qsa("[data-register-close]", modal).forEach(function (button) {
      button.addEventListener("click", closeModal);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !modal.hidden) closeModal();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;

      var formData = new FormData(form);
      var name = String(formData.get("name") || "").trim();
      var phone = String(formData.get("phone") || "").trim();
      var message = [
        "Здравствуйте! Хочу зарегистрироваться на марафон SENERGY.",
        "",
        "Имя: " + name,
        "Телефон: " + phone
      ].join("\n");
      var whatsappUrl = "https://wa.me/77767432828?text=" + encodeURIComponent(message);

      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      closeModal();
    });
  }

  function initYear() {
    var year = qs("#year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  function boot() {
    initHeader();
    initActiveNav();
    initReveal();
    initTabs("[data-tabs]", ".tabs__btn", ".tabs__panel", "tab");
    initTabs("[data-vtabs]", ".vtabs__btn", ".vtabs__panel", "vtab");
    initScrollUi();
    initRegistration();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
