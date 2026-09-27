// Builds the prompt + JSON schema we send to Gemini.
//
// The shape below is the contract between the model and the UI. The server asks for it
// (prompt + responseSchema), but the client still validates everything it gets back —
// JSON mode makes bad output rarer, not impossible.

export const DECK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Short deck title, max 60 chars' },
    summary: { type: 'STRING', description: 'One sentence describing what the deck covers' },
    cards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          front: { type: 'STRING', description: 'Question or term on the front of the card' },
          back: { type: 'STRING', description: 'Concise answer, 1-3 sentences' },
          hint: { type: 'STRING', description: 'Optional nudge that does not give the answer away' },
          tag: { type: 'STRING', description: 'One or two word sub-topic label' },
        },
        required: ['front', 'back'],
        propertyOrdering: ['front', 'back', 'hint', 'tag'],
      },
    },
    quiz: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          answerIndex: { type: 'INTEGER', description: 'Zero-based index into options' },
          explanation: { type: 'STRING', description: 'Why the correct option is right, 1-2 sentences' },
        },
        required: ['question', 'options', 'answerIndex', 'explanation'],
        propertyOrdering: ['question', 'options', 'answerIndex', 'explanation'],
      },
    },
  },
  required: ['title', 'cards', 'quiz'],
  propertyOrdering: ['title', 'summary', 'cards', 'quiz'],
};

const SHAPE_TEXT = `{
  "title": string,
  "summary": string,
  "cards": [{ "front": string, "back": string, "hint": string, "tag": string }],
  "quiz": [{ "question": string, "options": [string, string, string, string], "answerIndex": number, "explanation": string }]
}`;

const DIFFICULTY = {
  easy: 'Keep it introductory: definitions and core facts a beginner should know.',
  mixed: 'Mix recall of core facts with a few questions that test understanding.',
  hard: 'Focus on deeper understanding, edge cases, comparisons and application — not trivia.',
};

export function buildCreatePrompt({ input, cardCount, difficulty }) {
  return `You are an expert tutor who writes excellent study material.
Create a study deck from the SOURCE below.

Rules:
- Return ONLY valid JSON matching this exact shape — no markdown, no code fences, no prose:
${SHAPE_TEXT}
- Exactly ${cardCount} cards and exactly ${cardCount} quiz questions.
- ${DIFFICULTY[difficulty] || DIFFICULTY.mixed}
- Every quiz question has exactly 4 distinct options with one correct answer; answerIndex is its 0-based index.
- Vary the position of the correct answer. Wrong options must be plausible.
- Card fronts are short questions or terms; backs are 1-3 sentences.
- Hints must not reveal the answer. Tags are 1-2 words.
- Stick to the SOURCE. If the source is just a topic name, use well-established facts about it.
- If the SOURCE is not something that can be studied, still return the shape with a best-effort deck about the literal text.

SOURCE:
"""
${input}
"""`;
}

export function buildRefinePrompt({ previous, instruction, cardCount, difficulty }) {
  return `You are an expert tutor editing an existing study deck.
Apply the INSTRUCTION to the CURRENT DECK and return the full updated deck.

Rules:
- Return ONLY valid JSON matching this exact shape — no markdown, no code fences, no prose:
${SHAPE_TEXT}
- Keep cards and questions that the instruction does not ask you to change, word-for-word.
- Unless the instruction says otherwise, keep roughly ${cardCount} cards and questions. Target difficulty: ${difficulty}.
- Every quiz question has exactly 4 distinct options; answerIndex is the 0-based index of the correct one.

CURRENT DECK:
${JSON.stringify(previous)}

INSTRUCTION:
"""
${instruction}
"""`;
}
