import { AlertTriangle, ArrowRight, KeyRound } from 'lucide-react';
import PromptInput from './PromptInput.jsx';
import FailureLab from './FailureLab.jsx';
import DeckTile from './DeckTile.jsx';

export default function Home({ draft, setDraft, onGenerate, simulate, setSimulate, health, sessions, onOpen, onShowLibrary }) {
  const recent = sessions.slice(0, 4);

  return (
    <div className="home">
      <section className="hero">
        <span className="eyebrow">AI study assistant</span>
        <h1 className="hero-title">
          Turn your notes into <em>flashcards</em> &amp; quizzes.
        </h1>
        <p className="hero-sub">
          Paste anything you need to learn. Recall writes the cards, quizzes you, and keeps drilling the ones you miss.
        </p>
      </section>

      <HealthNotice health={health} simulate={simulate} onDemo={() => setSimulate('mock')} />

      <PromptInput draft={draft} setDraft={setDraft} onGenerate={onGenerate} />

      <FailureLab value={simulate} onChange={setSimulate} disabled={health?.ok && health.simulate === false} />

      {recent.length > 0 ? (
        <section className="recent">
          <div className="section-head">
            <h2>Continue studying</h2>
            {sessions.length > recent.length && (
              <button className="link-btn" onClick={onShowLibrary}>
                All {sessions.length} decks <ArrowRight size={15} />
              </button>
            )}
          </div>
          <div className="deck-grid">
            {recent.map((s) => <DeckTile key={s.id} session={s} onOpen={() => onOpen(s.id)} />)}
          </div>
        </section>
      ) : (
        <section className="how">
          {[
            ['1', 'Paste', 'Notes, a chapter, or just a topic name.'],
            ['2', 'Flip', 'Swipe through cards. Mark what you know.'],
            ['3', 'Quiz', 'Test yourself, then re-test only what you missed.'],
          ].map(([n, t, d]) => (
            <div className="how-step" key={n}>
              <span className="how-num">{n}</span>
              <div>
                <strong>{t}</strong>
                <p>{d}</p>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function HealthNotice({ health, simulate, onDemo }) {
  if (!health || simulate) return null;
  if (!health.ok) {
    return (
      <div className="notice notice-bad" role="alert">
        <AlertTriangle size={18} />
        <div>
          <strong>Can't reach the Recall API server.</strong> Start it with <code>npm start</code> and refresh.
        </div>
      </div>
    );
  }
  if (!health.hasKey) {
    return (
      <div className="notice notice-warn">
        <KeyRound size={18} />
        <div>
          <strong>No Gemini API key on the server.</strong> Add <code>GEMINI_API_KEY</code> to <code>.env</code>, or explore with demo data.
        </div>
        <button className="btn btn-sm btn-secondary" onClick={onDemo}>Use demo deck</button>
      </div>
    );
  }
  return null;
}
