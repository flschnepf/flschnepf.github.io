import { useEffect, useState } from 'react';

/**
 * Zaehlt hoch, wenn sich Farbschema oder Bewegungsvorliebe aendern. Charts
 * zeichnen ihre Farben aus dem Stylesheet und muessen dann neu aufgebaut werden.
 */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const queries = [
      window.matchMedia('(prefers-color-scheme: dark)'),
      window.matchMedia('(prefers-reduced-motion: reduce)'),
    ];
    const bump = () => setVersion((value) => value + 1);
    for (const query of queries) query.addEventListener('change', bump);
    return () => {
      for (const query of queries) query.removeEventListener('change', bump);
    };
  }, []);

  return version;
}
