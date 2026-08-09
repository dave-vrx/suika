(function () {
  "use strict";

  var canvas = document.getElementById("suikaCanvas");
  if (!canvas) return;

  var W = 440;
  var H = 640;
  var WALL_L = 20;
  var WALL_R = W - 20;
  var FLOOR_Y = H - 20;
  var TOP_Y = 66;
  var HOVER_Y = 10;

  var FRUITS = [
    { e: "🍒", r: 14, s: 1 },
    { e: "🍓", r: 18, s: 2 },
    { e: "🍇", r: 23, s: 4 },
    { e: "🍋", r: 29, s: 8 },
    { e: "🍊", r: 36, s: 16 },
    { e: "🍎", r: 44, s: 32 },
    { e: "🍐", r: 54, s: 64 },
    { e: "🍑", r: 66, s: 128 },
    { e: "🍍", r: 81, s: 256 },
    { e: "🍈", r: 99, s: 512 },
    { e: "🍉", r: 120, s: 1024 }
  ];

  var GRAVITY = 2200;
  var RESTITUTION = 0.2;
  var FRICTION = 0.35;
  var CONTACT_FRICTION = 0.97;
  var BEST_KEY = "suikaleague_best";
  var GAMES_KEY = "suika_games";
  var DEATH_Y = 40;
  var REST_MS = 1000;

  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  var nextCanvas = document.getElementById("nextCanvas");
  var nextCtx = nextCanvas ? nextCanvas.getContext("2d") : null;
  if (nextCanvas) {
    nextCanvas.width = 100 * dpr;
    nextCanvas.height = 100 * dpr;
    nextCtx.scale(dpr, dpr);
  }
  var chainCtxs = [];

  function withCtx(c, fn) {
    var prev = ctx;
    ctx = c;
    try { fn(); } finally { ctx = prev; }
  }

  var fruits = [];
  var floaters = [];
  var rings = [];
  var score = 0;
  var best = 0;
  try {
    best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0;
  } catch (e) {}

  var aimX = W / 2;
  var touchAiming = false;
  var curType = randomRank();
  var nextType = randomRank();
  var dropLocked = false;
  var dropLockedAt = 0;
  var playing = true;
  var gameOver = false;
  var chain = 0;
  var lastTime = null;
  var shake = 0;
  var blinkMode = null;
  var blinkEnd = 0;
  var nextBlinkAt = performance.now() + 1500;

  var scoreEl = document.getElementById("score");
  var bestEl = document.getElementById("best");
  var overlay = document.getElementById("gameOverlay");
  var finalScoreEl = document.getElementById("finalScore");
  var newBestEl = document.getElementById("newBest");
  var restartBtn = document.getElementById("restartBtn");
  var rankBox = document.getElementById("rankBox");
  var finalRankEl = document.getElementById("finalRank");
  var nameInput = document.getElementById("nameInput");
  var submitScoreBtn = document.getElementById("submitScore");
  var lastName = "";
  var pendingSaved = false;

  bestEl.textContent = best.toLocaleString();
  buildChainLegend();

  function buildChainLegend() {
    var chainEl = document.getElementById("fruitChain");
    if (!chainEl) return;
    chainCtxs = [];
    chainEl.innerHTML = "";
    for (var t = 0; t < FRUITS.length; t++) {
      if (t > 0) {
        var arrow = document.createElement("span");
        arrow.className = "chain-arrow";
        arrow.innerHTML = "&rarr;";
        chainEl.appendChild(arrow);
      }
      var c = document.createElement("canvas");
      c.className = "chain-canvas" + (t === FRUITS.length - 1 ? " chain-final" : "");
      c.width = 34 * dpr;
      c.height = 34 * dpr;
      var cc = c.getContext("2d");
      cc.scale(dpr, dpr);
      chainEl.appendChild(c);
      chainCtxs.push({ ctx: cc, t: t });
    }
  }

  function renderNext() {
    if (!nextCtx) return;
    withCtx(nextCtx, function () {
      ctx.clearRect(0, 0, 100, 100);
      ctx.save();
      ctx.translate(50, 51);
      var pr = 14 + nextType * 4;
      drawFruitShape(nextType, pr);
      ctx.restore();
      drawFace(50, 51, pr);
    });
  }

  function renderChain() {
    chainCtxs.forEach(function (item) {
      withCtx(item.ctx, function () {
        ctx.clearRect(0, 0, 34, 34);
        ctx.save();
        ctx.translate(17, 18);
        drawFruitShape(item.t, 15);
        ctx.restore();
        drawFace(17, 18, 15);
      });
    });
  }

  function randomRank() {
    return Math.floor(Math.random() * 5);
  }

  function markHad(f) {
    if (!f.had) {
      f.had = true;
      playCollision();
      dropLocked = false;
    }
  }

  var audioCtx = null;
  function ac() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, endFreq, dur, type, gain) {
    var c = ac();
    if (!c) return;
    var t0 = c.currentTime;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t0 + dur);
    g.gain.setValueAtTime(gain || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur);
  }
  function playDrop() { tone(150, 70, 0.12, "triangle", 0.25); }
  function playCollision() { tone(330, 220, 0.05, "sine", 0.1); }
  function playCombo() { tone(430 * (1 + chain / 6), 860 * (1 + chain / 6), 0.1, "sine", 0.16); }

  function clampX(x, r) {
    return Math.max(WALL_L + r, Math.min(WALL_R - r, x));
  }

  function dropAt(x) {
    if (!playing || gameOver) return;
    if (dropLocked) return;
    var f = FRUITS[curType];
    fruits.push({ t: curType, x: clampX(x, f.r), y: -f.r, vx: 0, vy: 0, age: 0, angle: 0, w: 0, had: false, aboveSince: 0, spawn: 1 });
    addScore(1 << curType, clampX(x, f.r), 0, false);
    curType = nextType;
    nextType = randomRank();
    chain = 0;
    dropLocked = true;
    dropLockedAt = performance.now();
    playDrop();
  }

  function addScore(points, x, y, show) {
    score += points;
    scoreEl.textContent = score.toLocaleString();
    if (show !== false) floaters.push({ x: x, y: y, text: "+" + points, life: 1 });
  }

  function addRing(x, y, r) {
    rings.push({ x: x, y: y, r: r, life: 1 });
  }

  function mergeFruit(i, j) {
    var a = fruits[i];
    var b = fruits[j];
    if (a.t !== b.t || a.t >= FRUITS.length - 1) return false;
    var nt = a.t + 1;
    var mx = (a.x + b.x) / 2;
    var my = (a.y + b.y) / 2;
    addScore(FRUITS[nt].s, mx, my);
    addRing(mx, my, FRUITS[nt].r);
    chain++;
    fruits.push({
      t: nt,
      x: mx,
      y: my,
      vx: (a.vx + b.vx) / 4,
      vy: Math.min(a.vy, b.vy) * 0.4,
      age: Math.min(a.age, b.age),
      angle: (a.angle + b.angle) / 2,
      w: (a.w + b.w) / 4,
      had: true,
      aboveSince: 0,
      spawn: 0
    });
    playCombo();
    a.dead = true;
    b.dead = true;
    return true;
  }

  function substep(h) {
    var i, j;
    for (i = 0; i < fruits.length; i++) {
      var f = fruits[i];
      if (f.dead) continue;
      var r = FRUITS[f.t].r;
      f.age += h;
      if (f.spawn !== undefined && f.spawn < 1) f.spawn = Math.min(1, f.spawn + h * 6);
      f.vy += GRAVITY * h;
      f.x += f.vx * h;
      f.y += f.vy * h;
      f.angle += f.w * h;
      var fspd = Math.abs(f.vx) + Math.abs(f.vy);
      if (fspd < 40) f.w *= Math.max(0, 1 - 12 * h);
      else f.w *= Math.max(0, 1 - 1.2 * h);
      if (fspd < 6 && Math.abs(f.w) < 0.6) f.w = 0;
      var maxW = 16;
      if (f.w > maxW) f.w = maxW; else if (f.w < -maxW) f.w = -maxW;
      if (f.x - r < WALL_L) {
        f.x = WALL_L + r;
        f.vx = Math.abs(f.vx) * 0.3;
        f.w *= 0.96;
        markHad(f);
      }
      if (f.x + r > WALL_R) {
        f.x = WALL_R - r;
        f.vx = -Math.abs(f.vx) * 0.3;
        f.w *= 0.96;
        markHad(f);
      }
      if (f.y + r > FLOOR_Y) {
        f.y = FLOOR_Y - r;
        if (f.vy > 0) f.vy = -f.vy * RESTITUTION;
        f.vx *= CONTACT_FRICTION;
        f.w *= 0.94;
        markHad(f);
      }
      f.vx *= 0.999;
    }

    for (var iter = 0; iter < 4; iter++) {
      for (i = 0; i < fruits.length; i++) {
        var a = fruits[i];
        if (a.dead) continue;
        var ra = FRUITS[a.t].r;
        var ma = ra * ra;
        var invA = 1 / ma;
        var invIA = 2 / (ma * ra * ra);
        for (j = i + 1; j < fruits.length; j++) {
          var b = fruits[j];
          if (b.dead) continue;
          var rb = FRUITS[b.t].r;
          var dx = b.x - a.x;
          var dy = b.y - a.y;
          var minDist = ra + rb;
          var dist2 = dx * dx + dy * dy;
          if (dist2 >= minDist * minDist || dist2 === 0) continue;
          markHad(a);
          markHad(b);
          var dist = Math.sqrt(dist2);
          var overlap = minDist - dist;
          var nx = dx / dist;
          var ny = dy / dist;
          var mb = rb * rb;
          var invB = 1 / mb;
          var invIB = 2 / (mb * rb * rb);
          var total = ma + mb;

          a.x -= nx * overlap * (mb / total);
          a.y -= ny * overlap * (mb / total);
          b.x += nx * overlap * (ma / total);
          b.y += ny * overlap * (ma / total);

          var avx = a.vx - a.w * ny * ra;
          var avy = a.vy + a.w * nx * ra;
          var bvx = b.vx + b.w * ny * rb;
          var bvy = b.vy - b.w * nx * rb;
          var rvx = bvx - avx;
          var rvy = bvy - avy;
          var relN = rvx * nx + rvy * ny;
          if (relN < 0) {
            var invMN = invA + invB;
            var jn = -(1 + RESTITUTION) * relN / invMN;
            a.vx -= jn * nx * invA;
            a.vy -= jn * ny * invA;
            b.vx += jn * nx * invB;
            b.vy += jn * ny * invB;

            var tx = -ny;
            var ty = nx;
            var relT = rvx * tx + rvy * ty;
            var invMT = invA + invB + ra * ra * invIA + rb * rb * invIB;
            var jt = -relT / invMT;
            var maxF = FRICTION * jn;
            if (jt > maxF) jt = maxF;
            else if (jt < -maxF) jt = -maxF;
            a.vx -= jt * tx * invA;
            a.vy -= jt * ty * invA;
            b.vx += jt * tx * invB;
            b.vy += jt * ty * invB;
            a.w -= jt * ra * invIA;
            b.w -= jt * rb * invIB;
          }
        }
      }
    }

    var merged = false;
    var budget = 5;
    outer: while (budget-- > 0) {
      for (i = 0; i < fruits.length; i++) {
        var a2 = fruits[i];
        if (a2.dead) continue;
        for (j = i + 1; j < fruits.length; j++) {
          var b2 = fruits[j];
          if (b2.dead) continue;
          if (a2.t !== b2.t || a2.t >= FRUITS.length - 1) continue;
          var ra2 = FRUITS[a2.t].r;
          var rb2 = FRUITS[b2.t].r;
          var dx2 = b2.x - a2.x;
          var dy2 = b2.y - a2.y;
          var rr2 = ra2 + rb2;
          var slop = Math.min(6, Math.max(2, rr2 * 0.03));
          if (dx2 * dx2 + dy2 * dy2 <= (rr2 + slop) * (rr2 + slop)) {
            markHad(a2);
            markHad(b2);
            mergeFruit(i, j);
            merged = true;
            continue outer;
          }
        }
      }
      break;
    }
    fruits = fruits.filter(function (f) { return !f.dead; });
    return merged;
  }

  function checkGameOver() {
    var now = performance.now();
    for (var i = 0; i < fruits.length; i++) {
      var f = fruits[i];
      if (!f.had) continue;
      if (f.y - FRUITS[f.t].r < DEATH_Y) return true;
      var bottom = f.y + FRUITS[f.t].r;
      if (bottom > TOP_Y || Math.abs(f.vx) + Math.abs(f.vy) > 60) {
        f.aboveSince = 0;
      } else if (f.aboveSince === 0) {
        f.aboveSince = now;
      } else if (now - f.aboveSince > REST_MS) {
        return true;
      }
    }
    return false;
  }

  function saveScore() {
    if (pendingSaved || !window.SuikaLB) return;
    var name = nameInput ? (nameInput.value.trim() || "Player") : "Player";
    name = name.slice(0, 16);
    var rank = window.SuikaLB.submit(name, score);
    lastName = name;
    pendingSaved = true;
    if (finalRankEl) finalRankEl.textContent = "#" + rank;
    if (submitScoreBtn) {
      submitScoreBtn.disabled = true;
      submitScoreBtn.textContent = "Saved ✓";
    }
    if (rankBox) {
      var t = rankBox.querySelector(".rank-title");
      if (t) t.textContent = "Score saved!";
    }
  }

  function endGame() {
    gameOver = true;
    shake = 1;
    var isNew = score > best;
    if (isNew) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
      bestEl.textContent = best.toLocaleString();
    }
    try {
      var games = parseInt(localStorage.getItem(GAMES_KEY), 10) || 0;
      localStorage.setItem(GAMES_KEY, String(games + 1));
    } catch (e) {}
    if (window.SuikaLB && window.SuikaLB.refresh) window.SuikaLB.refresh();
    finalScoreEl.textContent = score.toLocaleString();
    newBestEl.hidden = !isNew;
    pendingSaved = false;
    if (rankBox) {
      var q = window.SuikaLB ? window.SuikaLB.qualifies(score) : null;
      if (q && submitScoreBtn) {
        rankBox.hidden = false;
        finalRankEl.textContent = "#" + q.rank;
        nameInput.value = lastName || "";
        submitScoreBtn.disabled = false;
        submitScoreBtn.textContent = "Save Score";
        var t = rankBox.querySelector(".rank-title");
        if (t) t.textContent = "You made the leaderboard!";
        overlay.hidden = false;
        nameInput.focus();
      } else {
        rankBox.hidden = true;
      }
    }
    overlay.hidden = false;
  }

  function restart() {
    if (score > 0 && !pendingSaved && rankBox && !rankBox.hidden) saveScore();
    fruits = [];
    floaters = [];
    rings = [];
    score = 0;
    chain = 0;
    shake = 0;
    scoreEl.textContent = "0";
    gameOver = false;
    playing = true;
    dropLocked = false;
    aimX = W / 2;
    if (rankBox) rankBox.hidden = true;
    pendingSaved = false;
    overlay.hidden = true;
    curType = randomRank();
    nextType = randomRank();
  }

  function drawFruit(x, y, t, scale, angle) {
    var f = FRUITS[t];
    var s = scale || 1;
    if (!scale) {
      var sg = ctx.createRadialGradient(x + f.r * 0.08, y + f.r * 0.55, f.r * 0.1, x + f.r * 0.08, y + f.r * 0.55, f.r * 0.8);
      sg.addColorStop(0, "rgba(0,0,0,0.38)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(x + f.r * 0.08, y + f.r * 0.55, f.r * 0.85, f.r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x, y + 1);
    ctx.rotate(angle || 0);
    drawFruitShape(t, f.r * s);
    ctx.restore();
    drawFace(x, y + 1, f.r * s);
  }

  function drawFace(x, y, R) {
    if (R < 11) return;
    var eyeX = R * 0.32;
    var eyeY = -R * 0.08;
    var eyeR = Math.max(1.8, R * 0.13);
    var lineW = Math.max(1.2, R * 0.07);

    function openEye(cx) {
      ctx.fillStyle = "#241510";
      ctx.beginPath();
      ctx.arc(cx, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(cx - eyeR * 0.3, eyeY - eyeR * 0.3, Math.max(0.8, eyeR * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }

    function closedEye(cx) {
      ctx.strokeStyle = "#241510";
      ctx.lineWidth = lineW;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, eyeY + eyeR * 0.1, eyeR * 1.1, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
    }

    if (blinkMode === "both" || blinkMode === "left") closedEye(-eyeX);
    else openEye(-eyeX);
    if (blinkMode === "both" || blinkMode === "right") closedEye(eyeX);
    else openEye(eyeX);

    ctx.strokeStyle = "#241510";
    ctx.lineWidth = lineW;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, R * 0.14, Math.max(2, R * 0.16), 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
  }

  function ball(cx, cy, r, base, light, dark) {
    var g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.12, cx, cy, r);
    g.addColorStop(0, light);
    g.addColorStop(0.45, base);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.35, cy - r * 0.45, r * 0.28, r * 0.18, -0.6, 0, Math.PI * 2);
    ctx.fill();
    var og = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
    og.addColorStop(0, "rgba(0,0,0,0)");
    og.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(30,20,10,0.35)";
    ctx.lineWidth = Math.max(1.2, r * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawFruitShape(t, R) {
    var palette = [
      ["#e63946", "#ff93a0", "#8f1d26"], // cherry
      ["#ff4f66", "#ff9aa8", "#b01f33"], // strawberry
      ["#8e44ad", "#c39bd3", "#5b2c6f"], // grape
      ["#ffd23f", "#fff0a3", "#c99700"], // lemon
      ["#ff8c33", "#ffc494", "#c65d00"], // orange
      ["#e63946", "#ff93a0", "#8f1d26"], // apple
      ["#c6d64a", "#eef3b0", "#7d8f22"], // pear
      ["#ffab7a", "#ffd6bd", "#d97a3f"], // peach
      ["#ffd23f", "#fff0a3", "#c99700"], // pineapple
      ["#6db86b", "#a8dfa6", "#3f7d3d"], // melon
      ["#3e9b4f", "#7fd48d", "#1f5c2b"]  // watermelon
    ];
    var c = palette[t] || palette[10];
    ball(0, 0, R, c[0], c[1], c[2]);

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();

    function leaf(cx, cy, rx, ry, rot) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (t === 0) { // cherry: deep gloss + tiny stem
      ctx.strokeStyle = "#4a7a3a";
      ctx.lineWidth = Math.max(1, R * 0.08);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.88);
      ctx.quadraticCurveTo(R * 0.28, -R * 0.95, R * 0.36, -R * 0.72);
      ctx.stroke();
    }

    if (t === 1) { // strawberry: leaf fan + seeds
      ctx.fillStyle = "#2e7d32";
      for (var li = -2; li <= 2; li++) {
        leaf(li * R * 0.16, -R * 0.82, R * 0.2, R * 0.3, li * 0.35);
      }
      ctx.fillStyle = "rgba(255,235,130,0.9)";
      var seeds = [
        [-0.35, 0.08], [0.35, 0.08],
        [-0.55, 0.3], [0, 0.3], [0.55, 0.3],
        [-0.38, 0.52], [0.38, 0.52],
        [0, 0.72]
      ];
      for (var s = 0; s < seeds.length; s++) {
        ctx.beginPath();
        ctx.ellipse(seeds[s][0] * R, seeds[s][1] * R, Math.max(1, R * 0.045), Math.max(1.5, R * 0.07), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (t === 2) { // grapes: cluster + highlights + leaf
      var gs = [
        [-0.28, 0.4, 0.3], [0.28, 0.4, 0.3],
        [-0.5, 0.08, 0.26], [0.5, 0.08, 0.26], [0, 0.08, 0.26],
        [-0.32, -0.24, 0.22], [0.32, -0.24, 0.22],
        [0, -0.5, 0.18],
        [0, 0.72, 0.22]
      ];
      for (var g = 0; g < gs.length; g++) {
        ctx.fillStyle = "#6d3a96";
        ctx.beginPath();
        ctx.arc(gs[g][0] * R, gs[g][1] * R, gs[g][2] * R, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (var gh = 0; gh < gs.length; gh++) {
        ctx.beginPath();
        ctx.arc((gs[gh][0] - gs[gh][2] * 0.35) * R, (gs[gh][1] - gs[gh][2] * 0.4) * R, gs[gh][2] * R * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#3f9b3f";
      for (var gl = -1; gl <= 1; gl++) {
        leaf(gl * R * 0.2, -R * 0.55, R * 0.24, R * 0.13, gl * 0.4);
      }
    }

    if (t === 3) { // lemon: dimpled pores + tip
      for (var d = 0; d < 34; d++) {
        var rr = Math.sqrt(d / 34) * R * 0.92;
        var ang = d * 2.39996;
        ctx.fillStyle = d % 3 === 0 ? "rgba(200,150,0,0.32)" : "rgba(255,255,255,0.16)";
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, Math.max(0.7, R * 0.032), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#5a7a3a";
      ctx.lineWidth = Math.max(1, R * 0.07);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.92);
      ctx.quadraticCurveTo(R * 0.22, -R * 0.96, R * 0.3, -R * 0.8);
      ctx.stroke();
    }

    if (t === 4) { // orange: pores + leaf + stem
      for (var o = 0; o < 30; o++) {
        var orr = Math.sqrt(o / 30) * R * 0.9;
        var oang = o * 2.39996;
        ctx.fillStyle = o % 3 === 0 ? "rgba(170,90,0,0.3)" : "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.arc(Math.cos(oang) * orr, Math.sin(oang) * orr, Math.max(0.8, R * 0.04), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#5a7a3a";
      ctx.lineWidth = Math.max(1, R * 0.07);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.9);
      ctx.quadraticCurveTo(R * 0.18, -R * 0.95, R * 0.26, -R * 0.78);
      ctx.stroke();
      ctx.fillStyle = "#3f9b3f";
      leaf(R * 0.38, -R * 0.68, R * 0.2, R * 0.12, 0.5);
    }

    if (t === 5) { // apple: stem + leaf
      ctx.strokeStyle = "#5a3a22";
      ctx.lineWidth = Math.max(1.2, R * 0.07);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.86);
      ctx.quadraticCurveTo(R * 0.1, -R * 0.98, R * 0.22, -R * 0.82);
      ctx.stroke();
      ctx.fillStyle = "#3f9b3f";
      leaf(R * 0.36, -R * 0.8, R * 0.24, R * 0.12, 0.5);
    }

    if (t === 6) { // pear: stem + bottom shade
      ctx.strokeStyle = "#5a3a22";
      ctx.lineWidth = Math.max(1.2, R * 0.07);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.88);
      ctx.quadraticCurveTo(R * 0.06, -R * 0.98, R * 0.14, -R * 0.85);
      ctx.stroke();
      var psh = ctx.createRadialGradient(0, R * 0.5, R * 0.1, 0, R * 0.5, R * 0.9);
      psh.addColorStop(0, "rgba(0,0,0,0)");
      psh.addColorStop(1, "rgba(80,60,20,0.3)");
      ctx.fillStyle = psh;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
    }

    if (t === 7) { // peach: crease + blush + leaf
      ctx.strokeStyle = "rgba(150,70,30,0.35)";
      ctx.lineWidth = Math.max(1, R * 0.06);
      ctx.beginPath();
      ctx.moveTo(-R * 0.12, -R * 0.8);
      ctx.quadraticCurveTo(R * 0.15, 0, -R * 0.12, R * 0.8);
      ctx.stroke();
      var blush = function (sx) {
        var bg = ctx.createRadialGradient(sx * R * 0.5, R * 0.2, 0, sx * R * 0.5, R * 0.2, R * 0.55);
        bg.addColorStop(0, "rgba(255,110,140,0.4)");
        bg.addColorStop(1, "rgba(255,110,140,0)");
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fill();
      };
      blush(-1);
      blush(1);
      ctx.fillStyle = "#3f9b3f";
      leaf(R * 0.32, -R * 0.78, R * 0.22, R * 0.11, -0.35);
    }

    if (t === 8) { // pineapple: lattice + eyes + crown
      ctx.strokeStyle = "rgba(180,130,0,0.55)";
      ctx.lineWidth = Math.max(1, R * 0.05);
      ctx.beginPath();
      for (var pk = -2; pk <= 2; pk++) {
        var po = pk * R * 0.32;
        ctx.moveTo(po, -R * 0.9);
        ctx.lineTo(po + R * 0.5, R * 0.9);
      }
      for (var pk2 = -2; pk2 <= 2; pk2++) {
        var po2 = pk2 * R * 0.32 + R * 0.15;
        ctx.moveTo(po2 - R * 0.1, -R * 0.9);
        ctx.lineTo(po2 - R * 0.6, R * 0.9);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(255,235,130,0.5)";
      for (var pn = 0; pn < 10; pn++) {
        var pr2 = Math.sqrt(pn / 10) * R * 0.85;
        var pang = pn * 2.39996;
        ctx.beginPath();
        ctx.arc(Math.cos(pang) * pr2, Math.sin(pang) * pr2, Math.max(0.8, R * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#2e7d32";
      for (var pl = -2; pl <= 2; pl++) {
        leaf(pl * R * 0.22, -R * 0.6, R * 0.2, R * 0.28, pl * 0.3);
      }
    }

    if (t === 9) { // melon netting
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(1, R * 0.04);
      ctx.beginPath();
      for (var m1 = -1; m1 <= 1; m1++) {
        var my = m1 * R * 0.4;
        ctx.moveTo(-R * 0.85, my);
        ctx.quadraticCurveTo(0, my + R * 0.15, R * 0.85, my);
      }
      for (var m2 = -1; m2 <= 1; m2++) {
        var mx = m2 * R * 0.4;
        ctx.moveTo(mx, -R * 0.85);
        ctx.quadraticCurveTo(mx + R * 0.15, 0, mx, R * 0.85);
      }
      ctx.stroke();
    }

    if (t === 10) { // watermelon stripes
      ctx.fillStyle = "rgba(16,72,34,0.85)";
      for (var sw = -3; sw <= 3; sw++) {
        ctx.beginPath();
        ctx.ellipse(sw * R * 0.34, 0, R * 0.14, R * 0.98, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    if (t === 10) { // re-glint over stripes
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(-R * 0.35, -R * 0.45, R * 0.26, R * 0.16, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground() {
    var bg = ctx.createRadialGradient(W / 2, H * 0.4, 60, W / 2, H * 0.55, W * 0.8);
    bg.addColorStop(0, "#182b1e");
    bg.addColorStop(0.7, "#0d1811");
    bg.addColorStop(1, "#060b08");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRectPath(7, 9, W - 14, H - 18, 16);
    ctx.fill();
    var bez = ctx.createLinearGradient(0, 0, 0, H);
    bez.addColorStop(0, "#40654b");
    bez.addColorStop(0.12, "#27432f");
    bez.addColorStop(1, "#0e1c12");
    ctx.fillStyle = bez;
    roundRectPath(4, 4, W - 8, H - 8, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(200,240,210,0.4)";
    ctx.lineWidth = 2;
    roundRectPath(5, 5, W - 10, H - 10, 15);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    roundRectPath(10, 10, W - 20, H - 20, 13);
    ctx.stroke();

    var fl = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    fl.addColorStop(0, "rgba(120,220,150,0.18)");
    fl.addColorStop(0.5, "rgba(90,190,120,0.05)");
    fl.addColorStop(1, "rgba(142,240,160,0.20)");
    ctx.fillStyle = fl;
    ctx.fillRect(WALL_L, 0, WALL_R - WALL_L, FLOOR_Y);

    ctx.strokeStyle = "rgba(142,240,160,0.09)";
    ctx.lineWidth = 1;
    for (var v = -3; v <= 3; v++) {
      var xb = W / 2 + v * (WALL_R - WALL_L) * 0.2;
      ctx.beginPath();
      ctx.moveTo(xb, FLOOR_Y);
      ctx.lineTo(W / 2, TOP_Y - 14);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(142,240,160,0.08)";
    for (var hz = 1; hz <= 5; hz++) {
      var ty = FLOOR_Y * (1 - Math.pow(hz / 5, 2) * 0.98);
      ctx.beginPath();
      ctx.moveTo(WALL_L + 2, ty);
      ctx.lineTo(WALL_R - 2, ty);
      ctx.stroke();
    }

    var glow = ctx.createRadialGradient(W / 2, FLOOR_Y - 30, 20, W / 2, FLOOR_Y - 30, 260);
    glow.addColorStop(0, "rgba(150,255,170,0.12)");
    glow.addColorStop(1, "rgba(150,255,170,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(WALL_L, 0, WALL_R - WALL_L, FLOOR_Y);

    var lw = ctx.createLinearGradient(0, 0, 0, FLOOR_Y + 18);
    lw.addColorStop(0, "#152719");
    lw.addColorStop(0.6, "#23422c");
    lw.addColorStop(1, "#2e5038");
    ctx.fillStyle = lw;
    ctx.beginPath();
    ctx.moveTo(WALL_L - 26, 0);
    ctx.lineTo(WALL_L, 0);
    ctx.lineTo(WALL_L, FLOOR_Y);
    ctx.lineTo(WALL_L - 26, FLOOR_Y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(142,240,160,0.30)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(WALL_L, 0);
    ctx.lineTo(WALL_L, FLOOR_Y);
    ctx.stroke();

    var rw = ctx.createLinearGradient(0, 0, 0, FLOOR_Y + 18);
    rw.addColorStop(0, "#152719");
    rw.addColorStop(0.6, "#23422c");
    rw.addColorStop(1, "#2e5038");
    ctx.fillStyle = rw;
    ctx.beginPath();
    ctx.moveTo(WALL_R + 26, 0);
    ctx.lineTo(WALL_R, 0);
    ctx.lineTo(WALL_R, FLOOR_Y);
    ctx.lineTo(WALL_R + 26, FLOOR_Y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(142,240,160,0.30)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(WALL_R, 0);
    ctx.lineTo(WALL_R, FLOOR_Y);
    ctx.stroke();

    var lip = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
    lip.addColorStop(0, "rgba(160,255,180,0.35)");
    lip.addColorStop(0.15, "rgba(90,190,120,0.18)");
    lip.addColorStop(1, "rgba(30,80,45,0.5)");
    ctx.fillStyle = lip;
    ctx.beginPath();
    ctx.moveTo(WALL_L, FLOOR_Y);
    ctx.lineTo(WALL_R, FLOOR_Y);
    ctx.lineTo(WALL_R + 26, FLOOR_Y + 18);
    ctx.lineTo(WALL_L - 26, FLOOR_Y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(190,255,205,0.5)";
    ctx.fillRect(WALL_L, FLOOR_Y, WALL_R - WALL_L, 2);

    var dz = ctx.createLinearGradient(0, 0, 0, TOP_Y);
    dz.addColorStop(0, "rgba(230,57,70,0.28)");
    dz.addColorStop(1, "rgba(230,57,70,0)");
    ctx.fillStyle = dz;
    ctx.fillRect(WALL_L, 0, WALL_R - WALL_L, TOP_Y);

    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = "rgba(230,57,70,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(WALL_L, TOP_Y);
    ctx.lineTo(WALL_R, TOP_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    var rim = ctx.createLinearGradient(0, 0, 0, 9);
    rim.addColorStop(0, "#2c4f36");
    rim.addColorStop(1, "#12251a");
    ctx.fillStyle = rim;
    ctx.fillRect(WALL_L - 26, 0, (WALL_R - WALL_L) + 52, 9);
    ctx.fillStyle = "rgba(200,255,215,0.35)";
    ctx.fillRect(WALL_L - 26, 0, (WALL_R - WALL_L) + 52, 1);

    ctx.fillStyle = "rgba(230,57,70,0.5)";
    ctx.font = "700 9px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("DANGER LINE", W / 2, TOP_Y + 4);
  }

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (shake > 0) {
      var s = shake * shake * 8;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    drawBackground();

    for (var i = 0; i < fruits.length; i++) {
      var f = fruits[i];
      var sp = (f.spawn !== undefined && f.spawn < 1) ? 0.6 + 0.4 * f.spawn : undefined;
      drawFruit(f.x, f.y, f.t, sp, f.angle);
    }

    for (var k = 0; k < rings.length; k++) {
      var rg = rings[k];
      var rr = rg.r * (1 + (1 - rg.life) * 2);
      ctx.globalAlpha = Math.max(rg.life, 0) * 0.7;
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (playing && !gameOver) {
      var nf = FRUITS[curType];
      var ax = clampX(aimX, nf.r);
      var ay = HOVER_Y + nf.r;
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = "rgba(142,240,160,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, HOVER_Y);
      ctx.lineTo(ax, FLOOR_Y);
      ctx.stroke();
      ctx.setLineDash([]);
      var pulse = 1 + Math.sin(performance.now() / 200) * 0.045;
      ctx.globalAlpha = dropLocked ? 0.5 : 0.95;
      drawFruit(ax, ay, curType, dropLocked ? 1 : pulse, 0);
      ctx.globalAlpha = 1;
    }

    for (var m = 0; m < floaters.length; m++) {
      var fl = floaters[m];
      ctx.globalAlpha = Math.max(fl.life, 0);
      ctx.fillStyle = "#ffe066";
      ctx.font = "700 15px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fl.text, fl.x, fl.y - (1 - fl.life) * 24);
    }
    ctx.globalAlpha = 1;

    if (chain >= 2) {
      ctx.fillStyle = "rgba(142,240,160,0.92)";
      ctx.font = "700 14px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("CHAIN x" + chain, W / 2, 8);
    }

    ctx.restore();
  }

  function loop(now) {
    if (lastTime === null) lastTime = now;
    var dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    var blinkNow = performance.now();
    if (blinkMode) {
      if (blinkNow >= blinkEnd) {
        blinkMode = null;
        nextBlinkAt = blinkNow + 700 + Math.random() * 1800;
      }
    } else if (blinkNow >= nextBlinkAt) {
      var br = Math.random();
      blinkMode = br < 0.45 ? "both" : (br < 0.72 ? "left" : "right");
      blinkEnd = blinkNow + 160;
    }

    if (playing && !gameOver) {
      var steps = 6;
      for (var s = 0; s < steps; s++) substep(dt / steps);

      for (var i = floaters.length - 1; i >= 0; i--) {
        floaters[i].life -= dt * 1.6;
        if (floaters[i].life <= 0) floaters.splice(i, 1);
      }

      for (var j = rings.length - 1; j >= 0; j--) {
        rings[j].life -= dt * 2.2;
        if (rings[j].life <= 0) rings.splice(j, 1);
      }

      if (shake > 0) shake = Math.max(0, shake - dt * 2.5);

      if (dropLocked && performance.now() - dropLockedAt > 1200) dropLocked = false;

      if (checkGameOver()) endGame();
    } else if (shake > 0) {
      shake = Math.max(0, shake - dt * 2.5);
    }

    draw();
    renderNext();
    renderChain();
    requestAnimationFrame(loop);
  }

  function toCanvasX(e) {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width) return aimX;
    return (e.clientX - rect.left) * (W / rect.width);
  }

  canvas.addEventListener("pointermove", function (e) {
    if (playing && !gameOver) aimX = toCanvasX(e);
  });

  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    aimX = toCanvasX(e);
    if (e.pointerType === "touch") {
      touchAiming = true;
      return;
    }
    if (gameOver) {
      restart();
      return;
    }
    dropAt(aimX);
  });

  canvas.addEventListener("pointerup", function (e) {
    if (e.pointerType === "touch" && touchAiming) {
      touchAiming = false;
      if (gameOver) restart();
      else dropAt(aimX);
    }
  });

  canvas.addEventListener("pointercancel", function () {
    touchAiming = false;
  });

  canvas.addEventListener("touchstart", function (e) {
    e.preventDefault();
  }, { passive: false });

  if (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) restart();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!playing) return;
    if (e.target && e.target.tagName === "INPUT") return;
    if (gameOver) {
      if (e.key === " " || e.key === "Enter") restart();
      return;
    }
    if (e.key === "ArrowLeft") { aimX -= 26; e.preventDefault(); }
    else if (e.key === "ArrowRight") { aimX += 26; e.preventDefault(); }
    else if (e.key === " " || e.key === "ArrowDown") { dropAt(aimX); e.preventDefault(); }
  });

  if (restartBtn) restartBtn.addEventListener("click", restart);
  if (submitScoreBtn) submitScoreBtn.addEventListener("click", saveScore);
  if (nameInput) {
    nameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        saveScore();
      }
    });
  }

  requestAnimationFrame(loop);
})();
