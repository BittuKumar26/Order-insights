import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

// Small data-fetching hook for pages that don't need global state: loading/error/retry + abort on change.
export function useFetch(path, params) {
  const [state, setState] = useState({ data: null, meta: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params || {});
  useEffect(() => {
    if (!path) { setState({ data: null, meta: null, loading: false, error: null }); return undefined; } // nothing selected
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api.get(path, params, ctrl.signal)
      .then((r) => setState({ data: r.data, meta: r.meta, loading: false, error: null }))
      .catch((e) => e.name !== 'AbortError' && setState((s) => ({ ...s, loading: false, error: e.message })));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, tick]);
  return { ...state, retry: useCallback(() => setTick((t) => t + 1), []) };
}
