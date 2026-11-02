# Facets — notes for Claude

## Card list: fixed, never change it

The owner's reference card list (from their PDF) is the standard. `data/cards.csv` holds it, and `src/engine/data.json` must match it exactly.

- Never change any development card's **cost, points, bonus colour or tier**. That rules out balancing, symmetry fixes, "improvements" and refactors.
- You may change card **names, ids, art and presentation**.
- If a design rule, simulation or test seems to call for a card change, report it to the owner instead of changing data. The design-guideline checks in `src/engine/designRules.ts` are warnings for this reason.
- The test `is exactly the reference card list` in `src/engine/game.test.ts` enforces this. Never edit or weaken it to make a change pass.

## Project layout

- `src/engine/`: pure rules engine (Vitest tests).
- `server/`: online rooms over WebSocket.
- `src/`: React UI.
- `npm test`, `npm run balance` and `npm run build` should all pass before pushing.
