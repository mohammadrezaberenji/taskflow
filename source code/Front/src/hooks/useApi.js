import { useCallback, useEffect, useState } from "react";

/**
 * Loads data with a memoized loader `(signal) => Promise`.
 * Keeps the previous data while reloading to avoid flicker.
 */
export function useApi(loader) {
  const [state, setState] = useState({ data: null, error: null, loading: true, loaded: false });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));

    loader(controller.signal)
      .then((data) => setState({ data, error: null, loading: false, loaded: true }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({ ...previous, error, loading: false }));
      });

    return () => controller.abort();
  }, [loader, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    initialLoading: state.loading && !state.loaded,
    reload,
  };
}
