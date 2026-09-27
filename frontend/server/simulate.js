// "Failure lab": fake model responses so every failure path can be demoed
// without waiting for a real model to misbehave. Each mode returns the raw text
// the model *would* have produced, plus how it should be delivered.

export const MOCK_DECK = {
  title: 'Photosynthesis Essentials',
  summary: 'How plants turn light, water and CO₂ into sugar and oxygen.',
  cards: [
    { front: 'What is photosynthesis?', back: 'The process by which plants, algae and some bacteria convert light energy into chemical energy stored in glucose.', hint: 'Photo = light, synthesis = making', tag: 'Basics' },
    { front: 'Where does photosynthesis happen in a plant cell?', back: 'In the chloroplasts, mainly in the leaf’s mesophyll cells.', hint: 'A green organelle', tag: 'Structure' },
    { front: 'What pigment absorbs light for photosynthesis?', back: 'Chlorophyll — it absorbs mostly red and blue light and reflects green.', hint: 'It’s why leaves look green', tag: 'Pigments' },
    { front: 'Overall equation of photosynthesis', back: '6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂', hint: 'Six of almost everything', tag: 'Chemistry' },
    { front: 'What happens in the light-dependent reactions?', back: 'In the thylakoid membranes, light splits water, releasing O₂ and producing ATP and NADPH.', hint: 'Think thylakoids', tag: 'Light reactions' },
    { front: 'What is the Calvin cycle?', back: 'The light-independent reactions in the stroma that use ATP and NADPH to fix CO₂ into sugar.', hint: 'Happens in the stroma', tag: 'Calvin cycle' },
    { front: 'What enzyme fixes CO₂ in the Calvin cycle?', back: 'RuBisCO — arguably the most abundant protein on Earth.', hint: 'Starts with “Ru”', tag: 'Calvin cycle' },
    { front: 'Where does the oxygen released by plants come from?', back: 'From splitting water molecules (photolysis), not from CO₂.', hint: 'Not carbon dioxide', tag: 'Light reactions' },
  ],
  quiz: [
    { question: 'Which organelle is the site of photosynthesis?', options: ['Mitochondrion', 'Chloroplast', 'Ribosome', 'Nucleus'], answerIndex: 1, explanation: 'Chloroplasts contain chlorophyll and the machinery for both stages of photosynthesis.' },
    { question: 'What is the source of the O₂ released during photosynthesis?', options: ['Carbon dioxide', 'Glucose', 'Water', 'Chlorophyll'], answerIndex: 2, explanation: 'Photolysis splits water in the light-dependent reactions, releasing oxygen.' },
    { question: 'Which products of the light reactions power the Calvin cycle?', options: ['ATP and NADPH', 'Glucose and O₂', 'CO₂ and H₂O', 'ADP and NADP⁺'], answerIndex: 0, explanation: 'ATP supplies energy and NADPH supplies reducing power for carbon fixation.' },
    { question: 'Why do most leaves appear green?', options: ['They absorb green light', 'Chlorophyll reflects green light', 'They contain green sugar', 'Stomata are green'], answerIndex: 1, explanation: 'Chlorophyll absorbs red and blue wavelengths and reflects green.' },
    { question: 'Where does the Calvin cycle take place?', options: ['Thylakoid membrane', 'Cytoplasm', 'Cell wall', 'Stroma'], answerIndex: 3, explanation: 'The Calvin cycle runs in the stroma, the fluid surrounding the thylakoids.' },
    { question: 'What does RuBisCO do?', options: ['Splits water', 'Fixes CO₂ onto RuBP', 'Absorbs light', 'Makes ATP'], answerIndex: 1, explanation: 'RuBisCO catalyses the first step of carbon fixation in the Calvin cycle.' },
  ],
};

const pretty = (v) => JSON.stringify(v, null, 2);

export const SIMULATIONS = {
  // A valid deck streamed at a normal pace — the "happy path" without an API key.
  mock: () => ({ text: pretty(MOCK_DECK), chunkDelay: 25 }),
  // Same valid deck, but streamed very slowly (~10s). Submit again while it runs
  // to see the stale-response guard in action.
  slow: () => ({ text: pretty(MOCK_DECK), chunkDelay: 160 }),
  // Cut off mid-object, like a response that hit the token limit.
  malformed: () => {
    const full = pretty(MOCK_DECK);
    return { text: full.slice(0, Math.floor(full.length * 0.55)), chunkDelay: 15, finishReason: 'MAX_TOKENS' };
  },
  // Valid JSON, wrong contract.
  'wrong-shape': () => ({
    text: pretty({ deck: 'Photosynthesis', items: ['chlorophyll', 'stroma', 'thylakoid'], count: 3 }),
    chunkDelay: 20,
  }),
  // Some items are broken — the validator should keep the good ones and warn.
  partial: () => {
    const d = structuredClone(MOCK_DECK);
    d.cards[1] = { front: '', back: 'Orphan answer with no question' };
    d.cards[3] = { question: 'Legacy key name for front?', answer: 'Aliases like question/answer are accepted.' };
    d.cards[5] = 'just a string, not a card';
    d.quiz[0].answerIndex = 9; // out of range → dropped
    d.quiz[2].options = ['Only one option'];
    return { text: '```json\n' + pretty(d) + '\n```', chunkDelay: 15 };
  },
  // Model returned nothing at all.
  empty: () => ({ text: '', chunkDelay: 0 }),
  // Model chatted instead of returning JSON.
  prose: () => ({
    text: "Sure! Here are some flashcards about photosynthesis:\n\n1. What is photosynthesis? — It's how plants make food.\n2. Where does it happen? — In the chloroplasts.",
    chunkDelay: 20,
  }),
  // Upstream failed before streaming anything.
  error: () => ({ httpError: { status: 502, code: 'UPSTREAM_ERROR', message: 'The AI provider returned an error (simulated 503 from Gemini).' } }),
  // Upstream rate-limited us.
  'rate-limit': () => ({ httpError: { status: 429, code: 'RATE_LIMITED', message: 'Too many requests to the AI provider. Wait a few seconds and try again.' } }),
  // Starts streaming, then the connection dies halfway through.
  'drop': () => ({ text: pretty(MOCK_DECK).slice(0, 900), chunkDelay: 20, dropMidStream: true }),
  // Accepts the request and then never sends a byte. The client's stall timer must fire.
  hang: () => ({ hang: true }),
};

export const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
