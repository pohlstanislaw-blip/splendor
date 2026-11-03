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
import { BoughtStacks, CardBack, CardView } from './components/CardView';
import { ArtDefs } from './components/CardArt';
import { Fx } from './components/Fx';
import { CostPip, GemDefs, GemIcon, TokenChip } from './components/Gem';
import { Portrait } from './components/Portrait';
import { useGame } from './useGame';
import { HIDDEN_PREFIX, type SeatKind, type SeatView } from './online/protocol';
import { inviteCodeFromUrl, inviteLink, savedName, useOnline, type OnlineApi } from './online/useOnline';
import { ordinal, personalizeLog, placeOf, seatOrderFrom } from './online/perspective';

const PLAYER_COLORS = ['#f0b429', '#4fd1c5', '#f687b3', '#9f7aea'];
const CONTROLLER_LABEL: Record<Controller, string> = { human: 'Human', easy: 'AI · Easy', medium: 'AI · Medium' };

export default function App() {
  const game = useGame();
  const online = useOnline();
  const inviteCode = useMemo(() => inviteCodeFromUrl(), []);
  const [showNewGame, setShowNewGame] = useState(!game.session || !!inviteCode);
  const room = online.room;

  if (room?.status === 'playing' && room.state) {
    return (
      <Board
        state={room.state}
        dispatch={online.act}
        undo={online.undo}
        canUndo={room.canUndo}
        error={online.error}
        clearError={online.clearError}
        onNewGame={() => setShowNewGame(true)}
        online={{
          code: room.code,
          you: room.you,
          seats: room.seats,
          isHost: room.you !== null && room.seats[room.you].isHost,
          status: online.status,
          onLeave: () => {
            online.leave();
            setShowNewGame(true);
          },
          onRematch: online.rematch,
          onBotify: online.botify,
        }}
      />
    );
  }

  if (room?.status === 'lobby') {
    return (
      <div className="app">
        <GemDefs />
        <div className="lantern-vignette" aria-hidden />
        <Lobby online={online} />
      </div>
    );
  }

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
          online={online}
          inviteCode={inviteCode}
        />
      </div>
    );
  }

  const session = game.session;
  return (
    <Board
      state={session.state}
      dispatch={game.dispatch}
      undo={game.undo}
      canUndo={game.canUndo}
      error={game.error}
      clearError={game.clearError}
      onNewGame={() => setShowNewGame(true)}
    />
  );
}

// ---------------------------------------------------------------------------

interface OnlineBoard {
  code: string;
  you: number | null;
  seats: SeatView[];
  isHost: boolean;
  status: string;
  onLeave: () => void;
  onRematch: () => void;
  onBotify: (seat: number) => void;
}

interface BoardProps {
  state: GameState;
  dispatch: (a: Action) => void;
  undo: () => void;
  canUndo: boolean;
  error: string | null;
  clearError: () => void;
  onNewGame: () => void;
  /** present when this is an online game */
  online?: OnlineBoard;
}

function Board({ state, dispatch, undo, canUndo, error, clearError, onNewGame, online }: BoardProps) {
  const current = state.players[state.current];
  const humans = state.players.filter((p) => p.controller === 'human').length;
  /** may this screen act for the current seat? */
  const isHuman = online ? online.you === state.current : current.controller === 'human';

  const [revealedTurn, setRevealedTurn] = useState<number | null>(null);
  const handoff = !online && humans >= 2 && isHuman && state.phase === 'action' && revealedTurn !== state.turn;
  const interactive = isHuman && state.phase === 'action' && !handoff;

  const [picked, setPicked] = useState<Gem[]>([]);
  useEffect(() => setPicked([]), [state.turn, state.phase]);

  /** whose hidden cards may be shown face up right now */
  const viewer = online
    ? state.phase === 'gameover'
      ? 'all'
      : online.you
    : humans === 0
      ? 'all'
      : isHuman && !handoff
        ? state.current
        : null;

  const reasonFor = (action: Action): string | null => {
    if (state.phase === 'gameover') return 'The game is over.';
    if (!isHuman) return online && online.you === null ? 'You are watching this game.' : `Waiting for ${current.name}…`;
    if (handoff) return 'Reveal the turn first.';
    return validate(state, action);
  };

  const myBonuses = bonuses(current);

  // Online: arrange everything around this player.
  const seated = !!online && online.you !== null;
  const order = online ? seatOrderFrom(state.players.length, online.you) : state.players.map((_, i) => i);
  const myTurnStarts = seated && state.current === online!.you && state.phase === 'action';
  const [banner, setBanner] = useState(false);
  useEffect(() => {
    if (!myTurnStarts) return;
    setBanner(true);
    const t = window.setTimeout(() => setBanner(false), 2200);
    return () => window.clearTimeout(t);
  }, [myTurnStarts, state.turn]);
  useEffect(() => {
    if (!online) return;
    const yourTurn = seated && state.current === online.you && state.phase !== 'gameover';
    document.title = yourTurn ? '● Your turn · Facets' : 'Facets';
    return () => {
      document.title = 'Facets';
    };
  }, [online, seated, state.current, state.phase]);

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
        <TurnIndicator state={state} you={online?.you ?? null} />
        <div className="topbar-actions">
          {online ? (
            <>
              <span className={`room-chip${online.status === 'open' ? '' : ' warn'}`} title={online.status === 'open' ? 'Connected' : 'Reconnecting to the server…'}>
                Room <b>{online.code}</b>
                {online.status !== 'open' && ' · reconnecting…'}
              </span>
              <button onClick={online.onLeave}>Leave</button>
            </>
          ) : (
            <button onClick={onNewGame}>New game</button>
          )}
        </div>
      </header>

      {banner && (
        <div className="turn-banner" role="status">
          Your turn
        </div>
      )}
      {error && (
        <div className="error-toast" role="alert" onClick={clearError}>
          {error}
        </div>
      )}

      <main className="layout">
        <section className="board">
          <Patrons state={state} />
          <div className="market">
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
          </div>
          <Supply state={state} picked={picked} setPicked={setPicked} interactive={interactive} reasonFor={reasonFor} dispatch={dispatch} />
        </section>

        <aside className={`side${seated ? ' personal' : ''}`}>
          {order.map((i) => (
            <PlayerPanel
              key={i}
              variant={!seated ? 'normal' : i === online!.you ? 'self' : 'opponent'}
              state={state}
              index={i}
              showHidden={viewer === 'all' || viewer === i}
              reasonFor={reasonFor}
              dispatch={dispatch}
              isViewer={viewer === i}
              seat={online?.seats[i]}
              onBotify={online?.isHost ? () => online.onBotify(i) : undefined}
            />
          ))}
          <ActionLog state={state} myName={seated ? state.players[online!.you!].name : null} />
        </aside>
      </main>

      {isHuman && state.phase !== 'action' && state.phase !== 'gameover' && (
        <div className="confirm-bar">
          <span>
            {state.phase === 'confirm' && 'Action done.'}
            {state.phase === 'discard' && 'Too many tokens — return some.'}
            {state.phase === 'patron' && 'Choose a visiting patron.'}
          </span>
          <span title={canUndo ? 'Take back this turn' : 'Undo is unavailable after drawing a hidden card'} className="btn-wrap">
            <button onClick={undo} disabled={!canUndo}>
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

      {state.phase === 'discard' && isHuman && <DiscardDialog state={state} dispatch={dispatch} onUndo={canUndo ? undo : undefined} />}
      {state.phase === 'patron' && isHuman && <PatronDialog state={state} dispatch={dispatch} />}
      {state.phase === 'gameover' && <GameOver state={state} onNewGame={onNewGame} online={online} />}
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

function TurnIndicator({ state, you }: { state: GameState; you: number | null }) {
  const p = state.players[state.current];
  if (state.phase === 'gameover') return <div className="turn-indicator">Game over</div>;
  return (
    <div className="turn-indicator">
      <span className="dot" style={{ background: PLAYER_COLORS[state.current] }} />
      <span>
        Round {state.round} · <b>{state.current === you ? 'Your turn' : you !== null ? `${p.name}'s turn` : p.name}</b>
        {p.controller !== 'human' && <span className="thinking"> is thinking…</span>}
      </span>
      {state.finalRound && <span className="final-badge">Final round</span>}
    </div>
  );
}

function Patrons({ state }: { state: GameState }) {
  return (
    <div className="patrons">
      <div className="section-title" title="Each patron visit is worth 3 prestige">Patrons · 3 each</div>
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
  seat,
  onBotify,
  variant = 'normal',
}: {
  variant?: 'normal' | 'self' | 'opponent';
  state: GameState;
  index: number;
  showHidden: boolean;
  isViewer: boolean;
  reasonFor: (a: Action) => string | null;
  dispatch: (a: Action) => void;
  /** online seat info (connection status) */
  seat?: SeatView;
  /** host-only: hand a disconnected player's seat to a bot */
  onBotify?: () => void;
}) {
  const p = state.players[index];
  const offline = !!seat && seat.kind === 'human' && !seat.connected;
  const b = bonuses(p);
  const isCurrent = state.current === index && state.phase !== 'gameover';
  const total = tokenTotal(p.tokens);
  return (
    <div className={`player-panel ${variant}${isCurrent ? ' current' : ''}`} style={{ ['--pc' as string]: PLAYER_COLORS[index] }} data-fx={`player-${index}`}>
      <div className="player-head">
        <span className="player-name">
          {isCurrent && <span className="turn-arrow">▶ </span>}
          {variant === 'self' ? (
            <>
              You <small className="self-name">{p.name}</small>
            </>
          ) : (
            p.name
          )}
          {index === state.startPlayer && <span className="first-badge" title="Starting player">1st</span>}
        </span>
        <span className="controller">
          {variant === 'self' ? (isCurrent ? 'Your turn' : 'Waiting') : CONTROLLER_LABEL[p.controller]}
          {offline && <span className="offline-badge"> · offline</span>}
        </span>
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
          Cards bought · {p.cards.length} · bonuses per colour
        </span>
        <BoughtStacks cardIds={p.cards} getCard={getCard} />
      </div>
      {p.patrons.length > 0 && (
        <div className="player-row">
          <span className="row-label">Patrons</span>
          <span className="patron-names">{p.patrons.map((id) => PATRON_BY_ID[id].name).join(', ')}</span>
        </div>
      )}
      {offline && onBotify && state.phase !== 'gameover' && (
        <button className="small" onClick={onBotify} title="They left the game. A Medium bot takes over their seat, cards and tokens.">
          Hand seat to a bot
        </button>
      )}
      <div className="reserved">
        <span className="row-label">
          Reserved {p.reserved.length}/{MAX_RESERVED}
        </span>
        <div className="reserved-cards">
          {p.reserved.map((r, i) => {
            // online, other players' face-down cards arrive as `hidden:<tier>` placeholders
            if (r.cardId.startsWith(HIDDEN_PREFIX)) return <CardBack key={i} tier={Number(r.cardId.slice(HIDDEN_PREFIX.length)) as Tier} compact label="Hidden" />;
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

function ActionLog({ state, myName = null }: { state: GameState; myName?: string | null }) {
  const entries = state.log.slice(-80).reverse();
  return (
    <div className="log">
      <div className="section-title">Action log</div>
      <ol>
        {entries.map((e, i) => (
          <li key={state.log.length - i}>
            <span className="dot" style={{ background: PLAYER_COLORS[e.player] }} />
            {personalizeLog(e.text, myName)}
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

function GameOver({ state, onNewGame, online }: { state: GameState; onNewGame: () => void; online?: OnlineBoard }) {
  const nextButtons = online ? (
    <>
      <button onClick={online.onLeave}>Leave room</button>
      {online.isHost ? (
        <button className="primary" onClick={online.onRematch}>
          Rematch
        </button>
      ) : (
        <span className="muted">Waiting for the host to start a rematch…</span>
      )}
    </>
  ) : (
    <button className="primary" onClick={onNewGame}>
      New game
    </button>
  );
  const ranking = useMemo(
    () =>
      state.players
        .map((p, i) => ({ p, i, pts: prestige(p) }))
        .sort((a, b) => b.pts - a.pts || a.p.cards.length - b.p.cards.length),
    [state],
  );
  const winners = state.winners.map((i) => state.players[i].name);
  const you = online?.you ?? null;
  const score = (i: number): [number, number] => [prestige(state.players[i]), state.players[i].cards.length];
  const others = state.winners.filter((i) => i !== you).map((i) => state.players[i].name);
  const headline =
    you === null
      ? winners.length > 1
        ? `Shared victory: ${winners.join(' & ')}`
        : `${winners[0]} wins!`
      : state.winners.includes(you)
        ? others.length
          ? `You share the victory with ${others.join(' & ')}!`
          : 'You win!'
        : `${winners.join(' & ')} ${winners.length > 1 ? 'share the win' : 'wins'} — you placed ${ordinal(placeOf(state, you, score))}`;
  const [hidden, setHidden] = useState(false);
  if (hidden)
    return (
      <div className="confirm-bar">
        <span>Game over — {headline}</span>
        <button onClick={() => setHidden(false)}>Show results</button>
        {nextButtons}
      </div>
    );
  return (
    <div className="modal-backdrop">
      <div className="modal results">
        <h2>{headline}</h2>
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
                  {i === you && <b className="you-tag"> you</b>}
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
          {nextButtons}
        </div>
      </div>
    </div>
  );
}

function NewGameDialog({
  onStart,
  onCancel,
  canCancel,
  online,
  inviteCode,
}: {
  onStart: (seats: SeatConfig[]) => void;
  onCancel: () => void;
  canCancel: boolean;
  online: OnlineApi;
  inviteCode: string | null;
}) {
  const [tab, setTab] = useState<'local' | 'online'>(inviteCode ? 'online' : 'local');
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
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'local'} className={tab === 'local' ? 'active' : ''} onClick={() => setTab('local')}>
            On this device
          </button>
          <button role="tab" aria-selected={tab === 'online'} className={tab === 'online' ? 'active' : ''} onClick={() => setTab('online')}>
            Online
          </button>
        </div>
        {tab === 'online' ? (
          <OnlinePanel online={online} inviteCode={inviteCode} />
        ) : (
          <>
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
                <input id={`seat-name-${i}`} value={s.name} maxLength={16} onChange={(e) => update(i, { name: e.target.value })} aria-label={`Seat ${i + 1} name`} />
                <select id={`seat-kind-${i}`} value={s.controller} onChange={(e) => update(i, { controller: e.target.value as Controller })} aria-label={`Seat ${i + 1} controller`}>
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
          </>
        )}
        {tab === 'online' && canCancel && (
          <div className="modal-actions">
            <button onClick={onCancel}>Back to my local game</button>
          </div>
        )}
      </div>
    </div>
  );
}

const SEAT_KIND_LABEL: Record<SeatKind, string> = { human: 'Friend (invite)', easy: 'AI · Easy', medium: 'AI · Medium' };

function OnlinePanel({ online, inviteCode }: { online: OnlineApi; inviteCode: string | null }) {
  const [name, setName] = useState(savedName());
  const [code, setCode] = useState(inviteCode ?? '');
  const [count, setCount] = useState(2);
  const [kinds, setKinds] = useState<SeatKind[]>(['human', 'human', 'human']);
  useEffect(() => online.connect(), [online.connect]);

  if (online.status === 'unavailable') {
    return (
      <div className="online-panel">
        <p>
          Online play needs the Facets game server, and this copy of the game is running without one. Host the game yourself
          with <code>npm start</code> or on Render (see the README), then open that address instead.
        </p>
        <div className="modal-actions">
          <button onClick={online.connect}>Try again</button>
        </div>
      </div>
    );
  }

  const myName = name.trim();
  const nameReason = myName ? null : 'Enter your name first.';
  const busy = online.status === 'connecting';
  return (
    <div className="online-panel">
      <label className="field" htmlFor="online-name">
        <span>Your name</span>
        <input id="online-name" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="How others see you" />
      </label>

      {inviteCode && (
        <div className="online-section invite-callout">
          <h3>You were invited to room {inviteCode}</h3>
          <span className="btn-wrap" title={nameReason ?? ''}>
            <button className="primary" disabled={!!nameReason || busy} onClick={() => online.join(inviteCode, myName)}>
              Join room {inviteCode}
            </button>
          </span>
        </div>
      )}

      <div className="online-section">
        <h3>Start a room</h3>
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
        <div className="seat">
          <span className="dot" style={{ background: PLAYER_COLORS[0] }} />
          <span className="seat-fixed">{myName || 'You'} (host)</span>
        </div>
        {Array.from({ length: count - 1 }, (_, k) => (
          <div className="seat" key={k}>
            <span className="dot" style={{ background: PLAYER_COLORS[k + 1] }} />
            <select
              id={`online-seat-${k + 1}`}
              value={kinds[k]}
              onChange={(e) => setKinds(kinds.map((x, j) => (j === k ? (e.target.value as SeatKind) : x)))}
              aria-label={`Seat ${k + 2}`}
            >
              {(['human', 'easy', 'medium'] as SeatKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {SEAT_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="modal-actions">
          <span className="btn-wrap" title={nameReason ?? ''}>
            <button className="primary" disabled={!!nameReason || busy} onClick={() => online.create(myName, ['human', ...kinds.slice(0, count - 1)])}>
              Create room
            </button>
          </span>
        </div>
      </div>

      {!inviteCode && (
        <div className="online-section">
          <h3>Join a room</h3>
          <div className="seat">
            <input
              id="online-code"
              className="code-input"
              value={code}
              maxLength={5}
              placeholder="Room code"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              aria-label="Room code"
            />
            <span className="btn-wrap" title={nameReason ?? (code.trim().length < 5 ? 'Enter the 5-character room code.' : '')}>
              <button disabled={!!nameReason || code.trim().length < 5 || busy} onClick={() => online.join(code, myName)}>
                Join
              </button>
            </span>
          </div>
        </div>
      )}

      {busy && <p className="muted">Connecting to the server…</p>}
      {online.error && (
        <p className="form-error" role="alert">
          {online.error}
        </p>
      )}
    </div>
  );
}

function Lobby({ online }: { online: OnlineApi }) {
  const room = online.room!;
  const me = room.you;
  const isHost = me !== null && room.seats[me].isHost;
  const missing = room.seats.filter((s) => !s.taken).length;
  const link = inviteLink(room.code);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      (document.getElementById('invite-link') as HTMLInputElement | null)?.select();
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal lobby">
        <p className="section-title">Room code</p>
        <div className="lobby-code" aria-label={`Room code ${room.code.split('').join(' ')}`}>
          {room.code}
        </div>
        <p className="muted">Send friends this link, or tell them the code to enter under Online → Join a room.</p>
        <div className="invite-row">
          <input id="invite-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
          <button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
        <ul className="seat-list">
          {room.seats.map((s, i) => (
            <li key={i}>
              <span className="dot" style={{ background: PLAYER_COLORS[i] }} />
              <span className="seat-name">
                {s.taken ? s.name : <i className="muted">Waiting for a player…</i>}
                {i === me && <b className="you-tag"> you</b>}
              </span>
              <span className="seat-meta">
                {s.isHost && 'Host'}
                {s.kind !== 'human' && 'Bot'}
                {s.kind === 'human' && s.taken && !s.connected && ' · offline'}
              </span>
              {isHost && !s.taken && (
                <button className="small" onClick={() => online.botify(i)}>
                  Fill with bot
                </button>
              )}
            </li>
          ))}
        </ul>
        {online.error && (
          <p className="form-error" role="alert">
            {online.error}
          </p>
        )}
        <div className="modal-actions">
          <button onClick={online.leave}>Leave room</button>
          {isHost ? (
            <span className="btn-wrap" title={missing ? `Waiting for ${missing} more player${missing === 1 ? '' : 's'}.` : ''}>
              <button className="primary" disabled={missing > 0} onClick={online.start}>
                Start game
              </button>
            </span>
          ) : (
            <span className="muted">The host starts the game when everyone is here.</span>
          )}
        </div>
        {online.status !== 'open' && <p className="muted small-print">Reconnecting to the server…</p>}
      </div>
    </div>
  );
}
