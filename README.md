<div align="center">

# 🍉 SUIKA GAME

**Drop melons. Chain combos. Beat the line.**

A fast, juicy take on the classic watermelon-merge puzzle — built for the browser, mobile-first, with a **shared online leaderboard** so every player fights for the same top 10.

[▶ Play Now](https://dave-vrx.github.io/suika/) · [🏆 Leaderboard](#leaderboard) · [📖 How to Play](#how-to-play)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-222222?style=for-the-badge&logo=github-pages&logoColor=white)

</div>

---

## ✨ Features

- 🍈 **Classic merge gameplay** — drop fruits, match two of the same kind, watch them evolve up the melon ladder
- 🎮 **Satisfying physics** — real-time collision, rotation, and bouncing in a 3D-styled cabinet
- 🏆 **Shared online leaderboard** — everyone plays for the same top 10, synced through the cloud
- 🏅 **Podium + hall of melons** — top 3 get a podium, and the full top 10 lives in the hall
- 📱 **Mobile-first** — drag-to-aim and release-to-drop touch controls, safe-area aware
- ✨ **Juicy presentation** — radial shadow drops, gradient hero, animated fruit
- 💾 **Offline-friendly** — scores cache locally and sync when the cloud is reachable

## 🎯 How to Play

1. Aim with your mouse or finger — a guide shows where the fruit will fall
2. Release to drop
3. Match two fruits of the same size to merge them into the next fruit up the chain
4. Don't let the pile cross the **danger line** — it's game over

> Bigger fruit = bigger points. Chain merges fast for combo bonuses and a shot at the top of the leaderboard.

## 🔧 Tech Stack

| Layer     | Choice                                          |
| --------- | ----------------------------------------------- |
| Frontend  | Vanilla HTML / CSS / JavaScript (no build step) |
| Rendering | HTML5 Canvas with a custom physics loop         |
| Hosting   | GitHub Pages                                     |
| Leaderboard | jsonstorage.net — public read, cloud-synced writes |

## 🚀 Getting Started

The whole game is plain static files — no build, no dependencies.

```bash
# clone it
git clone https://github.com/dave-vrx/suika.git
cd suika

# serve it locally (any static server works)
npx serve .
```

Then open `http://localhost:3000` (or just double-click `index.html`).

## 🏆 Leaderboard

The leaderboard is a **shared, global top 10** — not just your local best.

- Every page load fetches the live board from the cloud
- Saving a qualifying score updates it for everyone
- Local storage acts as an instant cache and offline fallback

> ⚠️ The write key is public by design, so scores are spoofable in devtools. It's a casual hall of melons — play nice. 🍉

## 🌐 Deployment

The site auto-deploys from `main` via GitHub Pages. Push and it's live in about a minute:

```bash
git add .
git commit -m "something melony"
git push origin main
```

## 🗂️ File Map

```
├── index.html    # page structure + sections
├── styles.css    # theme, layout, responsive breakpoints
├── game.js       # physics, rendering, merge logic, game loop
└── script.js     # leaderboard API + cloud sync + UI wiring
```

## 📄 License

This project is for personal/learning use. The watermelon logo and gameplay concept are inspired by the classic Suika game — not affiliated with or endorsed by its creators.

---

<div align="center">

**Built with ❤️ and a lot of melons by [Dave-VR](https://github.com/dave-vrx)** 🍉

</div>
