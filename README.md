# نامه‌ای که باد برد — *The Letter the Wind Took*

A short, gentle, mobile-first web game (≈3–5 minutes). A small black cat walks
down a dusk street, gathers four pieces of a letter the wind carried off, and
leaves the finished letter at a door. Then the letter opens in a clean,
readable overlay.

Built with **React + TypeScript + Vite** and **Phaser 3**. Every graphic is drawn
in code (no image files, no external URLs, no backend). All visible text is
Persian and rendered RTL with a bundled font (Vazirmatn).

---

## ✏️ Personalize it — edit one file

Everything you would want to change lives in **`src/content/apology.ts`**:

| What | Where in `apology.ts` |
|---|---|
| Game title (intro + browser tab) | `content.title` |
| Intro lines, touch instruction, start button | `content.intro` |
| **The four letter pieces** (in level order) | `content.fragments` — keep exactly 4 |
| **The full final letter** ⚠ placeholder | `content.finalLetter` → `greeting`, `paragraphs`, `signOff`, `signature` |
| Buttons «دوباره بخون» / «از اول بازی کن» | `content.buttons` (set `restart: ''` to hide the restart button) |
| Gentle idle hints | `content.hints` |
| **Cat colors** | `catColors` → `body`, `shadow`, `highlight`, `eyes`, `nose`, `outline` |
| Walk speed, idle-hint delay | `gameTuning` |

Before publishing:

1. Replace the placeholder text in `content.finalLetter` with your own words.
2. Set `finalLetter.isPlaceholder` to `false`. (While it is `true`, a small
   yellow «متن نمونه» badge shows on the letter in dev mode, and a console
   warning is printed in production.)
3. Optionally set `finalLetter.includeFragments` to `false` if you don't want the
   four collected sentences repeated at the top of the letter.

The cat defaults to a black cat (`#17171C` body, `#F3D36B` eyes). The comment
above `catColors` has a ready light-orange palette if you prefer.

---

## Run, build, deploy

Requires **Node.js 20.19+ or 22.12+** (what Vite 7 needs).

```bash
npm install
npm run dev        # http://localhost:5173 — also on your LAN (open it on your phone)
npm run typecheck  # TypeScript only
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ locally to check the production build
```

`dist/` is a fully static site; `vite.config.ts` uses `base: './'`, so it works
from a domain root **or** a sub-folder.

**Deploy options**

- **Netlify** — drag the `dist/` folder onto <https://app.netlify.com/drop>, or
  connect the repo with build command `npm run build` and publish directory `dist`.
- **Vercel** — import the repo; framework preset “Vite” (build `npm run build`,
  output `dist`).
- **GitHub Pages** — push `dist/` to a `gh-pages` branch (e.g. `npx gh-pages -d dist`)
  or use the official “Deploy static content” Pages workflow pointed at `dist/`.
- **Any web host** — upload the contents of `dist/`.

Serve over HTTPS if you can; phones treat full-screen web apps better that way.

---

## How to play

- On-screen buttons at the bottom: **←** and **→** (press and hold to walk),
  **↑** (jump). They appear only while playing.
- Walk past each floating paper to collect it — the game pauses and shows that
  piece's sentence. Tap «ادامه» to keep going.
- Obstacles are gentle: a small puddle, a windy stretch that pushes back softly,
  and a water channel with a stepping stone. Stepping in water just returns the
  cat to the last street lamp it passed — collected pieces are kept.
- The door only opens the ending once all four pieces are found.
- Desktop keyboards also work (arrows / A-D, Space-W-Up), but the UI is touch-first
  and never shows keyboard instructions.

---

## Project structure

```
src/
  content/apology.ts      ← ALL text, cat colors, small tuning knobs
  App.tsx                 ← screens + wiring between React and Phaser
  game/
    gameState.ts          ← explicit state machine (reducer)
    bridge.ts             ← typed event bus + shared touch/keyboard input state
    GameCanvas.tsx        ← mounts/destroys exactly one Phaser game
    LevelScene.ts         ← the level: movement, pieces, obstacles, ending
    levelLayout.ts        ← positions of pieces, puddle, wind, stone, lamps, door
    catArt.ts             ← procedurally drawn cat frames + small props
    scenery.ts            ← dusk sky, city, street, house (all shapes)
  components/
    TouchControls.tsx     ← ← ↑ → pointer-event buttons
    Overlays.tsx          ← intro, piece dialog, progress HUD, final letter
  styles.css              ← RTL layout, safe areas, responsive rules
  assets/fonts/           ← Vazirmatn (SIL Open Font License)
```

### State machine

```
intro ─START→ playing ─COLLECT→ fragment ─CONTINUE→ playing
playing ─REACH_DOOR (only with 4/4)→ ending ─ENDING_DONE→ letter
letter ⇄ afterLetter   (close / «دوباره بخون» re-opens and replays the letter)
any ─RESTART→ intro    (remounts a brand-new Phaser game)
```

- Phaser owns physics and positions; React owns which screen is showing.
- The touch controls render only in `playing`. Any held input is released
  whenever the phase changes, the window blurs, or the tab is hidden.
- «دوباره بخون» never resets progress; «از اول بازی کن» increments a run id,
  which remounts the game cleanly (the old Phaser instance and all its
  listeners are destroyed).
- No `localStorage` is used. Reloading the page always starts fresh.
- No audio is included, so there is nothing to autoplay or mute.

### Customizing the level

`src/game/levelLayout.ts` lists every position in world units (the street is
6200 units long). Pieces sit in full-height “columns”: walking past a piece's x
position collects it, so pieces are always found in order and can't be skipped.
Street lamps are the checkpoints.

---

## Testing notes

What was verified automatically (headless Chromium, touch events only):

- Full playthrough on a 390×844 phone viewport using only the on-screen buttons:
  intro → 4 pieces in order (each dialog shown once, HUD ۰→۴) → puddle splash
  and respawn with progress kept → fall into the channel and respawn → stone
  jump → door → delivery animation → letter → «دوباره بخون» → close → reopen →
  «از اول بازی کن» → fresh intro with exactly one canvas.
- Holding → keeps walking; tapping ↑ while holding → jumps; repeated jumps.
- Reaching the door early shows «هنوز چند تکه از نامه دستِ باده…» and does not end.
- Controls hidden on intro, piece dialogs, ending and letter.
- Layouts checked at 390×844 portrait, 844×390 landscape, 1280×720 desktop.
- No page errors, page never scrolls, no text selection from the controls,
  React StrictMode double-mount leaves one game instance.

Please still check by hand on real devices:

- iPhone Safari (notch / home-indicator safe areas, no pinch-zoom, no
  double-tap zoom) and an Android Chrome phone.
- Two-thumb play (hold → with one thumb, tap ↑ with the other) feels right.
- Rotating the phone mid-game re-frames the street above the buttons.
- Frame rate on an older phone.
- The final letter text after you replace the placeholder (long letters scroll).

---

## Credits

- Font: [Vazirmatn](https://github.com/rastikerdar/vazirmatn) by Saber Rastikerdar,
  SIL Open Font License 1.1 (`public/licenses/Vazirmatn-OFL.txt`).
- Game framework: [Phaser 3](https://phaser.io) (MIT).
