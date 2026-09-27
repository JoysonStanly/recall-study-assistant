import { AppError } from './errors.js';

/**
 * The contract the UI renders. Everything from the model goes through
 * validateDeck() first — components never see raw model output.
 *
 * Deck = {
 *   title: string, summary: string,
 *   cards: [{ id, front, back, hint, tag }],
 *   quiz:  [{ id, question, options: string[], answerIndex, explanation }]
 * }
 *
 * Strategy: be strict about what reaches the UI, lenient about how we get there.
 *  - Unknown top-level shape            → WRONG_SHAPE (error state)
 *  - Some items broken                   → drop them, keep the rest, add a warning
 *  - Every item broken                   → NO_USABLE_ITEMS (error state)
 *  - Common aliases (question/answer…)   → accepted and normalised
 */

export const LIMITS = { maxCards: 30, maxQuiz: 30, front: 300, back: 900, option: 200, explanation: 600 };

export function validateDeck(data) {
  if (Array.isArray(data)) data = { cards: data }; // a bare array of cards is a common slip
  if (!data || typeof data !== 'object') {
    throw new AppError('WRONG_SHAPE', `Expected a JSON object with "cards" and "quiz", got ${describe(data)}.`, { raw: safeStringify(data) });
  }

  const rawCards = pickArray(data, ['cards', 'flashcards', 'flashCards', 'deck']);
  const rawQuiz = pickArray(data, ['quiz', 'questions', 'quizQuestions', 'mcqs']);

  if (rawCards === null && rawQuiz === null) {
    const keys = Object.keys(data).slice(0, 6).join(', ') || 'none';
    throw new AppError('WRONG_SHAPE', `The response had no "cards" or "quiz" list (keys found: ${keys}).`, { raw: safeStringify(data) });
  }

  const warnings = [];

  const cards = dedupe(
    (rawCards || []).map(normaliseCard).filter(Boolean),
    (c) => c.front.toLowerCase(),
  ).slice(0, LIMITS.maxCards);
  const droppedCards = (rawCards?.length || 0) - cards.length;
  if (droppedCards > 0) warnings.push(`Skipped ${droppedCards} card${s(droppedCards)} that ${droppedCards === 1 ? 'was' : 'were'} incomplete or duplicated.`);

  const quiz = dedupe(
    (rawQuiz || []).map(normaliseQuestion).filter(Boolean),
    (q) => q.question.toLowerCase(),
  ).slice(0, LIMITS.maxQuiz);
  const droppedQuiz = (rawQuiz?.length || 0) - quiz.length;
  if (droppedQuiz > 0) warnings.push(`Skipped ${droppedQuiz} quiz question${s(droppedQuiz)} with missing options or an invalid answer.`);

  if (cards.length === 0 && quiz.length === 0) {
    throw new AppError('NO_USABLE_ITEMS', 'The response had the right structure, but none of its cards or questions were usable.', { raw: safeStringify(data) });
  }
  if (cards.length === 0) warnings.push('No flashcards came back — quiz only.');
  if (quiz.length === 0) warnings.push('No quiz questions came back — flashcards only.');

  const title = clean(data.title, 80) || deriveTitle(cards, quiz);
  const summary = clean(data.summary ?? data.description, 240);

  return { deck: { title, summary, cards, quiz }, warnings };
}

// ---------- items ----------

function normaliseCard(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const front = clean(first(item, ['front', 'question', 'term', 'q', 'prompt']), LIMITS.front);
  const back = clean(first(item, ['back', 'answer', 'definition', 'a', 'explanation']), LIMITS.back);
  if (!front || !back) return null;
  const hint = clean(item.hint, 200);
  return {
    id: 'c_' + hash(front),
    front,
    back,
    hint: hint && hint.toLowerCase() !== back.toLowerCase() ? hint : '',
    tag: clean(first(item, ['tag', 'topic', 'category']), 30),
  };
}

function normaliseQuestion(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const question = clean(first(item, ['question', 'prompt', 'q', 'text']), LIMITS.front);
  const rawOptions = first(item, ['options', 'choices', 'answers']);
  if (!question || !Array.isArray(rawOptions)) return null;

  const allOptions = rawOptions.map((o) => clean(typeof o === 'object' && o ? o.text ?? o.label : o, LIMITS.option));
  const correctIdxInRaw = resolveAnswerIndex(item, allOptions);
  if (correctIdxInRaw === -1) return null;
  const correctText = allOptions[correctIdxInRaw];

  // Drop empty + duplicate options, then find the correct answer again by text.
  const options = dedupe(allOptions.filter(Boolean), (o) => o.toLowerCase()).slice(0, 6);
  const answerIndex = options.findIndex((o) => o === correctText);
  if (options.length < 2 || answerIndex === -1) return null;

  return {
    id: 'q_' + hash(question),
    question,
    options,
    answerIndex,
    explanation: clean(first(item, ['explanation', 'why', 'rationale']), LIMITS.explanation),
  };
}

/** Accepts answerIndex (number or numeric string), a letter ("B"), or the answer text. */
function resolveAnswerIndex(item, options) {
  const idx = first(item, ['answerIndex', 'correctIndex', 'correctOptionIndex', 'correct']);
  const n = typeof idx === 'string' && /^\d+$/.test(idx.trim()) ? Number(idx) : idx;
  if (Number.isInteger(n)) return n >= 0 && n < options.length && options[n] ? n : -1;

  const ans = clean(first(item, ['answer', 'correctAnswer', 'correct_answer']), LIMITS.option);
  if (!ans) return -1;
  if (/^[A-F]$/i.test(ans)) {
    const i = ans.toUpperCase().charCodeAt(0) - 65;
    return i < options.length && options[i] ? i : -1;
  }
  return options.findIndex((o) => o && o.toLowerCase() === ans.toLowerCase());
}

// ---------- helpers ----------

function pickArray(obj, keys) {
  for (const k of keys) if (Array.isArray(obj[k])) return obj[k];
  return null;
}

function first(obj, keys) {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}

function clean(v, max) {
  if (typeof v === 'number' || typeof v === 'boolean') v = String(v);
  if (typeof v !== 'string') return '';
  const t = v.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function dedupe(list, keyFn) {
  const seen = new Set();
  return list.filter((x) => {
    const k = keyFn(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function deriveTitle(cards, quiz) {
  const tag = cards.find((c) => c.tag)?.tag;
  return tag ? `${tag} study deck` : quiz.length && !cards.length ? 'Quiz' : 'Study deck';
}

/** Small stable string hash → ids that survive a refine when a card is unchanged. */
export function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const s = (n) => (n === 1 ? '' : 's');
const describe = (v) => (v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v);
function safeStringify(v) {
  try { return JSON.stringify(v, null, 2)?.slice(0, 4000) ?? String(v); } catch { return String(v); }
}
