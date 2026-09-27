import { useMemo, useState } from 'react';
import { ArrowRight, Check, Layers, RefreshCcw, RotateCcw, X } from 'lucide-react';
import ProgressRing from './ProgressRing.jsx';
import { useHotkeys } from '../hooks/useHotkeys.js';
import { shuffle } from '../lib/shuffle.js';

const LETTERS = 'ABCDEF';

/** Build a round: which questions, in what order, with options shuffled per question. */
function makeRound(questions, number, isRetest) {
  return {
    number,
    isRetest,
    items: shuffle(questions).map((q) => ({ id: q.id, order: shuffle(q.options.map((_, i) => i)) })),
  };
}

/**
 * Multiple-choice quiz. After each round you can re-test ONLY the questions you got wrong,
 * as many times as it takes to get them all right.
 */
export default function Quiz({ questions, onRoundComplete, onCards, disabled }) {
  const byId = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q])), [questions]);
  const [round, setRound] = useState(() => makeRound(questions, 1, false));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // questionId -> original option index chosen
  const [phase, setPhase] = useState('question'); // 'question' | 'results'

  const item = round.items[index];
  const q = item && byId[item.id];
  const chosen = q ? answers[q.id] : undefined;
  const answered = chosen !== undefined;

  const results = round.items.map(({ id }) => ({ q: byId[id], chosen: answers[id], correct: answers[id] === byId[id].answerIndex }));
  const correctCount = results.filter((r) => r.correct).length;
  const wrong = results.filter((r) => !r.correct);

  function choose(originalIdx) {
    if (answered || disabled || !q) return;
    setAnswers((a) => ({ ...a, [q.id]: originalIdx }));
  }

  function next() {
    if (!answered) return;
    if (index + 1 < round.items.length) {
      setIndex(index + 1);
    } else {
      setPhase('results');
      onRoundComplete?.({ correct: correctCount, total: round.items.length, isRetest: round.isRetest });
    }
  }

  function start(qs, isRetest) {
    setRound((r) => makeRound(qs, r.number + 1, isRetest));
    setAnswers({});
    setIndex(0);
    setPhase('question');
  }

  const keys = { enter: next, arrowright: next };
  item?.order.forEach((orig, pos) => {
    keys[String(pos + 1)] = () => choose(orig);
    keys[LETTERS[pos].toLowerCase()] = () => choose(orig);
  });
  useHotkeys(keys, phase === 'question' && !disabled);

  // ----- results -----
  if (phase === 'results') {
    const pct = Math.round((correctCount / round.items.length) * 100);
    return (
      <div className="quiz-results">
        <div className="results-hero">
          <ProgressRing value={pct} size={140} stroke={12} tone={pct >= 80 ? 'good' : pct >= 50 ? 'accent' : 'bad'}>
            <span className="ring-big">{pct}<small>%</small></span>
          </ProgressRing>
          <div>
            <p className="eyebrow">{round.isRetest ? `Re-test · round ${round.number}` : 'Quiz complete'}</p>
            <h2>
              {wrong.length === 0
                ? round.isRetest ? 'All fixed. Every answer is right now.' : 'Perfect score!'
                : `${correctCount} of ${round.items.length} correct`}
            </h2>
            <p className="muted">
              {wrong.length === 0 ? 'Nothing left to re-test.' : `Re-test the ${wrong.length} you missed until they stick.`}
            </p>
            <div className="summary-actions">
              {wrong.length > 0 && (
                <button className="btn btn-primary" onClick={() => start(wrong.map((r) => r.q), true)} autoFocus>
                  <RotateCcw size={17} /> Re-test {wrong.length} wrong answer{wrong.length === 1 ? '' : 's'}
                </button>
              )}
              <button className={`btn ${wrong.length ? 'btn-secondary' : 'btn-primary'}`} onClick={() => start(questions, false)}>
                <RefreshCcw size={17} /> Retake full quiz
              </button>
              {onCards && <button className="btn btn-ghost" onClick={onCards}><Layers size={17} /> Flashcards</button>}
            </div>
          </div>
        </div>

        {wrong.length > 0 && (
          <div className="review-list">
            <h3>Review</h3>
            {wrong.map(({ q: wq, chosen: c }) => (
              <div key={wq.id} className="review-item">
                <p className="review-q">{wq.question}</p>
                <p className="review-a is-wrong"><X size={15} /> {wq.options[c]}</p>
                <p className="review-a is-right"><Check size={15} /> {wq.options[wq.answerIndex]}</p>
                {wq.explanation && <p className="review-exp">{wq.explanation}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ----- question -----
  const isCorrect = answered && chosen === q.answerIndex;
  const progressPct = ((index + (answered ? 1 : 0)) / round.items.length) * 100;

  return (
    <div className="quiz">
      <div className="quiz-top">
        <span className="deck-counter">
          Question <strong>{index + 1}</strong> / {round.items.length}
          {round.isRetest && <span className="tag tag-warn">Re-test</span>}
        </span>
        <span className="quiz-score"><Check size={14} /> {results.filter((r) => r.correct).length} correct</span>
      </div>
      <div className="progress progress-thin"><span style={{ width: `${progressPct}%` }} /></div>

      <div className="quiz-card" key={`${round.number}-${q.id}`}>
        <h2 className="quiz-question">{q.question}</h2>

        <div className="options" role="radiogroup" aria-label="Answer options">
          {item.order.map((orig, pos) => {
            const state = !answered
              ? ''
              : orig === q.answerIndex ? 'is-correct' : orig === chosen ? 'is-wrong' : 'is-dim';
            return (
              <button
                key={orig}
                role="radio"
                aria-checked={chosen === orig}
                className={`option ${state}`}
                onClick={() => choose(orig)}
                disabled={answered && state === 'is-dim'}
              >
                <span className="option-key">
                  {answered && orig === q.answerIndex ? <Check size={15} /> : answered && orig === chosen ? <X size={15} /> : LETTERS[pos]}
                </span>
                <span className="option-text">{q.options[orig]}</span>
              </button>
            );
          })}
        </div>

        {answered && (
          <div className={`feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`} role="status">
            <div>
              <strong>{isCorrect ? 'Correct!' : 'Not quite.'}</strong>{' '}
              {q.explanation || (!isCorrect && `The answer is “${q.options[q.answerIndex]}”.`)}
            </div>
            <button className="btn btn-primary btn-sm" onClick={next} autoFocus>
              {index + 1 < round.items.length ? 'Next' : 'See results'} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>

      <p className="kbd-legend hide-sm">
        <kbd>1</kbd>–<kbd>{item.order.length}</kbd> or <kbd>A</kbd>–<kbd>{LETTERS[item.order.length - 1]}</kbd> answer · <kbd>Enter</kbd> next
      </p>
    </div>
  );
}
