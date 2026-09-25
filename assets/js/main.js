(function () {
  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  document.getElementById("year").textContent = new Date().getFullYear();

  // Theme toggle
  var toggle = document.querySelector(".theme-toggle");
  toggle.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  });

  // Nav gets a solid background once the page has scrolled
  var nav = document.querySelector(".nav");
  var sentinel = document.querySelector(".nav-sentinel");
  if ("IntersectionObserver" in window && sentinel) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle("scrolled", !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  // Reveal on scroll. Once revealed, drop the class so tilt uses its own timing.
  var items = document.querySelectorAll(".reveal");
  function done(el) {
    el.classList.add("in");
    setTimeout(function () { el.classList.remove("reveal"); }, 1400);
  }
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { done(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(done);
  }

  // 3D tilt with glare on mouse devices
  if (finePointer && !reduceMotion) {
    document.querySelectorAll(".tilt").forEach(function (el) {
      var max = parseFloat(el.getAttribute("data-tilt")) || 8;
      var frame = null;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(function () {
          el.classList.add("tilting");
          el.style.setProperty("--ry", ((px - 0.5) * max * 2).toFixed(2) + "deg");
          el.style.setProperty("--rx", ((0.5 - py) * max * 2).toFixed(2) + "deg");
          el.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
          el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
          el.style.setProperty("--ga", "1");
        });
      });
      el.addEventListener("pointerleave", function () {
        if (frame) cancelAnimationFrame(frame);
        el.classList.remove("tilting");
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--ga", "0");
      });
    });
  }
})();
