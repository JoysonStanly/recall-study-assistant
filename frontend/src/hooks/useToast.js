import { useCallback, useEffect, useRef, useState } from 'react';

/** One toast at a time; a new one replaces the old. */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const hideToast = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((message, { action, duration = 5000 } = {}) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, action });
    timer.current = setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, showToast, hideToast };
}
