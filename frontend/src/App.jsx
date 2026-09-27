import { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import Home from './components/Home.jsx';
import GeneratingState from './components/GeneratingState.jsx';
import ErrorState from './components/ErrorState.jsx';
import StudyView from './components/StudyView.jsx';
import Library from './components/Library.jsx';
import Toast from './components/Toast.jsx';
import { useDeckGenerator } from './hooks/useDeckGenerator.js';
import { useSessions, emptyProgress, newSessionId } from './hooks/useSessions.js';
import { useTheme } from './hooks/useTheme.js';
import { useToast } from './hooks/useToast.js';

export default function App() {
  const { theme, cycle: cycleTheme } = useTheme();
  const { sessions, upsert, update, remove } = useSessions();
  const gen = useDeckGenerator();
  const { toast, showToast, hideToast } = useToast();

  const [view, setView] = useState('home'); // 'home' | 'study'
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState({ input: '', cardCount: 10, difficulty: 'mixed' });
  const [simulate, setSimulate] = useState(''); // '' = real model; otherwise a Failure-lab mode
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [warnings, setWarnings] = useState({ sessionId: null, list: [] });
  const [health, setHealth] = useState(null);
  const lastRequest = useRef(null); // what "Retry" re-runs

  const active = sessions.find((s) => s.id === activeId) || null;

  useEffect(() => {
    let alive = true;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((h) => alive && setHealth(h))
      .catch(() => alive && setHealth({ ok: false }));
    return () => { alive = false; };
  }, []);

  // ---------- AI requests ----------

  const runCreate = useCallback(async (payload) => {
    lastRequest.current = { kind: 'create', payload };
    const res = await gen.generate(payload);
    if (!res) return; // failed, cancelled or superseded — gen state already says which
    const session = {
      id: newSessionId(),
      createdAt: Date.now(),
      source: payload.input,
      settings: { cardCount: payload.cardCount, difficulty: payload.difficulty },
      model: res.model,
      deck: res.deck,
      history: [],
      progress: emptyProgress(),
    };
    upsert(session);
    setActiveId(session.id);
    setWarnings({ sessionId: session.id, list: res.warnings });
    setView('study');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [gen, upsert]);

  const runRefine = useCallback(async (session, instruction, simulateMode) => {
    const payload = {
      mode: 'refine',
      instruction,
      previous: stripIds(session.deck),
      cardCount: session.settings.cardCount,
      difficulty: session.settings.difficulty,
      simulate: simulateMode || undefined,
    };
    lastRequest.current = { kind: 'refine', sessionId: session.id, instruction, simulate: simulateMode };
    const res = await gen.generate(payload);
    if (!res) return false;

    const oldIds = new Set([...session.deck.cards, ...session.deck.quiz].map((x) => x.id));
    const changed = [...res.deck.cards, ...res.deck.quiz].filter((x) => !oldIds.has(x.id)).length;
    update(session.id, (cur) => ({
      ...cur,
      deck: res.deck,
      model: res.model,
      history: [...cur.history, cur.deck].slice(-5),
      progress: keepProgressFor(cur.progress, res.deck),
    }));
    setWarnings({ sessionId: session.id, list: res.warnings });
    showToast(changed ? `Deck updated — ${changed} new or edited item${changed === 1 ? '' : 's'}` : 'Deck updated — no items changed', {
      action: { label: 'Undo', onClick: () => undoRefine(session.id) },
    });
    return true;
  }, [gen, update, showToast]);

  const handleGenerate = () => runCreate({
    mode: 'create',
    input: draft.input.trim(),
    cardCount: draft.cardCount,
    difficulty: draft.difficulty,
    simulate: simulate || undefined,
  });

  const handleRetry = () => {
    const last = lastRequest.current;
    if (!last) return;
    if (last.kind === 'create') runCreate(last.payload);
    else {
      const s = sessions.find((x) => x.id === last.sessionId);
      if (s) runRefine(s, last.instruction, last.simulate);
    }
  };

  const handleDemo = () => runCreate({ mode: 'create', input: draft.input.trim() || 'Photosynthesis', cardCount: draft.cardCount, difficulty: draft.difficulty, simulate: 'mock' });

  // ---------- session actions ----------

  function openSession(id) {
    gen.cancel();
    setActiveId(id);
    setView('study');
    setLibraryOpen(false);
    window.scrollTo({ top: 0 });
  }

  function goHome() {
    gen.cancel();
    setView('home');
    setLibraryOpen(false);
  }

  function editSource() {
    gen.reset();
    setView('home');
  }

  function undoRefine(id) {
    update(id, (cur) => {
      if (!cur.history.length) return cur;
      const prev = cur.history[cur.history.length - 1];
      return { ...cur, deck: prev, history: cur.history.slice(0, -1), progress: keepProgressFor(cur.progress, prev) };
    });
    showToast('Restored the previous version');
  }

  function deleteSession(id) {
    const s = sessions.find((x) => x.id === id);
    remove(id);
    if (id === activeId) { setActiveId(null); setView('home'); }
    if (s) showToast(`Deleted “${s.deck.title}”`, { action: { label: 'Undo', onClick: () => upsert(s) } });
  }

  const setProgress = (fn) => active && update(active.id, (cur) => ({ ...cur, progress: fn(cur.progress) }));

  // ---------- render ----------

  const createLoading = gen.status === 'loading' && gen.kind === 'create';
  const createError = gen.status === 'error' && gen.kind === 'create';

  let main;
  if (createLoading) {
    main = <GeneratingState streamText={gen.streamText} attempt={gen.attempt} cardCount={lastRequest.current?.payload?.cardCount} onCancel={gen.cancel} />;
  } else if (createError) {
    main = (
      <ErrorState
        error={gen.error}
        onRetry={handleRetry}
        onEdit={editSource}
        onDemo={gen.error.code === 'MISSING_KEY' || gen.error.code === 'AUTH' ? handleDemo : undefined}
      />
    );
  } else if (view === 'study' && active) {
    main = (
      <StudyView
        key={active.id}
        session={active}
        warnings={warnings.sessionId === active.id ? warnings.list : []}
        onDismissWarnings={() => setWarnings({ sessionId: null, list: [] })}
        setProgress={setProgress}
        refine={{
          status: gen.kind === 'refine' ? gen.status : 'idle',
          error: gen.kind === 'refine' ? gen.error : null,
          streamText: gen.kind === 'refine' ? gen.streamText : '',
          attempt: gen.attempt,
          run: (instruction) => runRefine(active, instruction, simulate),
          retry: handleRetry,
          cancel: gen.cancel,
          dismiss: gen.reset,
          canUndo: active.history.length > 0,
          undo: () => undoRefine(active.id),
        }}
        onNew={goHome}
        onDelete={() => deleteSession(active.id)}
      />
    );
  } else {
    main = (
      <Home
        draft={draft}
        setDraft={setDraft}
        onGenerate={handleGenerate}
        simulate={simulate}
        setSimulate={setSimulate}
        health={health}
        sessions={sessions}
        onOpen={openSession}
        onShowLibrary={() => setLibraryOpen(true)}
      />
    );
  }

  return (
    <div className="app">
      <Header
        onHome={goHome}
        onLibrary={() => setLibraryOpen(true)}
        libraryCount={sessions.length}
        theme={theme}
        onTheme={cycleTheme}
        simulate={simulate}
        onClearSimulate={() => setSimulate('')}
      />
      <main className="main" id="main">{main}</main>
      <Library
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        sessions={sessions}
        activeId={view === 'study' ? activeId : null}
        onOpen={openSession}
        onDelete={deleteSession}
        onNew={goHome}
      />
      <Toast toast={toast} onClose={hideToast} />
    </div>
  );
}

/** Send the model only the content, not our internal ids. */
function stripIds(deck) {
  return {
    title: deck.title,
    summary: deck.summary,
    cards: deck.cards.map(({ front, back, hint, tag }) => ({ front, back, hint, tag })),
    quiz: deck.quiz.map(({ question, options, answerIndex, explanation }) => ({ question, options, answerIndex, explanation })),
  };
}

/** After a refine, keep progress only for cards that still exist (ids are content hashes). */
function keepProgressFor(progress, deck) {
  const ids = new Set(deck.cards.map((c) => c.id));
  const pick = (obj) => Object.fromEntries(Object.entries(obj).filter(([id]) => ids.has(id)));
  return { ...progress, known: pick(progress.known), learning: pick(progress.learning) };
}
