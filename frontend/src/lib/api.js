import { AppError } from './errors.js';

// The ONLY place the frontend talks to the backend. The LLM is never called from the browser.

export const TIMEOUTS = {
  total: 60_000, // give up entirely after this long
  stall: 20_000, // give up if no bytes arrive for this long (catches silent hangs)
};

/**
 * POST /api/generate and read the NDJSON stream.
 * Calls onText(fullTextSoFar) as chunks arrive; resolves with { text, finishReason, model }.
 * If `signal` aborts (user cancelled / newer request started) this rejects with an AbortError,
 * which callers treat as "ignore", not as a failure.
 */
export async function streamDeck(payload, { signal, onText } = {}) {
  const ctrl = new AbortController();
  let timeoutCode = null;
  const abortWith = (code) => { timeoutCode = code; ctrl.abort(); };

  const onOuterAbort = () => ctrl.abort();
  if (signal?.aborted) throw abortError();
  signal?.addEventListener('abort', onOuterAbort, { once: true });

  const totalTimer = setTimeout(() => abortWith('TIMEOUT'), TIMEOUTS.total);
  let stallTimer = setTimeout(() => abortWith('STALLED'), TIMEOUTS.stall);
  const bump = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => abortWith('STALLED'), TIMEOUTS.stall);
  };

  const translate = (err) => {
    if (timeoutCode === 'TIMEOUT') return new AppError('TIMEOUT', `No complete answer after ${TIMEOUTS.total / 1000}s. The AI may be overloaded — try again.`);
    if (timeoutCode === 'STALLED') return new AppError('STALLED', `The AI stopped responding for ${TIMEOUTS.stall / 1000}s, so we gave up waiting.`);
    if (signal?.aborted) return abortError();
    return err;
  };

  try {
    let res;
    try {
      res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } catch (err) {
      throw translate(new AppError('NETWORK', "Couldn't reach the Recall server. Is it running (npm start)?"));
    }

    if (!res.ok) throw await errorFromResponse(res);
    if (!res.body) throw new AppError('STREAM_BROKEN', 'The server returned no response body.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let finishReason = null;
    let model = null;
    let done = false;

    const handleLine = (line) => {
      if (!line.trim()) return;
      let evt;
      try { evt = JSON.parse(line); } catch { return; }
      if (evt.type === 'meta') model = evt.model;
      else if (evt.type === 'delta' && typeof evt.text === 'string') { text += evt.text; onText?.(text); }
      else if (evt.type === 'done') { finishReason = evt.finishReason; done = true; }
      else if (evt.type === 'error') throw new AppError(evt.code, evt.message, { raw: text });
    };

    try {
      for (;;) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        bump();
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          handleLine(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      }
      handleLine(buffer);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw translate(new AppError('STREAM_BROKEN', 'The connection dropped before the AI finished answering.', { raw: text }));
    }

    if (!done) throw new AppError('STREAM_BROKEN', 'The connection closed before the AI finished answering.', { raw: text });
    return { text, finishReason, model };
  } finally {
    clearTimeout(totalTimer);
    clearTimeout(stallTimer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

async function errorFromResponse(res) {
  let body = null;
  try { body = await res.json(); } catch { /* not JSON — e.g. dev proxy can't reach the API */ }
  const e = body?.error;
  if (e?.code) return new AppError(e.code, e.message || `Request failed (${res.status}).`);
  if (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
    return new AppError('NETWORK', "The Recall API server isn't responding. Make sure it's running (npm start).");
  }
  return new AppError('UNKNOWN', `Request failed with status ${res.status}.`);
}

export function abortError() {
  return new DOMException('Request superseded', 'AbortError');
}

export const isAbort = (err) => err?.name === 'AbortError';
