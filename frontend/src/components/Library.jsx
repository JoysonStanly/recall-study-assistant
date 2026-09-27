import { useEffect, useRef, useState } from 'react';
import { BookOpen, Plus, Search, Trash2, X } from 'lucide-react';
import DeckTile from './DeckTile.jsx';
import EmptyState from './EmptyState.jsx';

/** Slide-over list of saved sessions (stored in localStorage). */
export default function Library({ open, onClose, sessions, activeId, onOpen, onDelete, onNew }) {
  const [query, setQuery] = useState('');
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    panel.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const list = q ? sessions.filter((s) => s.deck.title.toLowerCase().includes(q) || s.source.toLowerCase().includes(q)) : sessions;

  return (
    <div className={`drawer-root ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Library" ref={panel} tabIndex={-1} inert={!open}>
        <div className="drawer-head">
          <h2><BookOpen size={19} /> Library</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close library"><X size={18} /></button>
        </div>

        {sessions.length > 3 && (
          <label className="search">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search decks" />
          </label>
        )}

        <div className="drawer-list">
          {sessions.length === 0 ? (
            <EmptyState title="No decks yet" text="Decks you generate are saved here automatically, with your progress." />
          ) : list.length === 0 ? (
            <EmptyState title="No matches" text={`Nothing matches “${query}”.`} />
          ) : (
            list.map((s) => (
              <DeckTile key={s.id} session={s} active={s.id === activeId} onOpen={() => onOpen(s.id)}>
                <button className="icon-btn icon-btn-sm deck-tile-delete" onClick={() => onDelete(s.id)} aria-label={`Delete ${s.deck.title}`}>
                  <Trash2 size={15} />
                </button>
              </DeckTile>
            ))
          )}
        </div>

        <div className="drawer-foot">
          <button className="btn btn-primary btn-block" onClick={onNew}><Plus size={17} /> New deck</button>
          <p className="muted small">Saved in this browser only.</p>
        </div>
      </aside>
    </div>
  );
}
