// Small API server. Its only jobs:
//  1. keep the Gemini API key out of the browser,
//  2. validate the request, build the prompt, and stream the model's text back,
//  3. turn upstream failures into clear, typed error codes.
// It deliberately does NOT parse the deck — the client owns validation (src/lib/validateResult.js).

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { buildCreatePrompt, buildRefinePrompt } from './prompt.js';
import { streamGemini, UpstreamError } from './gemini.js';
import { SIMULATIONS, sleep } from './simulate.js';

const PORT = Number(process.env.PORT) || 8787;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ALLOW_SIMULATE = process.env.ALLOW_SIMULATE !== 'false';
const UPSTREAM_TIMEOUT_MS = 55_000;
const MAX_INPUT = 15_000;
const MAX_INSTRUCTION = 500;
const DIFFICULTIES = new Set(['easy', 'mixed', 'hard']);

const app = express();
app.use(express.json({ limit: '300kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(process.env.GEMINI_API_KEY), simulate: ALLOW_SIMULATE });
});

/** Reject bad requests before spending a model call on them. */
function readRequest(body) {
  const b = body && typeof body === 'object' ? body : {};
  const mode = b.mode === 'refine' ? 'refine' : 'create';
  const input = typeof b.input === 'string' ? b.input.trim() : '';
  const cardCount = Math.min(25, Math.max(3, Math.round(Number(b.cardCount) || 10)));
  const difficulty = DIFFICULTIES.has(b.difficulty) ? b.difficulty : 'mixed';
  const simulate = typeof b.simulate === 'string' && b.simulate ? b.simulate : null;

  if (mode === 'create') {
    if (!input) return { error: 'Please enter some notes or a topic first.' };
    if (input.length > MAX_INPUT) return { error: `That's a lot of text — please keep it under ${MAX_INPUT.toLocaleString()} characters.` };
  } else {
    const instruction = typeof b.instruction === 'string' ? b.instruction.trim() : '';
    if (!instruction) return { error: 'Tell the AI how to change the deck.' };
    if (instruction.length > MAX_INSTRUCTION) return { error: `Keep refinement instructions under ${MAX_INSTRUCTION} characters.` };
    if (!b.previous || typeof b.previous !== 'object') return { error: 'Missing the deck to refine.' };
    return { mode, instruction, previous: b.previous, cardCount, difficulty, simulate };
  }
  return { mode, input, cardCount, difficulty, simulate };
}

app.post('/api/generate', async (req, res) => {
  const parsed = readRequest(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: parsed.error } });
  }

  // Abort the upstream call if the browser goes away (e.g. user started a newer request)
  // or if the provider takes too long.
  const upstream = new AbortController();
  let finished = false;
  res.on('close', () => { if (!finished) upstream.abort(new Error('client closed')); });
  const timer = setTimeout(() => upstream.abort(new Error('timeout')), UPSTREAM_TIMEOUT_MS);

  // Headers are only sent once the first text arrives, so failures that happen
  // before that can still use a proper HTTP status + JSON body.
  let started = false;
  const start = (meta) => {
    if (started) return;
    started = true;
    res.status(200).set({
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    send({ type: 'meta', ...meta });
  };
  const send = (obj) => res.write(JSON.stringify(obj) + '\n');
  const fail = (status, code, message) => {
    if (res.writableEnded) return;
    if (!started) res.status(status).json({ error: { code, message } });
    else { send({ type: 'error', code, message }); res.end(); }
  };

  try {
    // ---- Simulated responses (Failure lab) ----
    if (parsed.simulate) {
      const sim = ALLOW_SIMULATE && SIMULATIONS[parsed.simulate];
      if (!sim) return fail(400, 'BAD_REQUEST', 'Unknown or disabled simulation mode.');
      const plan = sim();
      if (plan.hang) { await sleep(10 * 60_000, upstream.signal); return; }
      await sleep(400, upstream.signal); // feel like a network round-trip
      if (plan.httpError) return fail(plan.httpError.status, plan.httpError.code, plan.httpError.message);
      start({ model: `simulated:${parsed.simulate}` });
      const pieces = plan.text.match(/[\s\S]{1,24}/g) || [];
      for (const piece of pieces) {
        if (upstream.signal.aborted) return;
        send({ type: 'delta', text: piece });
        if (plan.chunkDelay) await sleep(plan.chunkDelay, upstream.signal);
      }
      // Close without the final "done" event, like a server/proxy dying mid-answer.
      if (plan.dropMidStream) { finished = true; res.end(); return; }
      send({ type: 'done', finishReason: plan.finishReason || 'STOP' });
      finished = true;
      return res.end();
    }

    // ---- Real model call ----
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return fail(500, 'MISSING_KEY', 'No GEMINI_API_KEY is set on the server. Add it to .env and restart — or try the demo deck.');
    }

    const prompt = parsed.mode === 'refine' ? buildRefinePrompt(parsed) : buildCreatePrompt(parsed);
    const { finishReason } = await streamGemini({
      apiKey,
      model: MODEL,
      prompt,
      signal: upstream.signal,
      onText: (text) => { start({ model: MODEL }); send({ type: 'delta', text }); },
    });

    start({ model: MODEL }); // in case the model streamed zero text
    send({ type: 'done', finishReason: finishReason || 'STOP' });
    finished = true;
    res.end();
  } catch (err) {
    if (upstream.signal.aborted) {
      const reason = upstream.signal.reason?.message;
      if (reason === 'timeout') return fail(504, 'TIMEOUT', 'The AI took too long to respond. Try again, or use shorter notes.');
      return; // client disconnected — nobody to answer
    }
    if (err instanceof UpstreamError) return fail(err.status, err.code, err.message);
    console.error('[generate] unexpected error:', err);
    fail(502, 'UPSTREAM_ERROR', 'Could not reach the AI provider. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API route.' } }));

// Production: serve the built frontend from the same origin.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (process.argv.includes('--prod')) {
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    console.warn(`[api] --prod given but ${dist} is missing — run "npm run build" first. Serving the API only.`);
  }
}

app.listen(PORT, () => {
  const keyNote = process.env.GEMINI_API_KEY ? `model ${MODEL}` : 'NO GEMINI_API_KEY set — demo/failure-lab only';
  console.log(`[api] listening on http://localhost:${PORT} (${keyNote})`);
});
