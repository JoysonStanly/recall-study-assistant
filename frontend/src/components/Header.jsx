import { FlaskConical, Library, Monitor, Moon, Sun, X } from 'lucide-react';
import Logo from './Logo.jsx';

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon };
const THEME_LABEL = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };

export default function Header({ onHome, onLibrary, libraryCount, theme, onTheme, simulate, onClearSimulate }) {
  const ThemeIcon = THEME_ICON[theme];
  return (
    <header className="header">
      <div className="header-inner">
        <button className="brand" onClick={onHome} aria-label="Recall — home">
          <Logo />
          <span className="brand-name">Recall</span>
        </button>

        <div className="header-actions">
          {simulate && (
            <span className="sim-badge" title="Requests are answered by the Failure lab, not the real model">
              <FlaskConical size={14} />
              <span className="sim-badge-text">Simulating: {simulate}</span>
              <button onClick={onClearSimulate} aria-label="Stop simulating"><X size={13} /></button>
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onLibrary}>
            <Library size={17} />
            <span className="hide-sm">Library</span>
            {libraryCount > 0 && <span className="count-pill">{libraryCount}</span>}
          </button>
          <button className="icon-btn" onClick={onTheme} aria-label={`${THEME_LABEL[theme]} — click to change`} title={THEME_LABEL[theme]}>
            <ThemeIcon size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
