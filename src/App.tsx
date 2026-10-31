import { useEffect, useMemo, useState } from 'react';
import {
  GEMS,
  GEM_LABEL,
  MAX_RESERVED,
  MAX_TOKENS,
  PATRON_BY_ID,
  TAKE_TWO_MIN_PILE,
  TIER_NAMES,
  TOKENS,
  WIN_POINTS,
  bonuses,
  getCard,
  paymentFor,
  prestige,
  tokenTotal,
  validate,
  type Action,
  type Controller,
  type Gem,
  type GameState,
  type GemCounts,
  type SeatConfig,
  type Tier,
  type Token,
} from './engine';
import { CardBack, CardView } from './components/CardView';
import { ArtDefs } from './components/CardArt';
import { Fx } from './components/Fx';
import { CostPip, GemDefs, GemIcon, TokenChip } from './components/Gem';
import { Portrait } from './components/Portrait';
import { useGame } from './useGame';

const PLAYER_COLORS = ['#f0b429', '#4fd1c5', '#f687b3', '#9f7aea'];
const CONTROLLER_LABEL: Record<Controller, string> = { human: 'Human', easy: 'AI · Easy', medium: 'AI · Medium' };

export default function App() {
  const game = useGame();
  const [showNewGame, setShowNewGame] = useState(!game.session);

  if (!game.session || showNewGame) {
    return (
      <div className="app">
        <GemDefs />
        <div className="lantern-vignette" aria-hidden />
        <NewGameDialog
          canCancel={!!game.session}
          onCancel={() => setShowNewGame(false)}
          onStart={(seats) => {
            game.newGame(seats);
            setShowNewGame(false);
          }}
        />
      </div>
    );
  }

  return <Board game={game} onNewGame={() => setShowNewGame(true)} />;
}

// ---------------------------------------------------------------------------

function Board({ game, onNewGame }: { game: ReturnType<typeof useGame>; onNewGame: () => void }) {
  const state = game.session!.state;
  const { dispatch } = game;
  const current = state.players[state.current];
  const humans = state.players.filter((p) => p.controller === 'human').length;
  const isHuman = current.controller === 'human';

  const [revealedTurn, setRevealedTurn] = useState<number | null>(null);
  const handoff = humans >= 2 && isHuman && state.phase === 'action' && revealedTurn !== state.turn;
  const interactive = isHuman && state.phase === 'action' && !handoff;

  const [picked, setPicked] = useState<Gem[]>([]);
  useEffect(() => setPicked([]), [state.turn, state.phase]);

  /** whose hidden cards may be shown face up right now */
  const viewer = humans === 0 ? 'all' : isHuman && !handoff ? state.current : null;

  const reasonFor = (action: Action): string | null => {
    if (state.phase === 'gameover') return 'The game is over.';
    if (!isHuman) return `Waiting for ${current.name}…`;
    if (handoff) return 'Reveal the turn first.';
    return validate(state, action);
  };

  const myBonuses = bonuses(current);

  return (
    <div className="app">
      <GemDefs />
      <ArtDefs />
      <div className="lantern-vignette" aria-hidden />
      <Fx state={state} />
      <header className="topbar">
        <div className="brand">
          <GemIcon gem="garnet" size={26} />
          <span>Facets</span>
        </div>
        <TurnIndicator state={state} />
        <div className="topbar-actions">
          <button onClick={onNewGame}>New game</button>
        </div>
      </header>

      {game.error && (
        <div className="error-toast" onClick={game.clearError}>
          {game.error}
        </div>
      )}

      <main className="layout">
        <section className="board">
          <Patrons state={state} />
          {([3, 2, 1] as Tier[]).map((tier) => (
            <div className="market-row" key={tier}>
              <div className="deck-slot">
                <CardBack tier={tier} label={`${TIER_NAMES[tier]}`} />
                <div className="deck-count" title="Cards left in this deck">
                  {state.decks[tier - 1].length} left
                </div>
                <ActionButton
                  label="Reserve top"
                  action={{ type: 'reserve', source: { kind: 'deck', tier } }}
                  reasonFor={reasonFor}
                  dispatch={dispatch}
                />
              </div>
              {state.market[tier - 1].map((id, slot) =>
                id ? (
                  <CardView
                    key={id}
                    fxId={id}
                    card={getCard(id)}
                    bonuses={interactive ? myBonuses : undefined}
                    highlight={interactive && !!paymentFor(current, getCard(id))}
                    buttons={[
                      cardButton('Buy', { type: 'buy', source: { kind: 'market', tier, slot } }, reasonFor, dispatch, true),
                      cardButton('Reserve', { type: 'reserve', source: { kind: 'market', tier, slot } }, reasonFor, dispatch),
                    ]}
                  />
                ) : (
                  <div key={slot} className="card empty-slot">
                    empty
                  </div>
                ),
              )}
            </div>
          ))}
          <Supply state={state} picked={picked} setPicked={setPicked} interactive={interactive} reasonFor={reasonFor} dispatch={dispatch} />
        </section>

        <aside className="side">
          {state.players.map((_, i) => (
            <PlayerPanel
              key={i}
              state={state}
              index={i}
              showHidden={viewer === 'all' || viewer === i}
              reasonFor={reasonFor}
              dispatch={dispatch}
              isViewer={viewer === i}
            />
          ))}
          <ActionLog state={state} />
        </aside>
      </main>

      {isHuman && state.phase !== 'action' && state.phase !== 'gameover' && (
        <div className="confirm-bar">
          <span>
            {state.phase === 'confirm' && 'Action done.'}
            {state.phase === 'discard' && 'Too many tokens — return some.'}
            {state.phase === 'patron' && 'Choose a visiting patron.'}
          </span>
          <span title={game.canUndo ? 'Take back this turn' : 'Undo is unavailable after drawing a hidden card'} className="btn-wrap">
            <button onClick={game.undo} disabled={!game.canUndo}>
              ↶ Undo turn
            </button>
          </span>
          {state.phase === 'confirm' && (
            <button className="primary" onClick={() => dispatch({ type: 'endTurn' })} autoFocus>
              End turn ✓
            </button>
          )}
        </div>
      )}

      {state.phase === 'discard' && isHuman && <DiscardDialog state={state} dispatch={dispatch} onUndo={game.canUndo ? game.undo : undefined} />}
      {state.phase === 'patron' && isHuman && <PatronDialog state={state} dispatch={dispatch} />}
      {state.phase === 'gameover' && <GameOver state={state} onNewGame={onNewGame} />}
      {handoff && (
        <div className="modal-backdrop">
          <div className="modal handoff">
            <h2 style={{ color: PLAYER_COLORS[state.current] }}>{current.name}'s turn</h2>
            <p>Pass the device to {current.name}. Hidden reserved cards will be shown once you continue.</p>
            <button className="primary" onClick={() => setRevealedTurn(state.turn)} autoFocus>
              I'm {current.name} — show my turn
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function cardButton(
  label: string,
  action: Action,
  reasonFor: (a: Action) => string | null,
  dispatch: (a: Action) => void,
  primary = false,
) {
  return { label, onClick: () => dispatch(action), disabledReason: reasonFor(action), primary };
}

function ActionButton({
  label,
  action,
  reasonFor,
  dispatch,
  primary,
}: {
  label: string;
  action: Action;
  reasonFor: (a: Action) => string | null;
  dispatch: (a: Action) => void;
  primary?: boolean;
}) {
  const reason = reasonFor(action);
  return (
    <span className="btn-wrap" title={reason ?? ''}>
      <button className={`small${primary ? ' primary' : ''}`} disabled={reason !== null} onClick={() => dispatch(action)}>
        {label}
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------

function TurnIndicator({ state }: { state: GameState }) {
  const p = state.players[state.current];
  if (state.phase === 'gameover') return <div className="turn-indicator">Game over</div>;
  return (
    <div className="turn-indicator">
      <span className="dot" style={{ background: PLAYER_COLORS[state.current] }} />
      <span>
        Round {state.round} · <b>{p.name}</b>
        {p.controller !== 'human' && <span className="thinking"> is thinking…</span>}
      </span>
      {state.finalRound && <span className="final-badge">Final round</span>}
    </div>
  );
}

function Patrons({ state }: { state: GameState }) {
  return (
    <div className="patrons">
      <div className="section-title">Patrons · each visit is worth 3 prestige</div>
      <div className="patron-row">
        {state.patrons.length === 0 && <span className="muted">All patrons have visited.</span>}
        {state.patrons.map((id) => (
          <PatronTile key={id} id={id} bonuses={bonuses(state.players[state.current])} />
        ))}
      </div>
    </div>
  );
}

function PatronTile({ id, bonuses: b, onClick }: { id: string; bonuses?: GemCounts; onClick?: () => void }) {
  const patron = PATRON_BY_ID[id];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`patron${onClick ? ' clickable' : ''}`} onClick={onClick}>
      <div className="patron-top">
        <Portrait kind={patron.portrait} id={patron.id} size={46} />
        <span className="patron-points" aria-label={`${patron.points} prestige`}>
          {patron.points}
        </span>
      </div>
      <div className="patron-name">{patron.name}</div>
      <div className="patron-title">{patron.title}</div>
      <div className="patron-req">
        {GEMS.filter((g) => patron.requires[g]).map((g) => (
          <CostPip key={g} gem={g} n={patron.requires[g]!} satisfied={b ? b[g] >= patron.requires[g]! : false} />
        ))}
      </div>
    </Tag>
  );
}

function Supply({
  state,
  picked,
  setPicked,
  interactive,
  reasonFor,
  dispatch,
}: {
  state: GameState;
  picked: Gem[];
  setPicked: (g: Gem[]) => void;
  interactive: boolean;
  reasonFor: (a: Action) => string | null;
  dispatch: (a: Action) => void;
}) {
  const toggle = (g: Gem) => {
    if (picked.length === 2 && picked[0] === picked[1]) return setPicked([g]);
    if (picked.length === 1 && picked[0] === g) return setPicked([g, g]);
    if (picked.includes(g)) return setPicked(picked.filter((x) => x !== g));
    if (picked.length < 3) setPicked([...picked, g]);
  };

  let action: Action | null = null;
  let pickReason: string | null = 'Pick 3 different gems, or click one gem twice to take 2.';
  if (picked.length === 3) action = { type: 'take3', gems: picked };
  else if (picked.length === 2 && picked[0] === picked[1]) action = { type: 'take2', gem: picked[0] };
  if (action) pickReason = reasonFor(action);
  else if (!interactive) pickReason = reasonFor({ type: 'take2', gem: 'garnet' }) ?? pickReason;

  const passReason = reasonFor({ type: 'pass' });

  return (
    <div className="supply">
      <div className="section-title">Token supply</div>
      <div className="supply-row">
        {TOKENS.map((t) => {
          const count = state.supply[t];
          const isGold = t === 'gold';
          const sel = picked.filter((x) => x === t).length;
          const canTwo = !isGold && count >= TAKE_TWO_MIN_PILE;
          const disabledReason = isGold
            ? 'Gold is gained only by reserving a card.'
            : !interactive
              ? 'Not available right now.'
              : count === 0
                ? `No ${GEM_LABEL[t]} left.`
                : null;
          return (
            <button
              key={t}
              data-fx={`supply-${t}`}
              className={`supply-token${sel ? ' selected' : ''}`}
              disabled={disabledReason !== null}
              title={
                disabledReason ??
                `${GEM_LABEL[t]}: ${count} left. ${canTwo ? 'Click twice to take 2.' : `Taking 2 needs ${TAKE_TWO_MIN_PILE}+ in the pile.`}`
              }
              onClick={() => toggle(t as Gem)}
            >
              <TokenChip gem={t as Token} count={count} size={52} dim={count === 0} />
              <span className="supply-label">{GEM_LABEL[t]}</span>
              {!isGold && <span className={`two-badge${canTwo ? '' : ' off'}`}>{canTwo ? '×2 ok' : '×2 no'}</span>}
              {sel > 0 && <span className="sel-badge">{sel === 2 ? '+2' : '+1'}</span>}
            </button>
          );
        })}
      </div>
      <div className="supply-actions">
        <span className="picked">
          {picked.length ? picked.map((g, i) => <GemIcon key={i} gem={g} size={20} />) : <span className="muted">No gems selected</span>}
        </span>
        <span className="btn-wrap" title={pickReason ?? ''}>
          <button
            className="primary"
            disabled={!action || pickReason !== null}
            onClick={() => {
              if (action) dispatch(action);
              setPicked([]);
            }}
          >
            Take {action?.type === 'take2' ? '2' : picked.length || ''} gem{picked.length === 1 ? '' : 's'}
          </button>
        </span>
        <button disabled={!picked.length} onClick={() => setPicked([])}>
          Clear
        </button>
        {interactive && passReason === null && (
          <button className="primary" onClick={() => dispatch({ type: 'pass' })}>
            No legal move — pass
          </button>
        )}
      </div>
    </div>
  );
}

function PlayerPanel({
  state,
  index,
  showHidden,
  isViewer,
  reasonFor,
  dispatch,
}: {
  state: GameState;
  index: number;
  showHidden: boolean;
  isViewer: boolean;
  reasonFor: (a: Action) => string | null;
  dispatch: (a: Action) => void;
}) {
  const p = state.players[index];
  const b = bonuses(p);
  const isCurrent = state.current === index && state.phase !== 'gameover';
  const total = tokenTotal(p.tokens);
  return (
    <div className={`player-panel${isCurrent ? ' current' : ''}`} style={{ ['--pc' as string]: PLAYER_COLORS[index] }} data-fx={`player-${index}`}>
      <div className="player-head">
        <span className="player-name">
          {isCurrent && <span className="turn-arrow">▶ </span>}
          {p.name}
          {index === state.startPlayer && <span className="first-badge" title="Starting player">1st</span>}
        </span>
        <span className="controller">{CONTROLLER_LABEL[p.controller]}</span>
        <span className="player-points" title="Prestige">
          {prestige(p)}
          <small>/{WIN_POINTS}</small>
        </span>
      </div>
      <div className="player-row" title="Tokens (max 10)">
        <span className="row-label">Tokens {total}/{MAX_TOKENS}</span>
        <div className="mini-tokens">
          {TOKENS.map((t) => (
            <span key={t} className={`mini${p.tokens[t] ? '' : ' zero'}`}>
              <GemIcon gem={t} size={16} />
              {p.tokens[t]}
            </span>
          ))}
        </div>
      </div>
      <div className="player-row" title="Permanent bonuses from purchased cards: each one lowers that gem's cost by 1">
        <span className="row-label">
          Card bonuses · {p.cards.length} card{p.cards.length === 1 ? '' : 's'}
        </span>
        <div className="bonus-row">
          {GEMS.map((g) => (
            <span key={g} className={`bonus-badge${b[g] ? '' : ' zero'}`} aria-label={`${b[g]} ${GEM_LABEL[g]} bonus`}>
              <GemIcon gem={g} size={18} />
              <b>{b[g]}</b>
            </span>
          ))}
        </div>
      </div>
      {p.patrons.length > 0 && (
        <div className="player-row">
          <span className="row-label">Patrons</span>
          <span className="patron-names">{p.patrons.map((id) => PATRON_BY_ID[id].name).join(', ')}</span>
        </div>
      )}
      <div className="reserved">
        <span className="row-label">
          Reserved {p.reserved.length}/{MAX_RESERVED}
        </span>
        <div className="reserved-cards">
          {p.reserved.map((r, i) => {
            const card = getCard(r.cardId);
            if (r.hidden && !showHidden) return <CardBack key={i} tier={card.tier} compact label="Hidden" />;
            const canAct = isCurrent && isViewer;
            return (
              <CardView
                key={i}
                card={card}
                compact
                bonuses={canAct ? b : undefined}
                highlight={canAct && !!paymentFor(p, card)}
                buttons={canAct ? [cardButton('Buy', { type: 'buy', source: { kind: 'reserved', index: i } }, reasonFor, dispatch, true)] : []}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActionLog({ state }: { state: GameState }) {
  const entries = state.log.slice(-80).reverse();
  return (
    <div className="log">
      <div className="section-title">Action log</div>
      <ol>
        {entries.map((e, i) => (
          <li key={state.log.length - i}>
            <span className="dot" style={{ background: PLAYER_COLORS[e.player] }} />
            {e.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function DiscardDialog({ state, dispatch, onUndo }: { state: GameState; dispatch: (a: Action) => void; onUndo?: () => void }) {
  const p = state.players[state.current];
  const excess = tokenTotal(p.tokens) - MAX_TOKENS;
  const [ret, setRet] = useState<Partial<Record<Token, number>>>({});
  const chosen = TOKENS.reduce((s, t) => s + (ret[t] ?? 0), 0);
  const action: Action = { type: 'discard', tokens: ret };
  const reason = validate(state, action);
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Return {excess} token{excess === 1 ? '' : 's'}</h2>
        <p>You may hold at most {MAX_TOKENS} tokens. Choose which to put back ({chosen}/{excess}).</p>
        <div className="discard-grid">
          {TOKENS.filter((t) => p.tokens[t] > 0).map((t) => {
            const n = ret[t] ?? 0;
            return (
              <div key={t} className="discard-item">
                <TokenChip gem={t} count={p.tokens[t] - n} size={46} />
                <div className="stepper">
                  <button className="small" disabled={n === 0} onClick={() => setRet({ ...ret, [t]: n - 1 })} aria-label={`Keep one more ${GEM_LABEL[t]}`}>
                    −
                  </button>
                  <span>{n}</span>
                  <button
                    className="small"
                    disabled={n >= p.tokens[t] || chosen >= excess}
                    onClick={() => setRet({ ...ret, [t]: n + 1 })}
                    aria-label={`Return one ${GEM_LABEL[t]}`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="modal-actions">
          {onUndo && <button onClick={onUndo}>↶ Undo turn</button>}
          <span className="btn-wrap" title={reason ?? ''}>
            <button className="primary" disabled={reason !== null} onClick={() => dispatch(action)}>
              Return tokens
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function PatronDialog({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const b = bonuses(state.players[state.current]);
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Patrons want to visit you</h2>
        <p>Only one patron may visit per turn. Pick who you receive — the others may still come later.</p>
        <div className="patron-row">
          {state.patronChoices.map((id) => (
            <PatronTile key={id} id={id} bonuses={b} onClick={() => dispatch({ type: 'choosePatron', patronId: id })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GameOver({ state, onNewGame }: { state: GameState; onNewGame: () => void }) {
  const ranking = useMemo(
    () =>
      state.players
        .map((p, i) => ({ p, i, pts: prestige(p) }))
        .sort((a, b) => b.pts - a.pts || a.p.cards.length - b.p.cards.length),
    [state],
  );
  const winners = state.winners.map((i) => state.players[i].name);
  const [hidden, setHidden] = useState(false);
  if (hidden)
    return (
      <div className="confirm-bar">
        <span>Game over — {winners.join(' & ')} {winners.length > 1 ? 'share the victory' : 'wins'}.</span>
        <button onClick={() => setHidden(false)}>Show results</button>
        <button className="primary" onClick={onNewGame}>
          New game
        </button>
      </div>
    );
  return (
    <div className="modal-backdrop">
      <div className="modal results">
        <h2>{winners.length > 1 ? `Shared victory: ${winners.join(' & ')}` : `${winners[0]} wins!`}</h2>
        <p className="muted">
          After {state.round} round{state.round === 1 ? '' : 's'}. Ties are broken by fewest purchased cards.
        </p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Prestige</th>
              <th>Cards</th>
              <th>Patrons</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map(({ p, i, pts }, rank) => (
              <tr key={i} className={state.winners.includes(i) ? 'winner' : ''}>
                <td>{rank + 1}</td>
                <td>
                  <span className="dot" style={{ background: PLAYER_COLORS[i] }} /> {p.name}
                  <span className="muted"> · {CONTROLLER_LABEL[p.controller]}</span>
                </td>
                <td>{pts}</td>
                <td>{p.cards.length}</td>
                <td>{p.patrons.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="modal-actions">
          <button onClick={() => setHidden(true)}>View board</button>
          <button className="primary" onClick={onNewGame}>
            New game
          </button>
        </div>
      </div>
    </div>
  );
}

function NewGameDialog({
  onStart,
  onCancel,
  canCancel,
}: {
  onStart: (seats: SeatConfig[]) => void;
  onCancel: () => void;
  canCancel: boolean;
}) {
  const [count, setCount] = useState(2);
  const [seats, setSeats] = useState<SeatConfig[]>([
    { name: 'Player 1', controller: 'human' },
    { name: 'Player 2', controller: 'medium' },
    { name: 'Player 3', controller: 'medium' },
    { name: 'Player 4', controller: 'easy' },
  ]);
  const update = (i: number, patch: Partial<SeatConfig>) => setSeats(seats.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="modal-backdrop">
      <div className="modal new-game">
        <div className="title-row">
          <GemIcon gem="garnet" size={28} />
          <GemIcon gem="lapis" size={28} />
          <GemIcon gem="jade" size={28} />
          <GemIcon gem="obsidian" size={28} />
          <GemIcon gem="moonstone" size={28} />
        </div>
        <h1>Facets</h1>
        <p className="muted">Trade gems, build workshops, court patrons. First to {WIN_POINTS} prestige ends the round.</p>
        <div className="field">
          <span>Players</span>
          <div className="seg">
            {[2, 3, 4].map((n) => (
              <button key={n} className={n === count ? 'primary' : ''} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        {seats.slice(0, count).map((s, i) => (
          <div className="seat" key={i}>
            <span className="dot" style={{ background: PLAYER_COLORS[i] }} />
            <input value={s.name} maxLength={16} onChange={(e) => update(i, { name: e.target.value })} aria-label={`Seat ${i + 1} name`} />
            <select value={s.controller} onChange={(e) => update(i, { controller: e.target.value as Controller })} aria-label={`Seat ${i + 1} controller`}>
              <option value="human">Human</option>
              <option value="easy">AI · Easy</option>
              <option value="medium">AI · Medium</option>
            </select>
          </div>
        ))}
        <div className="modal-actions">
          {canCancel && <button onClick={onCancel}>Back to current game</button>}
          <button
            className="primary"
            onClick={() => onStart(seats.slice(0, count).map((s, i) => ({ ...s, name: s.name.trim() || `Player ${i + 1}` })))}
          >
            Start game
          </button>
        </div>
        {canCancel && <p className="muted small-print">Starting a new game replaces the saved one.</p>}
      </div>
    </div>
  );
}
