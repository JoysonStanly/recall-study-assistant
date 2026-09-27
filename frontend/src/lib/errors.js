// One error type for everything that can go wrong between "Generate" and a rendered deck.
// Each code maps to user-facing copy + whether a retry is likely to help.

export const ERROR_COPY = {
  EMPTY:           { title: 'The AI sent back nothing',            retryable: true },
  MALFORMED_JSON:  { title: "The AI's answer wasn't valid JSON",    retryable: true },
  TRUNCATED:       { title: 'The answer was cut off',               retryable: true },
  WRONG_SHAPE:     { title: "The AI's answer had the wrong shape",  retryable: true },
  NO_USABLE_ITEMS: { title: 'No usable cards in the response',      retryable: true },
  TIMEOUT:         { title: 'That took too long',                   retryable: true },
  STALLED:         { title: 'The response stalled',                 retryable: true },
  NETWORK:         { title: "Couldn't reach the server",            retryable: true },
  STREAM_BROKEN:   { title: 'The connection dropped mid-answer',    retryable: true },
  RATE_LIMITED:    { title: 'Slow down a little',                   retryable: true },
  UPSTREAM_ERROR:  { title: 'The AI provider had a problem',        retryable: true },
  BLOCKED:         { title: 'The AI declined this input',           retryable: false },
  BAD_REQUEST:     { title: "That request couldn't be sent",        retryable: false },
  AUTH:            { title: 'API key problem',                      retryable: false },
  MISSING_KEY:     { title: 'No API key configured',                retryable: false },
  MODEL_NOT_FOUND: { title: 'Model not found',                      retryable: false },
  UNKNOWN:         { title: 'Something went wrong',                 retryable: true },
};

export class AppError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'AppError';
    this.code = ERROR_COPY[code] ? code : 'UNKNOWN';
    this.title = ERROR_COPY[this.code].title;
    this.retryable = ERROR_COPY[this.code].retryable;
    Object.assign(this, extra); // e.g. { raw } — the model text, for the "show details" toggle
  }
}

/** Errors the auto-retry is allowed to swallow once: the model misbehaved, the request was fine. */
export const MODEL_OUTPUT_ERRORS = new Set(['EMPTY', 'MALFORMED_JSON', 'WRONG_SHAPE', 'NO_USABLE_ITEMS']);

export function toAppError(err) {
  if (err instanceof AppError) return err;
  return new AppError('UNKNOWN', err?.message || 'Unexpected error.');
}
