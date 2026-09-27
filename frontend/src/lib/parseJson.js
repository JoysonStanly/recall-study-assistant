import { AppError } from './errors.js';

/**
 * Turn the model's raw text into a JS value, tolerating the common ways models
 * wrap JSON (code fences, a sentence before/after). Throws AppError otherwise.
 */
export function parseModelJson(raw, { finishReason } = {}) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) throw new AppError('EMPTY', 'The model returned an empty response.');

  // 1) Happy path: the whole thing is JSON.
  const direct = tryParse(text);
  if (direct.ok) return direct.value;

  // 2) Wrapped in ```json ... ``` fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const r = tryParse(fenced[1].trim());
    if (r.ok) return r.value;
  }

  // 3) Prose around a JSON object: take the outermost { ... }.
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    const r = tryParse(text.slice(first, last + 1));
    if (r.ok) return r.value;
  }

  // Out of options. Explain *why* if we can.
  if (finishReason === 'MAX_TOKENS') {
    throw new AppError('TRUNCATED', 'The model hit its length limit before finishing. Try fewer cards or shorter notes.', { raw: text });
  }
  if (first === -1) {
    throw new AppError('MALFORMED_JSON', 'The model replied in plain text instead of JSON.', { raw: text });
  }
  throw new AppError('MALFORMED_JSON', 'The model returned broken JSON (it may have been cut off).', { raw: text });
}

function tryParse(s) {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
}
