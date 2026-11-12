# Facets: first-person 3D tabletop view

Turn Facets into a game you play as if you were sitting at a real table with the other players. Inspiration is the moody, first-person tabletop feel of games such as *Inscryption*: a dim room, candlelight, a worn wooden table, cards you pick up and lay down by hand. Facets must keep its own identity. Use **nothing** from Inscryption or any other commercial game: no names, characters, art, models, sounds, fonts, UI or text.

## Status and refinements

**Built** on branch `tabletop-3d` (code in `src/table3d/`). These points refine the original brief and record what was decided while building:

- **Inspector, not a floating panel.** Clicking a card, deck or patron on the table opens a docked inspector on the right. It shows the crisp 2D card with its Buy / Reserve buttons and the engine's reason when an action is blocked. This replaces "a small panel next to the card", which covered the table.
- **Exact numbers on name plates.** 3D chips and stacks give the feel; each seat's plate gives exact prestige, tokens and bonuses. Opponents' plates stand at their table edge like place cards; yours is docked bottom-left.
- **Settings menu** in the top bar: View (Table 3D / Classic 2D), Animations (On / Reduced), Sound (On / Off, off by default). Saved per browser.
- **Default view.** Table on screens at least 900 px wide with WebGL, otherwise Classic. If the table runs below about 20 fps in its first seconds, or the 3D code fails to load, the game switches to Classic and says so. An explicit "Table" choice is never overridden for speed.
- **Pick-up sequence.** Your own cards come to the camera and hold; opponents' cards lift above the table, tilt toward you, then fly to their seat.
- **Animation model.** Every object's position is computed from game state (`layout.ts`); `Mover.tsx` tweens to it. Chips get stable identities (`chips.ts`) so the right number fly between piles.
- **Libraries.** three 0.169, @react-three/fiber 8.17 and drei 9.114 (only its HTML overlay). No drei text, because it downloads fonts at runtime.
- **Not built:** drag-to-look (the camera leans with the pointer instead), and a per-card enlarged preview on hover (the inspector covers it).

## Context: read first

- **Repo:** `pohlstanislaw-blip/splendor`.
- **Rules for Claude:** read `CLAUDE.md` before changing anything.
- **Stack:** Vite + React + TypeScript single-page app, plus a Node WebSocket server in `server/` for online rooms. It is deployed on Render from `render.yaml`, which auto-deploys on every push to `main`.
- **Engine:** pure rules in `src/engine/` with Vitest tests. The UI only sends `Action`s and renders `GameState`.
- **Card list is fixed.** Never change any card's cost, points, bonus colour or tier (`data/cards.csv` is the reference; a test enforces it). Names, art and presentation may change.
- **Existing visuals to reuse:**
  - `src/components/CardArt.tsx`: procedural SVG card scenes, seeded per card id.
  - `src/components/CardView.tsx`: card faces with a top band and cost tokens, plus bought-card stacks.
  - `src/components/Gem.tsx`: gem cuts.
  - `src/components/Portrait.tsx`: patron portraits.
  - `src/components/Fx.tsx`: current 2D animations.
- **Per-player view:** online play already arranges the screen around the viewer (`src/online/perspective.ts`, `seatOrderFrom`). The server already hides other players' face-down cards and the deck order.

## What to build

### 1. The table scene
- **First-person camera.** You are seated at the near edge of the table, looking slightly down at it. Allow small, limited head movement (a few degrees of look-around on mouse move or drag). The table must always stay readable, so no free orbiting.
- **Room.** A dark room built from simple geometry and procedural textures: wood-grain table top, dark walls, one or two candles or a hanging lantern. Use warm point lights with a gentle flicker, soft shadows and fog or a vignette at the edges.
- **On the table:**
  - The three market rows, each with its deck pile.
  - The token supply as small physical stacks of gem chips.
  - The patrons, as standing tiles or portrait cards.
- **Your area** at the near edge holds your tokens, your bought cards stacked by colour with points visible, and your reserved cards, standing upright like a hand facing you.
- **Opponents** sit around the table in turn order from you, using `seatOrderFrom`:
  - **2 players:** the opponent sits opposite.
  - **3–4 players:** opponents sit left, opposite and right.
  - Each opponent is an original stylised figure (a silhouette or simple low-poly bust lit by the candle) with a name plate, prestige and a "thinking"/turn glow.
  - In front of each opponent: their tokens, their bought-card stacks and their reserved cards face down.
  - In local hot-seat games, the camera seat follows the current human player; keep the existing pass-the-device screen.

### 2. Card and token animations
- **Hover:** the card lifts a little and tilts toward you, and the cursor shows it can be picked up.
- **Pick up (buy or reserve):**
  1. The card rises off the table.
  2. It turns toward the camera and briefly holds in front of you, at about 40% of the screen height, for about 400 ms.
  3. It flies to its destination: your colour stack for a buy, your hand for a reserve.
  4. The empty market slot refills with a card dealt face down from its deck and flipped face up.
- **Opponent moves** play the same animation toward that opponent's seat, so you can follow what they did.
- **Tokens:**
  - Taken chips arc from the supply to the player.
  - Paid chips arc back to the supply.
  - Use a small bounce and a soft clack sound, muted by default.
- **Patron visits:** the patron tile slides to the player who earned it.
- **Reduced motion:** with `prefers-reduced-motion` (and as a setting), skip flights and flips, and show changes instantly with a short highlight.

### 3. Controls and readability
- Every engine action stays reachable:
  - **Take gems:** click the supply chips, then confirm.
  - **Buy or reserve:** click a card to see it and its actions in the docked inspector.
  - **Reserve top:** click a deck.
  - **Discard, patron choice, confirm and undo:** keep the existing dialogs.
- Disabled actions still explain why. Reuse the engine's `validate()` reasons in tooltips or the action panel.
- Card faces must stay legible at laptop size. Render them as textures from the existing SVG card faces, at 2× pixel ratio. Show the points, gem and costs crisply; when a card is small, an enlarged view on hover is fine.
- Keep the HTML overlay for: turn indicator, room code, action log (collapsible), your-turn banner, results screen.
- Add a **View: Table (3D) / Classic (2D)** setting, saved per browser. Classic is the current UI and remains the fallback.

### 4. Tech approach (suggested; adjust if you find something better)
- Use **three.js** with **@react-three/fiber** and **@react-three/drei**, pinned to exact versions, for the scene, an HTML overlay and raycast clicks.
- Rendering:
  - Build card and token textures in code: draw the existing SVG components to a canvas, then use it as a texture, cached per card id.
  - Build the room from primitives plus procedural or canvas textures. No downloaded models, images or sounds unless they are original or properly licensed; record any licence in the repo.
  - Animate with a small tween helper or `@react-spring/three`. Keep the engine as the only source of truth: animations are driven by state diffs, like `Fx.tsx` does today.
- Performance:
  - Hold 60 fps on a typical laptop and stay usable on integrated graphics.
  - Cap the device pixel ratio at 2.
  - Keep shadows cheap (one shadow-casting light).
  - Load the 3D bundle lazily so the menu and Classic view load fast.
  - If WebGL is unavailable or performance is poor, fall back to Classic automatically.
- Don't change the engine rules or the server protocol unless strictly needed. If the server must change, keep old clients working.

### 5. Hosting on Render
- The game must still deploy with the existing `render.yaml`: build with `npm ci --include=dev && npm run build`, start with `npm start`, health check `/healthz`.
- Make sure every new dependency installs and builds on Render's Node 22, and that `dist/` includes everything the 3D view needs (no files loaded from other hosts at runtime except Google Fonts).
- Check the build size. Note the main and 3D chunk sizes in the PR description and keep the first load fast.
- Pushing to `main` redeploys and ends games in progress. Work on a branch and merge once it's ready.

## Acceptance checks

- `npm test`, `npm run balance` (90/90 cards identical) and `npm run build` all pass.
- `npm start` serves the game locally. In a browser with two separate profiles:
  - create an online room;
  - join by link;
  - play several turns, including buy, reserve, take tokens, discard and a patron visit;
  - confirm each player sees the table from their own seat and opponents' face-down cards stay hidden.
- Screenshots at 1440×900 and 1280×800 show:
  - the table from a seat with 2 and 4 players;
  - a card mid pick-up;
  - the Classic view still working.
- Reduced-motion mode shows no flights or flips.
- No console errors. The tab stays responsive during animations.
- README updated: how to switch views, controls, and any new assets and their licences.

## Out of scope

- No changes to the card list or game rules.
- No accounts, matchmaking or persistence of rooms across server restarts (separate task).
- No copying of any commercial game's assets, names or text.
