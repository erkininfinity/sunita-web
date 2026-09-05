/* SENERGY motion: viewport choreography, with native HTML as the fallback. */
(function () {
  "use strict";
  var ease = "cubic-bezier(.19,1,.22,1)";
  var active = new Set();
  var observer;
  var pending = new Set();

  function play(element, frames, options) {
    if (!element.animate) return null;
    var animation = element.animate(frames, options);
    active.add(animation);
    animation.finished.then(function () { active.delete(animation); }, function () { active.delete(animation); });
    return animation;
  }

  function entrance(element, kind, delay) {
    var insideSurface = element.parentElement.closest('[data-enter="surface"]');
    var distance = insideSurface ? 36 : 64;
    var starts = {
      left: "translate3d(-" + distance + "px,0,0)",
      right: "translate3d(" + distance + "px,0,0)",
      down: "translate3d(0,-" + 38 + "px,0)",
      up: "translate3d(0," + 38 + "px,0)",
      surface: "none",
      photo: "translate3d(" + 68 + "px,0,0) scale(.975)"
    };
    return play(element, [{ opacity: 0, transform: starts[kind] || starts.up }, { opacity: 1, transform: "none" }], {
      duration: kind === "surface" ? 650 : kind === "photo" ? 1550 : 1400,
      delay: delay || 0, easing: ease, fill: "backwards"
    });
  }

  function reveal(element, delay, immediate) {
    pending.delete(element);
    if (observer) observer.unobserve(element);
    element.classList.remove("motion-pending");
    if (!immediate) entrance(element, element.dataset.enter, delay);
  }

  function mark(element, kind, beat) {
    element.dataset.enter = kind;
    element.dataset.beat = String(beat || 0);
  }

  function sectionDirection(element) {
    var section = element.closest("section");
    return section && ["author-method", "tracker", "part-4"].indexOf(section.id) !== -1 ? "right" : "left";
  }

  function prepareChoreography() {
    // Headings are independent text elements, never one moving section wrapper.
    document.querySelectorAll(".section__head[data-enter], .chapter-head[data-enter], .part-subhead[data-enter], .stack[data-enter]").forEach(function (group) {
      group.removeAttribute("data-enter");
      Array.from(group.children).forEach(function (child, index) {
        mark(child, child.matches(".eyebrow,.chapter-kicker,.stage-legend") ? "down" : sectionDirection(group), index * 75);
      });
    });
    document.querySelectorAll(".stages[data-enter], .days__rules[data-enter], .plist[data-enter], .details-stack[data-enter], .ritual-steps[data-enter], .chips[data-enter]").forEach(function (group) {
      group.removeAttribute("data-enter");
      Array.from(group.children).forEach(function (child) { mark(child, "up"); });
    });
    document.querySelectorAll("[data-enter]").forEach(function (element) {
      if (element.dataset.enter) return;
      mark(element, element.matches("figure,.hero__media") ? "photo" :
        element.matches(".quote,.hero__lead") ? "right" : element.matches("h1") ? "left" : "up");
    });
    // Surfaces only fade. Their typography moves independently, with no doubled travel.
    document.querySelectorAll(".card[data-enter], .stage[data-enter], .ritual-step[data-enter], .diary-card[data-enter], .author-lead[data-enter]").forEach(function (card) {
      mark(card, "surface");
      var siblings = Array.from(card.parentElement.children);
      var direction = siblings.indexOf(card) % 2 === 0 ? "left" : "right";
      var content = [];
      Array.from(card.children).forEach(function (child) {
        if (child.matches(".card__topline")) return;
        if (child.matches("div") && !child.matches(".icon")) {
          content.push.apply(content, Array.from(child.children));
        } else content.push(child);
      });
      content.forEach(function (child, index) {
        mark(child, child.matches(".icon,.itile,.stage__dot,.ritual-step__num,.eyebrow,.ritual-step__phase") ? "down" : direction, Math.min(60 + index * 70, 260));
      });
    });
    document.querySelectorAll(".doc-details[data-enter], .tabs[data-enter], .vtabs[data-enter]").forEach(function (element) { mark(element, "surface"); });
    var title = document.querySelector(".hero__title");
    var lead = document.querySelector(".hero__lead");
    var price = document.querySelector(".hero__price");
    if (title) mark(title, "left");
    if (lead) mark(lead, "left", 110);
    if (price) mark(price, "up", 100);
    document.querySelectorAll(".hero .chip").forEach(function (chip, index) { mark(chip, "down", index * 55); });
  }

  function init() {
    if (!Element.prototype.animate || !("IntersectionObserver" in window)) return;
    prepareChoreography();
    document.querySelectorAll("[data-enter]").forEach(function (element) { pending.add(element); });
    observer = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (entry) { return entry.isIntersecting && pending.has(entry.target); }).sort(function (a,b) {
        return a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left;
      });
      var rowTop = -Infinity;
      var index = 0;
      visible.forEach(function (entry) {
        if (Math.abs(entry.boundingClientRect.top - rowTop) > 70) { rowTop = entry.boundingClientRect.top; index = 0; }
        var element = entry.target;
        var beat = Number(element.dataset.beat || 0);
        // An element reached later in a tall card starts promptly, not on an old timeline.
        var surface = element.parentElement.closest('[data-enter="surface"]');
        if (surface && !visible.some(function (item) { return item.target === surface; })) beat = Math.min(beat, 80);
        var delay = element.dataset.enter === "surface" ? 0 : Math.min(beat + index++ * 55, 320);
        reveal(element, delay);
      });
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });
    pending.forEach(function (element) {
      element.classList.add("motion-pending");
      observer.observe(element);
    });
    // Keyboard focus and fragment navigation must never land on invisible content.
    document.addEventListener("focusin", function (event) {
      pending.forEach(function (element) { if (element.contains(event.target)) reveal(element, 0, true); });
      // A focused control must stay under the pointer between down and up.
      active.forEach(function (animation) {
        var target = animation.effect && animation.effect.target;
        if (target && (target.contains(event.target) || event.target.contains(target))) animation.finish();
      });
    });
    window.addEventListener("beforeprint", function () {
      pending.forEach(function (element) {
        observer.unobserve(element);
        element.classList.remove("motion-pending");
      });
      pending.clear();
      active.forEach(function (animation) { animation.finish(); });
    });
    initDetails();
  }

  function initDetails() {
    document.querySelectorAll("details.doc-details").forEach(function (details) {
      var summary = details.querySelector("summary");
      var running = null;
      var expanded = details.open;
      summary.addEventListener("click", function (event) {
        event.preventDefault();
        var from = details.getBoundingClientRect().height;
        if (running) running.cancel();
        expanded = !expanded;
        details.open = true;
        var to = expanded ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height + 2;
        details.classList.toggle("motion-closing", !expanded);
        var body = details.querySelector(".doc-details__body");
        if (body) {
          body.getAnimations({ subtree: true }).forEach(function (animation) { animation.cancel(); });
          if (expanded) animateContents(body);
        }
        running = play(details, [{ height: from + "px" }, { height: to + "px" }], {
          duration: 380, easing: "cubic-bezier(.22,.68,0,1.01)"
        });
        if (!running) { details.open = expanded; return; }
        running.onfinish = function () {
          details.open = expanded;
          details.classList.remove("motion-closing");
          running = null;
        };
      });
      details.addEventListener("toggle", function () { if (!running) expanded = details.open; });
    });
  }

  function animateContents(root) {
    var children = Array.from(root.children);
    // Text enters as meaningful paragraphs, keeping line wrapping and selection native.
    children.filter(function (child) {
      var box = child.getBoundingClientRect();
      return box.height > 0 && box.top < window.innerHeight && box.bottom > 0;
    }).slice(0, 6).forEach(function (child, index) {
      entrance(child, child.matches("h2,h3,h4") ? "left" : "up", 60 + index * 55);
    });
  }

  window.SenergyMotion = {
    panel: function (panel) {
      panel.getAnimations({ subtree: true }).forEach(function (animation) { animation.cancel(); });
      entrance(panel, "surface", 0);
      animateContents(panel);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
