import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Lightbulb, ListChecks, RefreshCcw, RotateCcw, Shuffle, X } from 'lucide-react';
import ProgressRing from './ProgressRing.jsx';
import { useHotkeys } from '../hooks/useHotkeys.js';
import { shuffle as shuffleList } from '../lib/shuffle.js';

const SWIPE_THRESHOLD = 90;

/**
 * Flip-card study mode.
 * Tap/Space flips · swipe right or press 2 = "Got it" · swipe left or press 1 = "Still learning".
 * A "round" is an ordered list of card ids; reviewing = a new round with only the cards still being learned.
 */
export default function FlashcardDeck({ cards, progress, onMark, onReset, onQuiz, disabled }) {
  const byId = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);

  const [round, setRound] = useState(() => ({ ids: cards.map((c) => c.id), kind: 'all' }));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [finished, setFinished] = useState(false);
  const [exit, setExit] = useState(null); // 'left' | 'right' while a card animates away
  const [dragX, setDragX] = useState(0);
  const drag = useRef(null);

  const ids = round.ids.filter((id) => byId[id]);
  const card = byId[ids[index]];
  const learningIds = cards.filter((c) => progress.learning[c.id]).map((c) => c.id);
  const knownCount = cards.filter((c) => progress.known[c.id]).length;

  const statusOf = (id) => (progress.known[id] ? 'known' : progress.learning[id] ? 'learning' : 'new');

  function startRound(kind, doShuffle = shuffled) {
    const base = kind === 'learning' ? learningIds : cards.map((c) => c.id);
    setRound({ ids: doShuffle ? shuffleList(base) : base, kind });
    setIndex(0);
    setFlipped(false);
    setShowHint(false);
    setFinished(false);
  }

  function go(delta) {
    if (exit) return;
    const next = index + delta;
    if (next < 0) return;
    if (next >= ids.length) { setFinished(true); return; }
    setIndex(next);
    setFlipped(false);
    setShowHint(false);
  }

  function mark(status) {
    if (!card || exit || disabled) return;
    onMark(card.id, status);
    setExit(status === 'known' ? 'right' : 'left');
    setTimeout(() => {
      setExit(null);
      setDragX(0);
      go(1);
    }, 260);
  }

  function toggleShuffle() {
    const next = !shuffled;
    setShuffled(next);
    startRound(round.kind, next);
  }

  useHotkeys({
    ' ': () => !finished && setFlipped((f) => !f),
    enter: () => !finished && setFlipped((f) => !f),
    arrowright: () => !finished && go(1),
    arrowleft: () => !finished && go(-1),
    1: () => !finished && mark('learning'),
    2: () => !finished && mark('known'),
    h: () => card?.hint && setShowHint(true),
    s: toggleShuffle,
  }, !disabled);

  // ----- swipe / tap handling (pointer events cover mouse + touch + pen) -----
  const onPointerDown = (e) => {
    if (exit || disabled || e.target.closest('button')) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - d.y)) d.moved = true;
    if (d.moved) setDragX(dx);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) { setFlipped((f) => !f); return; }
    if (dragX > SWIPE_THRESHOLD) mark('known');
    else if (dragX < -SWIPE_THRESHOLD) mark('learning');
    else setDragX(0);
  };

  // ----- end-of-round summary -----
  if (finished || !card) {
    const roundKnown = ids.filter((id) => progress.known[id]).length;
    const pct = ids.length ? Math.round((roundKnown / ids.length) * 100) : 0;
    return (
      <div className="round-summary">
        <ProgressRing value={pct} size={132} stroke={11} tone={pct >= 80 ? 'good' : 'accent'}>
          <span className="ring-big">{roundKnown}<small>/{ids.length}</small></span>
        </ProgressRing>
        <h2>{pct === 100 ? 'You nailed every card.' : pct >= 60 ? 'Nice progress.' : 'Good start — keep going.'}</h2>
        <p className="muted">
          {round.kind === 'learning' ? 'Review round' : 'Full deck'} complete · {knownCount} of {cards.length} cards mastered overall
        </p>
        <div className="summary-actions">
          {learningIds.length > 0 && (
            <button className="btn btn-primary" onClick={() => startRound('learning')}>
              <RotateCcw size={17} /> Review {learningIds.length} still learning
            </button>
          )}
          <button className={`btn ${learningIds.length ? 'btn-secondary' : 'btn-primary'}`} onClick={() => startRound('all')}>
            <RefreshCcw size={17} /> Study all again
          </button>
          {onQuiz && (
            <button className="btn btn-ghost" onClick={onQuiz}><ListChecks size={17} /> Take the quiz</button>
          )}
        </div>
      </div>
    );
  }

  const status = statusOf(card.id);
  const long = Math.max(card.front.length, card.back.length) > 160;
  const swipeIntent = dragX > 30 ? 'known' : dragX < -30 ? 'learning' : null;
  const cardStyle = exit
    ? undefined
    : dragX
      ? { transform: `translateX(${dragX}px) rotate(${dragX / 18}deg)`, transition: 'none' }
      : undefined;

  return (
    <div className="deck">
      <div className="deck-toolbar">
        <div className="deck-counter">
          <strong>{index + 1}</strong> / {ids.length}
          {round.kind === 'learning' && <span className="tag tag-warn">Reviewing</span>}
        </div>
        <div className="deck-tools">
          <button className={`icon-btn icon-btn-sm ${shuffled ? 'is-on' : ''}`} onClick={toggleShuffle} aria-pressed={shuffled} title="Shuffle (S)" aria-label="Shuffle">
            <Shuffle size={16} />
          </button>
          {learningIds.length > 0 && round.kind !== 'learning' && (
            <button className="btn btn-ghost btn-xs" onClick={() => startRound('learning')}>
              Review {learningIds.length} missed
            </button>
          )}
          {round.kind === 'learning' && (
            <button className="btn btn-ghost btn-xs" onClick={() => startRound('all')}>All cards</button>
          )}
          {(knownCount > 0 || learningIds.length > 0) && (
            <button className="btn btn-ghost btn-xs" onClick={() => { onReset(); startRound('all'); }}>Reset</button>
          )}
        </div>
      </div>

      <div className="deck-dots" aria-hidden="true">
        {ids.map((id, i) => (
          <span key={id} className={`dot dot-${statusOf(id)} ${i === index ? 'is-current' : ''}`} />
        ))}
      </div>

      <div className="card-stage">
        <div className="card-shadow card-shadow-1" aria-hidden="true" />
        <div className="card-shadow card-shadow-2" aria-hidden="true" />
        <div
          key={card.id}
          className={`flashcard ${flipped ? 'is-flipped' : ''} ${exit ? `exit-${exit}` : ''} ${long ? 'is-long' : ''}`}
          style={cardStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { drag.current = null; setDragX(0); }}
          role="button"
          tabIndex={0}
          aria-label={flipped ? `Answer: ${card.back}. Press space to see the question.` : `Question: ${card.front}. Press space to reveal the answer.`}
        >
          <div className="flashcard-inner">
            <div className="face face-front">
              <div className="face-top">
                <span className="face-label">Question</span>
                {card.tag && <span className="tag">{card.tag}</span>}
              </div>
              <p className="face-text">{card.front}</p>
              <div className="face-bottom">
                {card.hint && (showHint ? (
                  <span className="hint-text"><Lightbulb size={14} /> {card.hint}</span>
                ) : (
                  <button className="hint-btn" onClick={(e) => { e.stopPropagation(); setShowHint(true); }}>
                    <Lightbulb size={14} /> Hint
                  </button>
                ))}
                <span className="flip-hint">Tap to flip</span>
              </div>
            </div>
            <div className="face face-back">
              <div className="face-top">
                <span className="face-label">Answer</span>
                {status !== 'new' && <span className={`tag tag-${status === 'known' ? 'good' : 'warn'}`}>{status === 'known' ? 'Got it' : 'Still learning'}</span>}
              </div>
              <p className="face-text">{card.back}</p>
              <div className="face-bottom">
                <span className="flip-hint">Swipe → if you knew it, ← if not</span>
              </div>
            </div>
          </div>
          <span className="swipe-label swipe-known" style={{ opacity: swipeIntent === 'known' ? Math.min(1, dragX / SWIPE_THRESHOLD) : 0 }}>Got it</span>
          <span className="swipe-label swipe-learning" style={{ opacity: swipeIntent === 'learning' ? Math.min(1, -dragX / SWIPE_THRESHOLD) : 0 }}>Still learning</span>
        </div>
      </div>

      <div className="deck-controls">
        <button className="icon-btn icon-btn-lg" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous card (←)">
          <ArrowLeft size={20} />
        </button>
        <button className="btn btn-learning" onClick={() => mark('learning')} disabled={disabled}>
          <X size={18} /> <span>Still learning</span> <kbd className="hide-sm">1</kbd>
        </button>
        <button className="btn btn-known" onClick={() => mark('known')} disabled={disabled}>
          <Check size={18} /> <span>Got it</span> <kbd className="hide-sm">2</kbd>
        </button>
        <button className="icon-btn icon-btn-lg" onClick={() => go(1)} aria-label="Next card (→)">
          <ArrowRight size={20} />
        </button>
      </div>

      <p className="kbd-legend hide-sm">
        <kbd>Space</kbd> flip · <kbd>←</kbd><kbd>→</kbd> move · <kbd>1</kbd> still learning · <kbd>2</kbd> got it · <kbd>H</kbd> hint · <kbd>S</kbd> shuffle
      </p>
    </div>
  );
}
