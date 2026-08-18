import { liveQuery } from 'dexie';
import { useEffect, useRef, useState, type DependencyList } from 'react';

/**
 * Kleiner Ersatz fuer `dexie-react-hooks` — die Spezifikation erlaubt keine
 * zusaetzlichen Runtime-Dependencies, und `liveQuery` steckt bereits in Dexie.
 */
export function useLiveQuery<T>(
  querier: () => Promise<T>,
  deps: DependencyList,
  initialValue: T,
): T {
  const [value, setValue] = useState<T>(initialValue);
  const querierRef = useRef(querier);
  querierRef.current = querier;

  useEffect(() => {
    const subscription = liveQuery(() => querierRef.current()).subscribe({
      next: (result) => setValue(result),
      error: (error) => {
        // Kein Fehler-Reporting nach aussen; die Konsole reicht.
        console.error('Live-Query fehlgeschlagen', error);
      },
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
