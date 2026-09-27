import { useState } from 'react';
import { Info, Layers, ListChecks, Plus, Trash2, X } from 'lucide-react';
import FlashcardDeck from './FlashcardDeck.jsx';
import Quiz from './Quiz.jsx';
import RefineBar from './RefineBar.jsx';
import EmptyState from './EmptyState.jsx';
import { masteryOf } from '../hooks/useSessions.js';

/** Routes a validated deck to the right interactive view. */
export default function StudyView({ session, warnings, onDismissWarnings, setProgress, refine, onNew, onDelete }) {
  const { deck, progress } = session;
  const [tab, setTab] = useState(deck.cards.length ? 'cards' : 'quiz');
  const mastery = masteryOf(session);
  const refining = refine.status === 'loading';

  const markCard = (id, status) =>
    setProgress((p) => {
      const known = { ...p.known };
      const learning = { ...p.learning };
      delete known[id];
      delete learning[id];
      if (status === 'known') known[id] = true;
      if (status === 'learning') learning[id] = true;
      return { ...p, known, learning };
    });

  const resetCards = () => setProgress((p) => ({ ...p, known: {}, learning: {} }));

  const recordQuiz = ({ correct, total, isRetest }) =>
    setProgress((p) => {
      if (isRetest) return p;
      const score = Math.round((correct / total) * 100);
      return { ...p, quizLast: score, quizBest: Math.max(score, p.quizBest ?? 0) };
    });

  return (
    <div className={`study ${refining ? 'is-refining' : ''}`}>
      <section className="study-head">
        <div className="study-head-text">
          <p className="eyebrow">
            {session.settings.difficulty} · {mastery}% mastered
            {session.model?.startsWith('simulated') && <span className="tag tag-sim">demo data</span>}
          </p>
          <h1 className="study-title">{deck.title}</h1>
          {deck.summary && <p className="study-summary">{deck.summary}</p>}
        </div>
        <div className="study-head-actions">
          <button className="btn btn-secondary btn-sm" onClick={onNew} aria-label="New deck"><Plus size={16} /> <span>New deck</span></button>
          <button className="icon-btn" onClick={onDelete} aria-label="Delete this deck" title="Delete deck"><Trash2 size={17} /></button>
        </div>
      </section>

      {warnings.length > 0 && (
        <div className="notice notice-warn notice-compact">
          <Info size={17} />
          <div>
            <strong>Some of the AI's output was unusable, so it was left out.</strong>
            <ul>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
          <button className="icon-btn icon-btn-sm" onClick={onDismissWarnings} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      <RefineBar {...refine} />

      <div className="tabs" role="tablist" aria-label="Study mode">
        <button role="tab" aria-selected={tab === 'cards'} className={`tab ${tab === 'cards' ? 'is-active' : ''}`} onClick={() => setTab('cards')}>
          <Layers size={16} /> Flashcards <span className="tab-count">{deck.cards.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'quiz'} className={`tab ${tab === 'quiz' ? 'is-active' : ''}`} onClick={() => setTab('quiz')}>
          <ListChecks size={16} /> Quiz <span className="tab-count">{deck.quiz.length}</span>
          {progress.quizBest != null && <span className="tab-best">best {progress.quizBest}%</span>}
        </button>
      </div>

      <div className="study-body" role="tabpanel">
        {tab === 'cards' ? (
          deck.cards.length ? (
            <FlashcardDeck
              key={deck.cards.map((c) => c.id).join()}
              cards={deck.cards}
              progress={progress}
              onMark={markCard}
              onReset={resetCards}
              onQuiz={deck.quiz.length ? () => setTab('quiz') : null}
              disabled={refining}
            />
          ) : (
            <EmptyState title="No flashcards in this deck" text="The AI only returned quiz questions. Ask it to add some cards using Refine above." />
          )
        ) : deck.quiz.length ? (
          <Quiz key={deck.quiz.map((q) => q.id).join()} questions={deck.quiz} onRoundComplete={recordQuiz} onCards={deck.cards.length ? () => setTab('cards') : null} disabled={refining} />
        ) : (
          <EmptyState title="No quiz in this deck" text="The AI only returned flashcards. Ask it to “add a quiz” using Refine above." />
        )}
      </div>
    </div>
  );
}
