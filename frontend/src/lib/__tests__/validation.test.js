import { describe, expect, it } from 'vitest';
import { parseModelJson } from '../parseJson.js';
import { validateDeck } from '../validateResult.js';
import { previewPartial } from '../partialPreview.js';
import { MOCK_DECK, SIMULATIONS } from '../../../server/simulate.js';

const code = (fn) => {
  try { fn(); } catch (e) { return e.code; }
  return 'NO_ERROR';
};

describe('parseModelJson', () => {
  it('parses plain JSON', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips ```json fences', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('extracts JSON surrounded by prose', () => {
    expect(parseModelJson('Sure! Here you go: {"a":1} Hope that helps.')).toEqual({ a: 1 });
  });
  it('treats empty / whitespace as EMPTY', () => {
    expect(code(() => parseModelJson(''))).toBe('EMPTY');
    expect(code(() => parseModelJson('   \n'))).toBe('EMPTY');
    expect(code(() => parseModelJson(undefined))).toBe('EMPTY');
  });
  it('flags plain-text replies as MALFORMED_JSON', () => {
    expect(code(() => parseModelJson(SIMULATIONS.prose().text))).toBe('MALFORMED_JSON');
  });
  it('flags cut-off JSON as TRUNCATED when the model hit its token limit', () => {
    const { text, finishReason } = SIMULATIONS.malformed();
    expect(code(() => parseModelJson(text, { finishReason }))).toBe('TRUNCATED');
    expect(code(() => parseModelJson(text))).toBe('MALFORMED_JSON');
  });
});

describe('validateDeck', () => {
  it('accepts the canonical shape', () => {
    const { deck, warnings } = validateDeck(MOCK_DECK);
    expect(deck.cards).toHaveLength(MOCK_DECK.cards.length);
    expect(deck.quiz).toHaveLength(MOCK_DECK.quiz.length);
    expect(warnings).toEqual([]);
    expect(deck.cards[0].id).toMatch(/^c_/);
  });

  it('rejects valid JSON with the wrong shape', () => {
    expect(code(() => validateDeck(JSON.parse(SIMULATIONS['wrong-shape']().text)))).toBe('WRONG_SHAPE');
    expect(code(() => validateDeck(null))).toBe('WRONG_SHAPE');
    expect(code(() => validateDeck('cards'))).toBe('WRONG_SHAPE');
    expect(code(() => validateDeck({ cards: 'nope' }))).toBe('WRONG_SHAPE');
  });

  it('rejects the right structure with zero usable items', () => {
    expect(code(() => validateDeck({ cards: [], quiz: [] }))).toBe('NO_USABLE_ITEMS');
    expect(code(() => validateDeck({ cards: [{ front: '' }, 42], quiz: [{ question: 'x' }] }))).toBe('NO_USABLE_ITEMS');
  });

  it('salvages a partially broken deck and explains what was dropped', () => {
    const data = parseModelJson(SIMULATIONS.partial().text);
    const { deck, warnings } = validateDeck(data);
    // card[1] (empty front) and card[5] (string) dropped; card[3] kept via question/answer aliases
    expect(deck.cards).toHaveLength(MOCK_DECK.cards.length - 2);
    expect(deck.cards.some((c) => c.front === 'Legacy key name for front?')).toBe(true);
    // quiz[0] (answerIndex out of range) and quiz[2] (one option) dropped
    expect(deck.quiz).toHaveLength(MOCK_DECK.quiz.length - 2);
    expect(warnings.join(' ')).toMatch(/Skipped 2 cards/);
    expect(warnings.join(' ')).toMatch(/Skipped 2 quiz questions/);
  });

  it('resolves answers given as text, letters or numeric strings', () => {
    const base = { question: 'Q?', options: ['A1', 'B1', 'C1', 'D1'] };
    const pick = (extra) => validateDeck({ quiz: [{ ...base, ...extra, question: JSON.stringify(extra) }] }).deck.quiz[0].answerIndex;
    expect(pick({ answerIndex: 2 })).toBe(2);
    expect(pick({ answerIndex: '3' })).toBe(3);
    expect(pick({ answer: 'B' })).toBe(1);
    expect(pick({ correctAnswer: 'c1' })).toBe(2);
  });

  it('keeps answerIndex pointing at the right option after removing duplicates', () => {
    const { deck } = validateDeck({ quiz: [{ question: 'Q', options: ['x', 'x', 'y', 'z'], answerIndex: 3, explanation: '' }] });
    expect(deck.quiz[0].options).toEqual(['x', 'y', 'z']);
    expect(deck.quiz[0].options[deck.quiz[0].answerIndex]).toBe('z');
  });

  it('dedupes cards, trims whitespace and caps lengths', () => {
    const long = 'a'.repeat(5000);
    const { deck, warnings } = validateDeck({
      cards: [{ front: '  Hello   world ', back: 'x' }, { front: 'hello world', back: 'dup' }, { front: 'Long', back: long }],
    });
    expect(deck.cards.map((c) => c.front)).toEqual(['Hello world', 'Long']);
    expect(deck.cards[1].back.length).toBeLessThan(1000);
    expect(warnings.join(' ')).toMatch(/Skipped 1 card /);
  });

  it('accepts a bare array of cards', () => {
    const { deck } = validateDeck([{ question: 'Q', answer: 'A' }]);
    expect(deck.cards[0]).toMatchObject({ front: 'Q', back: 'A' });
    expect(deck.title).toBeTruthy();
  });

  it('gives an unchanged card the same id (progress survives refinement)', () => {
    const a = validateDeck({ cards: [{ front: 'Same', back: 'one' }] }).deck.cards[0].id;
    const b = validateDeck({ cards: [{ front: 'Same', back: 'edited' }] }).deck.cards[0].id;
    expect(a).toBe(b);
  });
});

describe('previewPartial', () => {
  it('reads the title and completed card fronts from half-streamed JSON', () => {
    const full = JSON.stringify(MOCK_DECK);
    const half = full.slice(0, Math.floor(full.length * 0.4));
    const p = previewPartial(half);
    expect(p.title).toBe(MOCK_DECK.title);
    expect(p.fronts.length).toBeGreaterThan(0);
    expect(p.fronts[0]).toBe(MOCK_DECK.cards[0].front);
  });
  it('never throws on garbage', () => {
    expect(previewPartial('{"title": "unterminated')).toMatchObject({ fronts: [] });
    expect(previewPartial('')).toMatchObject({ title: '' });
  });
});
