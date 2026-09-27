import { useState } from 'react';
import { ChevronDown, FlaskConical } from 'lucide-react';

// Mirrors server/simulate.js. Lets anyone reviewing the app trigger each failure on demand.
export const SIM_MODES = [
  { id: '', label: 'Off — use the real model', group: 'ok' },
  { id: 'mock', label: 'Demo deck (no API key)', group: 'ok' },
  { id: 'slow', label: 'Slow stream (~10s)', group: 'ok' },
  { id: 'partial', label: 'Partly broken items', group: 'shape' },
  { id: 'malformed', label: 'Cut-off JSON', group: 'shape' },
  { id: 'wrong-shape', label: 'Wrong shape', group: 'shape' },
  { id: 'prose', label: 'Plain text, no JSON', group: 'shape' },
  { id: 'empty', label: 'Empty response', group: 'shape' },
  { id: 'error', label: 'Provider error (5xx)', group: 'net' },
  { id: 'rate-limit', label: 'Rate limited (429)', group: 'net' },
  { id: 'drop', label: 'Connection drops', group: 'net' },
  { id: 'hang', label: 'Hangs forever', group: 'net' },
];

export default function FailureLab({ value, onChange, disabled }) {
  const [open, setOpen] = useState(Boolean(value));
  if (disabled) return null;

  return (
    <section className={`lab ${open ? 'is-open' : ''}`}>
      <button className="lab-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="lab-icon"><FlaskConical size={16} /></span>
        <span className="lab-title">
          Failure lab
          <small>Simulate bad AI output to see how Recall copes</small>
        </span>
        {value && <span className="lab-active">{SIM_MODES.find((m) => m.id === value)?.label}</span>}
        <ChevronDown size={18} className="lab-chevron" />
      </button>
      {open && (
        <div className="lab-body">
          <div className="lab-grid" role="radiogroup" aria-label="Simulation mode">
            {SIM_MODES.map((m) => (
              <button
                key={m.id || 'off'}
                role="radio"
                aria-checked={value === m.id}
                className={`lab-option lab-${m.group} ${value === m.id ? 'is-active' : ''}`}
                onClick={() => onChange(m.id)}
              >
                <span className="lab-dot" />
                {m.label}
              </button>
            ))}
          </div>
          <p className="lab-note">
            Applies to both new decks and refinements. Tip: pick <b>Slow stream</b>, cancel, and generate again — the old
            response is discarded instead of overwriting the new one.
          </p>
        </div>
      )}
    </section>
  );
}
