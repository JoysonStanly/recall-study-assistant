import { useEffect, useRef } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';

export const MAX_INPUT = 15000;

const EXAMPLES = [
  { label: 'Photosynthesis', text: 'Photosynthesis' },
  { label: 'The French Revolution', text: 'The French Revolution (1789–1799): causes, key events and outcomes' },
  { label: 'Big-O notation', text: 'Big-O notation and the time complexity of common algorithms and data structures' },
  {
    label: 'Paste sample notes',
    text: `Lecture 6 — TCP vs UDP
- Both are transport-layer protocols sitting on top of IP.
- TCP is connection-oriented: 3-way handshake (SYN, SYN-ACK, ACK) before data flows.
- TCP guarantees ordered, reliable delivery using sequence numbers, ACKs and retransmission.
- Flow control via the receive window; congestion control via slow start + congestion avoidance (AIMD).
- UDP is connectionless: no handshake, no ordering, no retransmission. Just ports + checksum.
- UDP header is 8 bytes; TCP header is at least 20 bytes.
- Use TCP for web (HTTP/1.1, HTTP/2), email, file transfer. Use UDP for DNS lookups, VoIP, gaming, video streaming.
- HTTP/3 runs over QUIC, which is built on UDP and re-implements reliability in user space.`,
  },
];

const COUNTS = [5, 10, 15, 20];
const LEVELS = [
  { id: 'easy', label: 'Easy' },
  { id: 'mixed', label: 'Mixed' },
  { id: 'hard', label: 'Hard' },
];

export default function PromptInput({ draft, setDraft, onGenerate }) {
  const ref = useRef(null);
  const len = draft.input.length;
  const tooLong = len > MAX_INPUT;
  const empty = draft.input.trim().length === 0;
  const canSubmit = !empty && !tooLong;

  // Auto-grow the textarea with its content (up to a max set in CSS).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.input]);

  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);

  const submit = (e) => {
    e?.preventDefault();
    if (canSubmit) onGenerate();
  };

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <form className="composer" onSubmit={submit}>
      <label htmlFor="source" className="sr-only">Your notes or a topic</label>
      <textarea
        id="source"
        ref={ref}
        className="composer-input"
        value={draft.input}
        placeholder="Paste your lecture notes, a textbook passage, or just type a topic…"
        onChange={(e) => set({ input: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
        }}
        rows={4}
        aria-describedby="source-help"
        aria-invalid={tooLong}
      />

      {empty && (
        <div className="examples" aria-label="Examples">
          {EXAMPLES.map((ex) => (
            <button type="button" key={ex.label} className="chip" onClick={() => { set({ input: ex.text }); ref.current?.focus(); }}>
              <Sparkles size={13} /> {ex.label}
            </button>
          ))}
        </div>
      )}

      <div className="composer-bar">
        <div className="composer-options">
          <Segmented label="Cards" value={draft.cardCount} options={COUNTS.map((n) => ({ id: n, label: String(n) }))} onChange={(v) => set({ cardCount: v })} />
          <Segmented label="Level" value={draft.difficulty} options={LEVELS} onChange={(v) => set({ difficulty: v })} />
        </div>

        <div className="composer-submit">
          <span id="source-help" className={`char-count ${tooLong ? 'is-over' : ''}`}>
            {tooLong ? `${(len - MAX_INPUT).toLocaleString()} over the limit` : len > 0 ? `${len.toLocaleString()} / ${MAX_INPUT.toLocaleString()}` : ''}
          </span>
          <button type="submit" className="btn btn-primary btn-generate" disabled={!canSubmit}>
            Generate deck <ArrowUp size={17} className="rot-45" />
          </button>
        </div>
      </div>
      <p className="kbd-hint hide-sm">
        <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Enter</kbd> to generate
      </p>
    </form>
  );
}

export function Segmented({ label, value, options, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      <span className="segmented-label">{label}</span>
      <div className="segmented-track">
        {options.map((o) => (
          <button
            type="button"
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            className={`segmented-item ${value === o.id ? 'is-active' : ''}`}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
