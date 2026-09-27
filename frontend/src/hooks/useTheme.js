import { useEffect, useState } from 'react';
import { readJson, writeJson } from '../lib/storage.js';

const KEY = 'recall.theme';
const ORDER = ['system', 'light', 'dark'];

/** 'system' | 'light' | 'dark', applied as <html data-theme="…">. */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = readJson(KEY, 'system');
    return ORDER.includes(saved) ? saved : 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    writeJson(KEY, theme);
  }, [theme]);

  const cycle = () => setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]);
  return { theme, cycle };
}
