import { useEffect, useState } from 'react';
import { Check, RotateCw, X } from 'lucide-react';
import { previewPartial } from '../lib/partialPreview.js';

/** Full-screen loading state for a new deck, with live progress from the stream. */
export default function GeneratingState({ streamText, attempt, cardCount, onCancel }) {
  const elapsed = useElapsed();
  const { title, fronts, quizCount } = previewPartial(streamText);
  const receiving = streamText.length > 0;
  const total = cardCount || 10;
  const done = Math.min(fronts.length + quizCount, total * 2);
  const pct = receiving ? Math.max(6, Math.round((done / (total * 2)) * 100)) : 4;

  const phase = !receiving
    ? elapsed < 3 ? 'Reading your notes…' : 'Thinking about what matters most…'
    : fronts.length < total && quizCount === 0
      ? `Writing card ${Math.min(fronts.length + 1, total)} of ${total}…`
      : `Writing quiz question ${Math.min(quizCount + 1, total)}…`;

  return (
    <div className="generating" aria-busy="true">
      <div className="shuffle-stack" aria-hidden="true">
        <span /><span /><span />
      </div>

      <div className="generating-copy" role="status" aria-live="polite">
        <p className="eyebrow">{title ? 'Building your deck' : 'Generating'}</p>
        <h2 className="generating-title">{title || 'Crafting your study deck'}</h2>
        <p className="generating-phase">{phase}</p>
      </div>

      <div className="progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>

      {attempt > 1 && (
        <p className="generating-retry">
          <RotateCw size={14} /> The first answer came back malformed — retrying automatically.
        </p>
      )}

      {fronts.length > 0 && (
        <ul className="stream-list">
          {fronts.slice(-5).map((f, i) => (
            <li key={`${f}-${i}`} className="stream-item">
              <Check size={14} /> <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="generating-foot">
        <span className="muted">
          {elapsed}s{elapsed >= 15 && ' · taking longer than usual'}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          <X size={15} /> Cancel
        </button>
      </div>
    </div>
  );
}

export function useElapsed() {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return Math.floor((now - start) / 1000);
}
