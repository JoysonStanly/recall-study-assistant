// Thin wrapper around Gemini's REST streaming endpoint.
// No SDK on purpose: it's a single fetch + a small SSE parser, so every step is visible.

import { DECK_SCHEMA } from './prompt.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class UpstreamError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Map an upstream HTTP failure to one of our own error codes. */
function toUpstreamError(status, bodyText) {
  let detail = '';
  try {
    detail = JSON.parse(bodyText)?.error?.message || '';
  } catch {
    detail = bodyText?.slice(0, 200) || '';
  }
  if (status === 400 && /api key/i.test(detail)) return new UpstreamError(401, 'AUTH', 'The Gemini API key was rejected. Check GEMINI_API_KEY in .env.');
  if (status === 401 || status === 403) return new UpstreamError(401, 'AUTH', 'The Gemini API key was rejected. Check GEMINI_API_KEY in .env.');
  if (status === 404) return new UpstreamError(502, 'MODEL_NOT_FOUND', `Model not found. Set GEMINI_MODEL in .env (e.g. gemini-flash-latest). ${detail}`);
  if (status === 429) return new UpstreamError(429, 'RATE_LIMITED', 'The AI provider is rate-limiting requests. Wait a few seconds and try again.');
  if (status >= 500) return new UpstreamError(502, 'UPSTREAM_ERROR', 'The AI provider is having trouble right now. Try again in a moment.');
  return new UpstreamError(502, 'UPSTREAM_ERROR', `The AI provider rejected the request. ${detail}`.trim());
}

/**
 * Streams a generation from Gemini.
 * Calls onText(chunk) for every text fragment and resolves with { finishReason }.
 */
export async function streamGemini({ apiKey, model, prompt, signal, onText }) {
  const url = `${BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 16384, // roomy: 2.5-series "thinking" tokens share this budget
        // JSON mode + schema: the model is constrained to our shape.
        responseMimeType: 'application/json',
        responseSchema: DECK_SCHEMA,
      },
    }),
  });

  if (!res.ok) throw toUpstreamError(res.status, await res.text().catch(() => ''));
  if (!res.body) throw new UpstreamError(502, 'UPSTREAM_ERROR', 'The AI provider returned no body.');

  // Server-Sent Events: blocks separated by a blank line, each with "data: {json}".
  const decoder = new TextDecoder();
  let buffer = '';
  let finishReason = null;
  let blockReason = null;

  const handleEvent = (block) => {
    const data = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('');
    if (!data) return;
    let evt;
    try {
      evt = JSON.parse(data);
    } catch {
      return; // ignore a garbled SSE frame; the client validates the final text anyway
    }
    if (evt.promptFeedback?.blockReason) blockReason = evt.promptFeedback.blockReason;
    const cand = evt.candidates?.[0];
    if (cand?.finishReason) finishReason = cand.finishReason;
    for (const part of cand?.content?.parts || []) {
      if (typeof part.text === 'string' && !part.thought) onText(part.text);
    }
  };

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
      handleEvent(buffer.slice(0, idx));
      buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, '');
    }
  }
  if (buffer.trim()) handleEvent(buffer);

  if (blockReason) {
    throw new UpstreamError(422, 'BLOCKED', 'The AI declined to answer this input (safety filter). Try rephrasing your notes.');
  }
  return { finishReason };
}
