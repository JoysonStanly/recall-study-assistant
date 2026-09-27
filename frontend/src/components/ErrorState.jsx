import { useState } from 'react';
import { AlertTriangle, ChevronDown, Clock, PencilLine, PlugZap, RotateCw, ShieldAlert, Sparkles, WifiOff, X } from 'lucide-react';

const ICONS = {
  TIMEOUT: Clock, STALLED: Clock,
  NETWORK: WifiOff, STREAM_BROKEN: WifiOff,
  AUTH: ShieldAlert, MISSING_KEY: ShieldAlert, BLOCKED: ShieldAlert,
  UPSTREAM_ERROR: PlugZap, RATE_LIMITED: PlugZap, MODEL_NOT_FOUND: PlugZap,
};

const ADVICE = {
  MALFORMED_JSON: 'This happens occasionally with language models. Retrying usually fixes it.',
  WRONG_SHAPE: 'The AI answered, but not in the format Recall needs. Retrying usually fixes it.',
  NO_USABLE_ITEMS: 'Try giving it a little more material to work with, or retry.',
  EMPTY: 'Retrying usually fixes it.',
  TRUNCATED: 'Ask for fewer cards, or shorten your notes.',
  RATE_LIMITED: 'Free API tiers have per-minute limits. Give it a few seconds.',
  BLOCKED: 'Edit your notes and try again.',
};

/**
 * Shared error UI.
 *  variant="page"   — replaces the main view (a new deck failed)
 *  variant="inline" — sits above an existing deck (a refinement failed; the deck is untouched)
 */
export default function ErrorState({ error, onRetry, onEdit, onDemo, onDismiss, variant = 'page' }) {
  const [showDetails, setShowDetails] = useState(false);
  const Icon = ICONS[error.code] || AlertTriangle;
  const advice = ADVICE[error.code];

  return (
    <div className={`error-state error-${variant}`} role="alert">
      <div className="error-icon"><Icon size={variant === 'page' ? 26 : 18} /></div>
      <div className="error-body">
        <h2 className="error-title">{error.title}</h2>
        <p className="error-message">
          {error.message} {advice && <span className="muted">{advice}</span>}
        </p>

        <div className="error-actions">
          {error.retryable && onRetry && (
            <button className="btn btn-primary btn-sm" onClick={onRetry} autoFocus={variant === 'page'}>
              <RotateCw size={15} /> Try again
            </button>
          )}
          {onDemo && (
            <button className="btn btn-secondary btn-sm" onClick={onDemo}>
              <Sparkles size={15} /> Use demo deck
            </button>
          )}
          {onEdit && (
            <button className="btn btn-ghost btn-sm" onClick={onEdit}>
              <PencilLine size={15} /> Edit notes
            </button>
          )}
          <button className="btn btn-ghost btn-sm details-toggle" onClick={() => setShowDetails((s) => !s)} aria-expanded={showDetails}>
            Details <ChevronDown size={15} className={showDetails ? 'rot-180' : ''} />
          </button>
        </div>

        {showDetails && (
          <div className="error-details">
            <div><span className="muted">Code</span> <code>{error.code}</code></div>
            {error.raw ? (
              <>
                <span className="muted">What the model sent</span>
                <pre>{error.raw.length > 3000 ? error.raw.slice(0, 3000) + '\n… (truncated)' : error.raw}</pre>
              </>
            ) : (
              <span className="muted">No model output was received.</span>
            )}
          </div>
        )}
      </div>
      {onDismiss && (
        <button className="icon-btn icon-btn-sm error-dismiss" onClick={onDismiss} aria-label="Dismiss error">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
