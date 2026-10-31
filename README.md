# Facets

An engine-building gem-trading board game for 2–4 players. You can play hot-seat on one screen, against AI opponents, or both.
Card names, patrons and visuals are original. Card costs, points and bonus colors come from `data/cards.csv`.

## Run it

```bash
npm install
npm run dev        # open the printed http://localhost:5173
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm test` | Engine unit tests (Vitest) |
| `npm run import-cards` | Regenerates the card table in `src/engine/data.ts` from `data/cards.csv` |
| `npm run balance` | Prints the card-data balance summary (color spread, cost-per-point) |
| `npm run build` | Type-check and production build into `dist/` |

The game in progress is saved to `localStorage` after every move, so a page refresh keeps your game.

## Project layout

```
src/engine/      pure game logic, no UI imports
  types.ts       state / action types
  data.ts        90 cards (generated from data/cards.csv) + 10 patrons
  game.ts        setup, validate(), applyAction(), scoring
  ai.ts          Easy (random) and Medium (greedy) opponents
  game.test.ts   rule tests
src/useGame.ts   React hook: undo snapshot, localStorage, AI timer
src/App.tsx      board, panels, dialogs
src/components/  SVG gems and cards
data/cards.csv   card stats source
scripts/import-cards.ts, scripts/balance.ts
```

CSV colors map to gems as: white → Moonstone, blue → Lapis, green → Jade, red → Garnet, black → Obsidian. To change cards, edit the CSV and run `npm run import-cards`. A test checks that `data.ts` matches the CSV.

The UI never changes state itself. It sends `Action`s to `applyAction` and asks `validate` why a move is illegal; those reasons become the disabled-button tooltips.

## Rules summary

**Components.** There are five gems: Garnet (red, triangle cut), Lapis (blue, square cut), Jade (green, hexagon), Obsidian (black, tall diamond) and Moonstone (white, round cabochon). Gold (star) is wild.
Each gem has a supply of 4 / 5 / 7 tokens for 2 / 3 / 4 players, and there are always 5 Gold.
The market has three tiers: Quarries (I), Workshops (II) and Guildhalls (III). Every card has a gem cost, one permanent bonus gem, and 0–5 prestige.
Patrons are worth 3 prestige each and want either 4+4 bonuses of two colors or 3+3+3 of three colors. Each game reveals one more patron than there are players.

**Setup.** Shuffle each tier and deal 4 face-up cards per tier. A random player starts.

**On your turn, take exactly one action:**
1. **Take 3 different gems.**
2. **Take 2 of the same gem.** The pile must hold at least 4 before you take.
3. **Reserve** a face-up card, or the top card of a deck face-down, and gain 1 Gold if any is left. You can hold at most 3 reserved cards, and a reserved card only leaves your hand when you buy it.
4. **Buy** a face-up card or one of your reserved cards. Each card you own reduces costs by 1 of its bonus color. Gold pays for any missing gem (your colored tokens are spent first). Spent tokens go back to the supply, and the empty market slot is refilled from its deck (or stays blank if the deck is empty).

If no action is legal you must pass.

**End of turn.**
- If you hold more than 10 tokens (Gold counts), return tokens of your choice until you have 10.
- If your card bonuses meet a patron's requirement, that patron visits you. Only one patron can visit per turn; if several qualify, you choose. Tokens never count toward patrons.
- Click **End turn** to confirm. Until then, **Undo turn** restores the start of your turn. Undo is unavailable after you reserve a face-down card, because you have already seen it.

**Game end.** When a player reaches 15+ prestige, the current round is finished so everyone has had the same number of turns. Highest prestige wins. Ties go to the player with the fewest purchased cards; if still tied, the victory is shared.

## Interface notes

- **Taking gems.** Click gems in the supply, then click **Take**. Click one gem twice to take 2 of it. Each pile shows whether "×2" is allowed.
- **Legal moves.** Cards you can afford have a green glow. A cost pip turns green when your bonuses already cover that color. Disabled buttons explain why on hover.
- **Hot-seat play.** With two or more humans, a "pass the device" screen appears before each human turn. A face-down reserved card is shown only to its owner during their own turn.
- **AI.** Easy plays a random legal move. Medium buys the most valuable affordable card. Otherwise it collects gems toward the best value-per-missing-gem target, weighting patron progress, and reserves when collecting would not help. AI moves play with a short delay.
