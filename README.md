# Facets

A lantern-lit gem-trading and engine-building board game for 2–4 players. You can play hot-seat on one screen, against AI opponents, or online with friends through a small game server you host yourself.
All art is inline SVG and CSS drawn for this project; the only external assets are two Google Fonts (Cinzel and EB Garamond).

## Run it

```bash
npm install
npm run dev        # open the printed http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm start` | Runs the game server: serves the built game and online rooms on `PORT` (default 8787) |
| `npm run dev:server` | Game server with auto-restart, for development next to `npm run dev` |
| `npm test` | Engine, data and server tests (Vitest) |
| `npm run balance` | Static design-rule check and cost summary of `data.json` |
| `npm run simulate` | Plays Medium AI against itself at 2, 3 and 4 players and prints a balance report (`-- --games 3000 --write` refreshes `BALANCE.md`) |
| `npm run build` | Type-check and production build into `dist/` |

A local game is saved to `localStorage` after every move, so a page refresh keeps your game.

## Online play

Choose **Online** in the new-game dialog:

1. **Start a room.** Enter your name, pick 2–4 players, and choose for each other seat whether it's a friend or a bot.
2. **Invite.** The lobby shows a 5-letter room code and an invite link. Friends open the link (or enter the code under **Join a room**) and type their name. No accounts are needed.
3. **Play.** The host presses **Start game** once every seat is filled (**Fill with bot** fills an empty seat). Each player sees the table live and can act only on their own turn.

- **Fairness:** the server checks every move with the same rules engine and plays the bots. It sends each player only what that player may see, so other players' face-down cards and the deck order never reach your browser.
- **Reconnecting:** if you refresh or lose the connection, the page rejoins your room automatically and keeps your seat. If someone leaves for good, the host can **Hand seat to a bot** on that player's panel.
- **Rooms live in the server's memory.** They disappear when the server restarts or redeploys, and rooms nobody has open are cleared after 6 hours.

Online play needs the game server. The copy of the game on claude.ai has no server, so its Online tab explains this and local play still works there.

## Hosting it yourself

Running the game server on your own computer:

```bash
npm install
npm run build
npm start          # http://localhost:8787
```

People on your home network can join at `http://<your computer's IP>:8787`. To play with friends elsewhere, deploy it to a host (below) or put your computer behind a tunnel such as Cloudflare Tunnel or Tailscale Funnel.

### Render (set up in this repo)

`render.yaml` describes the service, so Render builds and redeploys on every push to `main`:

1. Sign in at https://render.com with your GitHub account and give it access to this repository.
2. Choose **New → Blueprint**, pick this repository, and confirm. Render runs `npm ci --include=dev && npm run build`, then `npm start`.
3. When the deploy finishes, open the `https://facets-….onrender.com` address it shows and share it with friends.

On the **free plan** the server sleeps after about 15 minutes without visitors. The first visit after that takes up to a minute to wake it, and any open rooms are lost. A paid instance stays awake.

### Other hosts

Any host that runs a Node.js 20+ web service with WebSockets works, such as Fly.io, Railway or a small VPS. Use `npm ci --include=dev && npm run build` as the build step and `npm start` as the start command. The server reads `PORT` from the environment and answers health checks at `/healthz`. Static-only hosts such as Netlify or GitHub Pages can serve the game for local play, but not online rooms.

### Developing online play

Run the server and the Vite dev server side by side. Vite forwards `/ws` to the game server:

```bash
npm run dev:server
```

```bash
npm run dev
```

## Project layout

```
src/engine/          pure game logic, no UI imports
  data.json          all cards, patrons and tier names (edit this)
  data.ts            loads and validates data.json
  designRules.ts     the card-design rules (used by tests + scripts)
  game.ts            setup, validate(), applyAction(), scoring
  ai.ts              Easy (random) and Medium (greedy) opponents
src/useGame.ts       React hook for local games: undo snapshot, localStorage, AI timer
src/online/          protocol.ts (messages), useOnline.ts (connection, rejoin)
server/              index.ts (HTTP + WebSocket), rooms.ts (rooms, hidden info), tests
render.yaml          Render deployment blueprint
src/App.tsx          board, panels, dialogs
src/components/      Gem (cuts), CardView (tier frames), CardArt (procedural scenes),
                     Portrait (patron silhouettes), Fx (animations)
scripts/             balance.ts, simulate.ts
data/cards.csv       the original reference card list (not used by the game)
BALANCE.md           design rules, tuning log and the latest simulation report
```

The UI never changes state itself. It sends `Action`s to `applyAction` and asks `validate` why a move is illegal; those reasons become the disabled-button tooltips.

## Card data

All game content lives in `src/engine/data.json`, one card or patron per line:

```json
{ "id": "t1-gar-1", "tier": 1, "name": "Emberpit Dig", "bonus": "garnet", "points": 0, "cost": { "lapis": 1, "jade": 1, "obsidian": 1, "moonstone": 1 } }
{ "id": "patron-1", "name": "Lady Orvelle Thane", "title": "Merchant Princess", "portrait": "merchant", "points": 3, "requires": { "garnet": 4, "lapis": 4 } }
```

**The development cards are fixed.** Their costs, points and bonus colours are the owner's reference list from their PDF, stored in `data/cards.csv` with colours mapped as white → Moonstone, blue → Lapis, green → Jade, red → Garnet, black → Obsidian. Never change them. A test fails if `data.json` stops matching the reference, and `npm run balance` reports the match.

What you can edit:

- **Card names** (`name`) and **ids** (`id`). Ids must stay unique. Saved games refer to cards by id, so start a new game after renaming one. Card pictures are generated from the id.
- **Tier display names**, in `"tiers"` at the top of the file.
- **Patrons**, which are not part of the reference list. Gems are `garnet`, `lapis`, `jade`, `obsidian` and `moonstone`. `portrait` is one of `merchant`, `guildmaster`, `duchess`, `knight`, `scholar`, `alchemist`, `forewoman`, `captain`, `countess` or `provost`. Each patron needs 4+4 or 3+3+3, with every colour used equally across all patrons.

After editing, run:

```bash
npm run balance && npm test
```

`npm run balance` checks structure (tier sizes, ranges, patrons). It also prints design-guideline notes such as colour symmetry, which are informational because the card list is fixed. `npm run simulate` shows how the cards play; see `BALANCE.md`.

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
