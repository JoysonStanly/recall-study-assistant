import { useEffect, useRef } from 'react';

/**
 * Global keyboard shortcuts that stay out of the way while the user is typing.
 * `map` is { key: handler }, keys compared case-insensitively against event.key
 * (use ' ' for space). Pass enabled=false to pause (e.g. when a view is hidden).
 */
export function useHotkeys(map, enabled = true) {
  const ref = useRef(map);
  ref.current = map;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (typing) return;
      const handler = ref.current[e.key] ?? ref.current[e.key.toLowerCase()];
      if (!handler) return;
      // Enter keeps activating a focused button normally (keyboard users rely on it).
      // Space is always ours, so it can't accidentally re-press a button clicked earlier.
      if (e.key === 'Enter' && t instanceof HTMLElement && /^(BUTTON|A)$/.test(t.tagName)) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
