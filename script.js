(function () {
  "use strict";

  /* ---------- Navbar scroll state ---------- */
  var navbar = document.getElementById("navbar");
  function onScroll() {
    if (navbar) navbar.classList.toggle("scrolled", window.scrollY > 20);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var hamburger = document.getElementById("hamburger");
  var navLinks = document.getElementById("navLinks");

  function closeMenu() {
    if (hamburger) hamburger.classList.remove("active");
    if (navLinks) navLinks.classList.remove("open");
  }

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", function () {
      hamburger.classList.toggle("active");
      navLinks.classList.toggle("open");
    });
    navLinks.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });
  }

  /* ---------- Animated stat counters ---------- */
  var counters = document.querySelectorAll("[data-count]");
  var counterStarted = false;

  function animateCounters() {
    if (counterStarted) return;
    counters.forEach(function (el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      var duration = 1600;
      var startTime = null;

      function tick(now) {
        if (!startTime) startTime = now;
        var progress = Math.min((now - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = target.toLocaleString();
      }
      requestAnimationFrame(tick);
    });
    counterStarted = true;
  }

  if ("IntersectionObserver" in window && counters.length) {
    var io = new IntersectionObserver(
      function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) {
          animateCounters();
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(counters[0]);
  } else if (counters.length) {
    animateCounters();
  }

  /* ---------- Tutorial guides content ---------- */
  var TUTORIALS = {
    "first-game": {
      thumb: "🍒",
      tag: "Beginner",
      tagClass: "tag-beginner",
      title: "Your First Game in Melons &amp; Chill",
      content:
        "<p>Welcome to the arena! Getting into your first round takes about two minutes.</p>" +
        "<h4>Find the world</h4>" +
        "<ul>" +
        "<li>Open VRChat and go to <strong>Worlds</strong>.</li>" +
        "<li>Search <strong>Melons &amp; Chill</strong> and hit Enter.</li>" +
        "<li>Click the world and enter — then favorite it for next time.</li>" +
        "</ul>" +
        "<h4>Play your first round</h4>" +
        "<ul>" +
        "<li>Your fruit spawns at the top and follows your cursor / hand.</li>" +
        "<li>Move to where you want it and let go to drop.</li>" +
        "<li>Drop two of the same fruit next to each other to merge them.</li>" +
        "<li>Keep merging up the chain — don't let the stack cross the line!</li>" +
        "</ul>" +
        "<p>That's it. You're officially a melon. 🍉</p>"
    },
    "fruit-chain": {
      thumb: "🍇",
      tag: "Intermediate",
      tagClass: "tag-intermediate",
      title: "The Complete Fruit Chain",
      content:
        "<p>Suika runs on a single merge tree. Learn it and every drop becomes a plan.</p>" +
        "<h4>The 11 fruits</h4>" +
        "<ul>" +
        "<li><strong>Cherry</strong> → Strawberry</li>" +
        "<li><strong>Strawberry</strong> → Grape</li>" +
        "<li><strong>Grape</strong> → Dekopon</li>" +
        "<li><strong>Dekopon</strong> → Orange</li>" +
        "<li><strong>Orange</strong> → Apple</li>" +
        "<li><strong>Apple</strong> → Pear</li>" +
        "<li><strong>Pear</strong> → Peach</li>" +
        "<li><strong>Peach</strong> → Pineapple</li>" +
        "<li><strong>Pineapple</strong> → Melon</li>" +
        "<li><strong>Melon</strong> → Watermelon 🏆</li>" +
        "</ul>" +
        "<h4>Pro tip</h4>" +
        "<p>Each merge is worth more than the sum of its parts. Chain a big fruit by merging the pair that sits on top of two of its parents.</p>"
    },
    stacking: {
      thumb: "🍈",
      tag: "Advanced",
      tagClass: "tag-advanced",
      title: "Advanced Stacking Strategies",
      content:
        "<p>High scores come from keeping your board low and your merges chained. Here's how the top of the leaderboard does it.</p>" +
        "<h4>Side-stacking</h4>" +
        "<ul>" +
        "<li>Build your biggest fruit off to one side.</li>" +
        "<li>Keep the center and other side flat for fast pair-dropping.</li>" +
        "<li>Clear pairs quickly so a merge makes room for the next one.</li>" +
        "</ul>" +
        "<h4>Combo timing</h4>" +
        "<ul>" +
        "<li>A merge can trigger a chain reaction — that's a combo, and it's worth bonus score.</li>" +
        "<li>Drop a fruit that will merge into a pair resting on two of its parents.</li>" +
        "<li>Two fruits = one merge. Three in a row = instant chain.</li>" +
        "</ul>" +
        "<h4>Ceiling management</h4>" +
        "<ul>" +
        "<li>The danger line is your game-over line — never leave tall single stacks there.</li>" +
        "<li>If a board is getting tall, use a big fruit as a clean-up tool to clear space.</li>" +
        "</ul>"
    },
    league: {
      thumb: "🏆",
      tag: "League",
      tagClass: "tag-league",
      title: "How Melons Works",
      content:
        "<p>The league runs in seasons. Here's the short version of how you climb.</p>" +
        "<h4>Seasons &amp; matches</h4>" +
        "<ul>" +
        "<li>Each season runs several weeks with weekly match nights.</li>" +
        "<li>Sign up for matches, get paired, and play.</li>" +
        "<li>Your placement and wins earn you league points.</li>" +
        "</ul>" +
        "<h4>Rank &amp; MMR</h4>" +
        "<ul>" +
        "<li>Your best scores feed a seasonal MMR that tracks your skill.</li>" +
        "<li>Divisions keep games fair — rookies play rookies, pros play pros.</li>" +
        "<li>End-of-season tournaments crown the Melons champion.</li>" +
        "</ul>" +
        "<p>Ready to earn your first points? Join the league and climb the brackets.</p>"
    }
  };

  /* ---------- Tutorial modal ---------- */
  var overlay = document.getElementById("modalOverlay");
  var modalTitle = document.getElementById("modalTitle");
  var modalThumb = document.getElementById("modalThumb");
  var modalTag = document.getElementById("modalTag");
  var modalContent = document.getElementById("modalContent");
  var modalClose = document.getElementById("modalClose");

  function openModal(key) {
    var t = TUTORIALS[key];
    if (!t || !overlay) return;
    modalThumb.textContent = t.thumb;
    modalTag.textContent = t.tag;
    modalTag.className = "tag " + t.tagClass;
    modalTitle.innerHTML = t.title;
    modalContent.innerHTML = t.content;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".tutorial-link").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      openModal(link.getAttribute("data-tutorial"));
    });
  });

  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
