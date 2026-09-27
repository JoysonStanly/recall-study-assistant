import { X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id}>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => { toast.action.onClick(); onClose(); }}
            >
              {toast.action.label}
            </button>
          )}
          <button className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
