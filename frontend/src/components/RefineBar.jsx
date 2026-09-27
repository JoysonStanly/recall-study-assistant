import { useState } from 'react';
import { Loader2, Undo2, Wand2, X } from 'lucide-react';
import ErrorState from './ErrorState.jsx';
import { previewPartial } from '../lib/partialPreview.js';

const SUGGESTIONS = ['Make it harder', 'Add 3 more cards', 'Simpler language', 'More real-world examples'];

/**
 * Follow-up prompts that edit the current deck instead of starting over.
 * While a refinement runs, the existing deck stays visible (just dimmed);
 * if it fails, the deck is untouched and the error shows inline.
 */
export default function RefineBar({ status, error, streamText, attempt, run, retry, cancel, dismiss, canUndo, undo }) {
  const [text, setText] = useState('');
  const loading = status === 'loading';

  const submit = async (instruction) => {
    const value = (instruction ?? text).trim();
    if (!value || loading) return;
    const ok = await run(value);
    if (ok) setText('');
  };

  const { fronts } = previewPartial(streamText);

  return (
    <section className="refine">
      <form className={`refine-bar ${loading ? 'is-loading' : ''}`} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <span className="refine-icon">{loading ? <Loader2 size={17} className="spin" /> : <Wand2 size={17} />}</span>
        <label htmlFor="refine" className="sr-only">Refine this deck</label>
        <input
          id="refine"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={loading ? 'Updating your deck…' : 'Refine this deck — e.g. “focus on dates”, “add 3 cards on the Calvin cycle”'}
          disabled={loading}
          maxLength={500}
          autoComplete="off"
        />
        {loading ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}><X size={15} /> Cancel</button>
        ) : (
          <button type="submit" className="btn btn-primary btn-sm" disabled={!text.trim()}>Refine</button>
        )}
      </form>

      {loading ? (
        <p className="refine-status" role="status">
          {attempt > 1 ? 'First answer was malformed — retrying… ' : streamText ? `Rewriting… ${fronts.length} card${fronts.length === 1 ? '' : 's'} so far` : 'Sending your deck to the AI…'}
        </p>
      ) : (
        <div className="refine-chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip chip-sm" onClick={() => submit(s)}>{s}</button>
          ))}
          {canUndo && (
            <button className="chip chip-sm chip-undo" onClick={undo}><Undo2 size={13} /> Undo last refine</button>
          )}
        </div>
      )}

      {status === 'error' && error && (
        <ErrorState variant="inline" error={error} onRetry={retry} onDismiss={dismiss} />
      )}
    </section>
  );
}
