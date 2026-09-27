import { useCallback, useEffect, useState } from 'react';
import { readJson, writeJson } from '../lib/storage.js';
import { validateDeck } from '../lib/validateResult.js';

const KEY = 'recall.sessions.v1';
const MAX_SESSIONS = 30;

export const emptyProgress = () => ({ known: {}, learning: {}, quizBest: null, quizLast: null });

/**
 * Saved study sessions (deck + progress) in localStorage.
 * Saved decks go back through validateDeck on load — storage is just another
 * untrusted input (it could be edited, corrupted or from an older version).
 */
export function useSessions() {
  const [sessions, setSessions] = useState(loadSessions);

  useEffect(() => { writeJson(KEY, sessions); }, [sessions]);

  const upsert = useCallback((session) => {
    setSessions((list) => {
      const rest = list.filter((s) => s.id !== session.id);
      return [{ ...session, updatedAt: Date.now() }, ...rest].slice(0, MAX_SESSIONS);
    });
  }, []);

  const update = useCallback((id, fn) => {
    setSessions((list) => list.map((s) => (s.id === id ? { ...fn(s), updatedAt: Date.now() } : s)));
  }, []);

  const remove = useCallback((id) => setSessions((list) => list.filter((s) => s.id !== id)), []);

  return { sessions, upsert, update, remove };
}

function loadSessions() {
  const raw = readJson(KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s) => {
    try {
      if (!s || typeof s.id !== 'string') return [];
      const { deck } = validateDeck(s.deck);
      return [{
        id: s.id,
        createdAt: Number(s.createdAt) || Date.now(),
        updatedAt: Number(s.updatedAt) || Date.now(),
        source: typeof s.source === 'string' ? s.source : '',
        settings: { cardCount: s.settings?.cardCount || 10, difficulty: s.settings?.difficulty || 'mixed' },
        model: s.model || null,
        deck,
        history: Array.isArray(s.history) ? s.history.slice(-5) : [],
        progress: { ...emptyProgress(), ...(s.progress || {}) },
      }];
    } catch {
      return []; // drop sessions that no longer validate
    }
  });
}

export function newSessionId() {
  return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function masteryOf(session) {
  const total = session.deck.cards.length;
  if (!total) return 0;
  const known = session.deck.cards.filter((c) => session.progress.known[c.id]).length;
  return Math.round((known / total) * 100);
}
