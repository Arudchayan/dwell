import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import type { Settings } from '../core/types';
import { getSettings } from '../storage';

/**
 * Load data asynchronously and reload it whenever extension storage changes
 * (and optionally on an interval). Keeps the previous value while reloading.
 */
export function useLiveData<T>(
  load: () => Promise<T>,
  deps: unknown[] = [],
  intervalMs?: number,
): { data: T | undefined; error: unknown; reload: () => void } {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const loadRef = useRef(load);
  loadRef.current = load;
  const seq = useRef(0);

  const reload = useCallback(() => {
    const id = ++seq.current;
    loadRef
      .current()
      .then((v) => {
        if (id === seq.current) {
          setData(v);
          setError(undefined);
        }
      })
      .catch((e: unknown) => {
        if (id === seq.current) setError(e);
      });
  }, []);

  useEffect(() => {
    reload();
    const onChange = () => reload();
    browser.storage.onChanged.addListener(onChange);
    const timer = intervalMs ? setInterval(reload, intervalMs) : undefined;
    return () => {
      browser.storage.onChanged.removeListener(onChange);
      if (timer) clearInterval(timer);
    };
  }, deps);

  return { data, error, reload };
}

export function applyTheme(theme: Settings['theme']): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/** Apply the user's theme preference and keep it in sync. */
export function useTheme(): void {
  useEffect(() => {
    void getSettings().then((s) => applyTheme(s.theme));
    const onChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes.settings) void getSettings().then((s) => applyTheme(s.theme));
    };
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, []);
}
