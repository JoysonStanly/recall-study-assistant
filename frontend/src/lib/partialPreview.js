// Best-effort peek into JSON that is still streaming in, used ONLY for the loading
// screen ("Writing card 4…"). It never feeds the real UI — the final text is always
// fully parsed + validated before anything is rendered as a deck.

const STR = '"((?:[^"\\\\]|\\\\.)*)"';

export function previewPartial(text) {
  if (!text) return { title: '', fronts: [], quizCount: 0 };
  const title = matchOne(text, new RegExp(`"title"\\s*:\\s*${STR}`));
  const fronts = matchAll(text, new RegExp(`"(?:front|question)"\\s*:\\s*${STR}\\s*,\\s*"(?:back|answer)"\\s*:\\s*"`, 'g'));
  const quizCount = (text.match(/"explanation"\s*:\s*"(?:[^"\\]|\\.)*"/g) || []).length;
  return { title, fronts, quizCount };
}

function matchOne(text, re) {
  const m = text.match(re);
  return m ? unescape(m[1]) : '';
}

function matchAll(text, re) {
  return [...text.matchAll(re)].map((m) => unescape(m[1])).filter(Boolean);
}

function unescape(s) {
  try { return JSON.parse(`"${s}"`); } catch { return s; }
}
