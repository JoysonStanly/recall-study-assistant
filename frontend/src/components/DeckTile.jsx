import { Layers, ListChecks } from 'lucide-react';
import ProgressRing from './ProgressRing.jsx';
import { masteryOf } from '../hooks/useSessions.js';

export default function DeckTile({ session, onOpen, active, children }) {
  const mastery = masteryOf(session);
  return (
    <div className={`deck-tile ${active ? 'is-active' : ''}`}>
      <button className="deck-tile-main" onClick={onOpen}>
        <ProgressRing value={mastery} size={44} stroke={4}>
          <span className="ring-label">{mastery}%</span>
        </ProgressRing>
        <span className="deck-tile-text">
          <span className="deck-tile-title">{session.deck.title}</span>
          <span className="deck-tile-meta">
            <span><Layers size={13} /> {session.deck.cards.length}</span>
            <span><ListChecks size={13} /> {session.deck.quiz.length}</span>
            <span>{timeAgo(session.updatedAt)}</span>
          </span>
        </span>
      </button>
      {children}
    </div>
  );
}

export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
