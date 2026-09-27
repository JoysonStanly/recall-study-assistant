import { useCallback, useEffect, useRef, useState } from 'react';
import { streamDeck, isAbort } from '../lib/api.js';
import { parseModelJson } from '../lib/parseJson.js';
import { validateDeck } from '../lib/validateResult.js';
import { MODEL_OUTPUT_ERRORS, toAppError } from '../lib/errors.js';

const IDLE = { status: 'idle', kind: null, error: null, streamText: '', attempt: 1 };
const MAX_ATTEMPTS = 2; // one automatic retry when the *model output* is bad

/**
 * Owns the lifecycle of one AI request: loading → success | error.
 *
 * Guarantees:
 *  - Latest request wins. Starting a new request aborts the previous one, and a
 *    request-id check drops any result that still arrives late.
 *  - Nothing reaches the caller unless it parsed AND validated.
 *  - Malformed/wrong-shape output is retried once automatically before showing an error.
 *
 * generate(payload) resolves to { deck, warnings, model } on success, or null when it
 * failed / was cancelled / was superseded (the hook's state already describes why).
 */
export function useDeckGenerator() {
  const [state, setState] = useState(IDLE);
  const requestId = useRef(0);
  const controller = useRef(null);
  const lastPayload = useRef(null);

  useEffect(() => () => controller.current?.abort(), []); // abort on unmount

  const generate = useCallback(async (payload) => {
    controller.current?.abort(); // cancel whatever was in flight
    const id = ++requestId.current;
    const ctrl = new AbortController();
    controller.current = ctrl;
    lastPayload.current = payload;
    const isCurrent = () => id === requestId.current;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      setState({ status: 'loading', kind: payload.mode, error: null, streamText: '', attempt });
      try {
        const { text, finishReason, model } = await streamDeck(payload, {
          signal: ctrl.signal,
          onText: (t) => { if (isCurrent()) setState((s) => ({ ...s, streamText: t })); },
        });
        if (!isCurrent()) return null; // a newer request started while we were waiting

        const data = parseModelJson(text, { finishReason });
        const { deck, warnings } = validateDeck(data);

        setState({ ...IDLE, status: 'success', kind: payload.mode });
        return { deck, warnings, model };
      } catch (err) {
        if (!isCurrent() || isAbort(err)) return null; // superseded or cancelled: stay quiet
        const error = toAppError(err);
        const canAutoRetry = MODEL_OUTPUT_ERRORS.has(error.code) && attempt < MAX_ATTEMPTS;
        if (canAutoRetry) continue;
        setState({ status: 'error', kind: payload.mode, error, streamText: '', attempt });
        return null;
      }
    }
    return null;
  }, []);

  const retry = useCallback(() => (lastPayload.current ? generate(lastPayload.current) : Promise.resolve(null)), [generate]);

  const cancel = useCallback(() => {
    requestId.current++; // invalidate anything still in flight
    controller.current?.abort();
    setState(IDLE);
  }, []);

  const reset = useCallback(() => setState((s) => (s.status === 'loading' ? s : IDLE)), []);

  return { ...state, generate, retry, cancel, reset };
}
