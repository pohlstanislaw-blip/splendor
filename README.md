# Facets

A lantern-lit gem-trading and engine-building board game for 2–4 players. You can play hot-seat on one screen, against AI opponents, or both.
All art is inline SVG and CSS drawn for this project; the only external assets are two Google Fonts (Cinzel and EB Garamond).

## Run it

```bash
npm install
npm run dev        # open the printed http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm test` | Engine and data unit tests (Vitest) |
| `npm run balance` | Static design-rule check and cost summary of `data.json` |
| `npm run simulate` | Plays Medium AI against itself at 2, 3 and 4 players and prints a balance report (`-- --games 3000 --write` refreshes `BALANCE.md`) |
| `npm run build` | Type-check and production build into `dist/` |

The game in progress is saved to `localStorage` after every move, so a page refresh keeps your game.

## Project layout

```
src/engine/          pure game logic, no UI imports
  data.json          all cards, patrons and tier names (edit this)
  data.ts            loads and validates data.json
  designRules.ts     the card-design rules (used by tests + scripts)
  game.ts            setup, validate(), applyAction(), scoring
  ai.ts              Easy (random) and Medium (greedy) opponents
src/useGame.ts       React hook: undo snapshot, localStorage, AI timer
src/App.tsx          board, panels, dialogs
src/components/      Gem (cuts), CardView (tier frames), CardArt (procedural scenes),
                     Portrait (patron silhouettes), Fx (animations)
scripts/             balance.ts, simulate.ts
data/cards.csv       the original reference card list (not used by the game)
BALANCE.md           design rules, tuning log and the latest simulation report
```

The UI never changes state itself. It sends `Action`s to `applyAction` and asks `validate` why a move is illegal; those reasons become the disabled-button tooltips.

## Editing `data.json`

All game content lives in `src/engine/data.json`, one card or patron per line:

```json
{ "id": "t2-gar-6", "tier": 2, "name": "Vermilion Lathe", "bonus": "garnet", "points": 3, "cost": { "lapis": 5, "moonstone": 1 } }
{ "id": "patron-1", "name": "Lady Orvelle Thane", "title": "Merchant Princess", "portrait": "merchant", "points": 3, "requires": { "garnet": 4, "lapis": 4 } }
```

- **Gem names** are `garnet`, `lapis`, `jade`, `obsidian` and `moonstone`. Leave a gem out of `cost` (or `requires`) when the amount is 0.
- **`id`** must be unique. Saved games refer to cards by id, so after renaming an id, start a new game.
- **`tier`** is 1 (Mine Shafts), 2 (Cutting Workshops) or 3 (Guildhalls). The display names are in `"tiers"` at the top of the file.
- **`name` and `title`** are free text. Card pictures are generated from the id, so changing a name keeps the same picture.
- **`portrait`** is one of: `merchant`, `guildmaster`, `duchess`, `knight`, `scholar`, `alchemist`, `forewoman`, `captain`, `countess`, `provost`.
- The file is checked when the game loads, so a typo in a gem name or tier gives a clear error.

After editing, run:

```bash
npm run balance && npm test
```

Both check the design rules in `src/engine/designRules.ts`:

1. **Symmetric across colours.** In each tier, every colour has the same set of cost shapes and every gem is demanded equally. To change a card, make the matching change to the same card in the other four colours.
2. **Points cost something.** Within a tier, a card worth more points must not be easier to buy than a cheaper card in every way. It needs a higher total, a larger single-colour requirement, or fewer colours.
3. **Mostly other colours.** At most ⅓ of a card's cost may be its own bonus colour.
4. **Even patrons.** Each colour appears equally often in patron requirements, with the same total, as 4+4 or 3+3+3.
5. Tier sizes and ranges: 40 / 30 / 20 cards (8 / 6 / 4 per colour), with 0–1, 1–3 and 3–5 points and total costs of 3–5, 5–8 and 7–14.

Then check how the change plays with `npm run simulate`. It flags any cost pattern bought far more or less often than its tier average, any colour imbalance, and any seat advantage. See `BALANCE.md` for the current numbers and how they were tuned.

## Rules summary

**Components.** There are five gems, each with its own cut so colour is never the only cue: Garnet (rounded cushion), Lapis (square step cut), Jade (oval cabochon), Obsidian (jagged shard) and Moonstone (round moon cut). Gold nuggets (rough nugget shape) are wild.
Each gem has a supply of 4 / 5 / 7 tokens for 2 / 3 / 4 players, and there are always 5 Gold.
The market has three tiers: **Mine Shafts** (I), **Cutting Workshops** (II) and **Guildhalls** (III). Every card has a gem cost, one permanent bonus gem, and 0–5 prestige.
Patrons are worth 3 prestige each and want either 4+4 bonuses of two colours or 3+3+3 of three colours. Each game reveals one more patron than there are players.

**Setup.** Shuffle each tier and deal 4 face-up cards per tier. A random player starts.

**On your turn, take exactly one action:**
1. **Take 3 different gems.**
2. **Take 2 of the same gem.** The pile must hold at least 4 before you take.
3. **Reserve** a face-up card, or the top card of a deck face-down, and gain 1 Gold if any is left. You can hold at most 3 reserved cards, and a reserved card only leaves your hand when you buy it.
4. **Buy** a face-up card or one of your reserved cards. Each card you own reduces costs by 1 of its bonus colour. Gold pays for any missing gem (your coloured tokens are spent first). Spent tokens go back to the supply, and the empty market slot is refilled from its deck (or stays blank if the deck is empty).

If no action is legal you must pass.

**End of turn.**
- If you hold more than 10 tokens (Gold counts), return tokens of your choice until you have 10.
- If your card bonuses meet a patron's requirement, that patron visits you. Only one patron can visit per turn; if several qualify, you choose. Tokens never count toward patrons.
- Click **End turn** to confirm. Until then, **Undo turn** restores the start of your turn. Undo is unavailable after you reserve a face-down card, because you have already seen it.

**Game end.** When a player reaches 15+ prestige, the current round is finished so everyone has had the same number of turns. Highest prestige wins. Ties go to the player with the fewest purchased cards; if still tied, the victory is shared.

## Interface notes

- **Taking gems.** Click gems in the supply, then click **Take**. Click one gem twice to take 2 of it. Each pile shows whether "×2" is allowed.
- **Legal moves.** Cards you can afford have a green glow. A cost pip turns green when your bonuses already cover that colour. Disabled buttons explain why on hover.
- **Player panels** show tokens, card bonuses per colour, prestige, patrons and reserved cards.
- **Hot-seat play.** With two or more humans, a "pass the device" screen appears before each human turn. A face-down reserved card is shown only to its owner during their own turn.
- **AI.** Easy plays a random legal move. Medium buys the most valuable affordable card. Otherwise it collects gems toward the best value-per-missing-gem target, weighting patron progress. AI moves play with a short delay.
- **Animation.** Cards flip in when dealt, bought cards fly to their new owner, and tokens arc between the supply and player panels. With the system "reduce motion" setting, all animation and the lantern flicker are turned off.
- **Layout.** Designed for laptop screens (1024 px and wider); below about 960 px the player panels move under the board.
