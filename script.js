(function () {
  "use strict";

  var LB_KEY = "suika_leaderboard";
  var GAMES_KEY = "suika_games";
  var BEST_KEY = "suikaleague_best";
  var CLOUD_ITEM = "https://api.jsonstorage.net/v1/json/9914a949-be0d-4cd1-a81d-6b0016230e60/2d95e380-77b3-4506-9ae2-1b4984050fe6";
  var CLOUD_KEY = "8c44b31b-a4f6-4886-8058-7583a11dce30";
  var CLOUD_CACHE_KEY = "suika_cloud_cache";
  var MAX = 10;
  var lastEntryDate = null;
  var lastRemote = null;
  var cloudBusy = false;

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

  /* ---------- Storage helpers ---------- */
  function load() {
    try {
      var a = JSON.parse(localStorage.getItem(LB_KEY));
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function save(a) {
    try {
      localStorage.setItem(LB_KEY, JSON.stringify(a));
    } catch (e) {}
  }

  function dedupe(a) {
    var map = {};
    for (var i = 0; i < a.length; i++) {
      var e = a[i];
      if (e && typeof e.score === "number") map[e.name + "|" + e.score + "|" + e.date] = e;
    }
    return Object.keys(map).map(function (k) {
      return map[k];
    });
  }

  function top10(a) {
    return a
      .slice()
      .sort(function (x, y) {
        return y.score - x.score;
      })
      .slice(0, MAX);
  }

  function cloudCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CLOUD_CACHE_KEY));
      return Array.isArray(c) ? c : null;
    } catch (e) {
      return null;
    }
  }

  function setCloudCache(a) {
    try {
      localStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify(a));
    } catch (e) {}
  }

  /* Shared board = local entries merged with the last known cloud board */
  function mergedBoard() {
    var remote = lastRemote || cloudCache() || [];
    return top10(dedupe(load().concat(remote)));
  }

  function getBest() {
    try {
      return parseInt(localStorage.getItem(BEST_KEY), 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function getGames() {
    try {
      return parseInt(localStorage.getItem(GAMES_KEY), 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  /* ---------- Leaderboard API (used by game.js) ---------- */
  function qualifies(score) {
    if (!score || score <= 0) return null;
    var board = mergedBoard();
    var rank = 1;
    for (var i = 0; i < board.length; i++) {
      if (board[i].score > score) rank++;
      else break;
    }
    return rank <= MAX ? { rank: rank } : null;
  }

  function submit(name, score) {
    var board = load();
    var entry = {
      name: String(name || "Player").trim().slice(0, 16) || "Player",
      score: Math.floor(score) || 0,
      date: Date.now()
    };
    board.push(entry);
    save(board);
    lastEntryDate = entry.date;
    var q = qualifies(entry.score);
    render();
    updateStats();
    pushCloud();
    return q ? q.rank : 0;
  }

  /* ---------- Cloud sync (jsonstorage.net, public-write key) ---------- */
  var syncStatusEl = document.getElementById("syncStatus");
  var refreshBtn = document.getElementById("refreshBoard");

  function setSyncStatus(state) {
    if (!syncStatusEl) return;
    syncStatusEl.classList.remove("offline", "loading");
    var label;
    if (state === "loading") {
      syncStatusEl.classList.add("loading");
      label = "Syncing…";
    } else if (state === "offline") {
      syncStatusEl.classList.add("offline");
      label = "Offline — showing saved board";
    } else {
      label = "Live";
    }
    syncStatusEl.innerHTML = '<span class="dot"></span>' + label;
  }

  function fetchCloud() {
    if (!window.fetch) return;
    setSyncStatus("loading");
    var t = Date.now();
    fetch(CLOUD_ITEM + "?t=" + t, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("status " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (Array.isArray(data)) {
          lastRemote = data;
          setCloudCache(data);
          render();
          updateStats();
          setSyncStatus("live");
        }
      })
      .catch(function (err) {
        console.warn("Leaderboard cloud sync failed:", err);
        setSyncStatus("offline");
      });
  }

  function pushCloud() {
    if (cloudBusy || !window.fetch) return;
    cloudBusy = true;
    var payload = mergedBoard();
    fetch(CLOUD_ITEM + "?apiKey=" + encodeURIComponent(CLOUD_KEY), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (res.ok) {
          lastRemote = payload;
          setCloudCache(payload);
        }
      })
      .catch(function () {})
      .then(function () {
        cloudBusy = false;
      });
  }

  /* ---------- Render ---------- */
  var podiumEl = document.getElementById("podium");
  var bodyEl = document.getElementById("boardBody");
  var emptyEl = document.getElementById("boardEmpty");

  var MEDALS = ["🥇", "🥈", "🥉"];

  function renderPodium(board) {
    if (!podiumEl) return;
    podiumEl.innerHTML = "";
    if (!board.length) return;
    for (var i = 0; i < 3 && i < board.length; i++) {
      var e = board[i];
      var slot = document.createElement("div");
      slot.className = "podium-slot podium-" + (i + 1);
      slot.innerHTML =
        '<div class="podium-medal">' + MEDALS[i] + "</div>" +
        '<div class="podium-name"></div>' +
        '<div class="podium-score"></div>';
      slot.querySelector(".podium-name").textContent = e.name;
      slot.querySelector(".podium-score").textContent = e.score.toLocaleString();
      podiumEl.appendChild(slot);
    }
  }

  function renderBoard(board) {
    if (!bodyEl) return;
    bodyEl.innerHTML = "";
    if (emptyEl) emptyEl.style.display = board.length ? "none" : "block";
    board.forEach(function (e, i) {
      var tr = document.createElement("tr");
      if (lastEntryDate && e.date === lastEntryDate) tr.className = "lb-new";
      var dateStr = new Date(e.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      });
      tr.innerHTML =
        '<td class="lb-rank">#' + (i + 1) + "</td>" +
        '<td class="lb-name"></td>' +
        '<td class="lb-score">' + e.score.toLocaleString() + "</td>" +
        '<td class="lb-date">' + dateStr + "</td>";
      tr.querySelector(".lb-name").textContent = e.name;
      bodyEl.appendChild(tr);
    });
  }

  function render() {
    var board = mergedBoard();
    renderPodium(board);
    renderBoard(board);
  }

  /* ---------- Hero stats ---------- */
  function updateStats() {
    var sb = document.getElementById("statBest");
    var sg = document.getElementById("statGames");
    var st = document.getElementById("statTop");
    var board = mergedBoard();
    if (sb) sb.textContent = getBest().toLocaleString();
    if (sg) sg.textContent = getGames().toLocaleString();
    if (st) st.textContent = (board.length ? board[0].score : 0).toLocaleString();
  }

  window.SuikaLB = {
    qualifies: qualifies,
    submit: submit,
    render: render,
    getBest: getBest,
    refresh: updateStats
  };

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  render();
  updateStats();
  fetchCloud();
  if (refreshBtn) refreshBtn.addEventListener("click", fetchCloud);
})();
