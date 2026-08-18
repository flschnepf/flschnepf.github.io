import { useSyncExternalStore } from 'react';

/**
 * Hash-Routing statt History-Pfaden: laeuft ohne Server-Rewrites als statische
 * Seite und erzeugt trotzdem echte History-Eintraege, sodass die Zurueck-Geste
 * funktioniert. Im Standalone-Modus fuehrt die Tab-Bar durch die App.
 */
export const ROUTES = [
  'erfassen',
  'liste',
  'auswertung',
  'fixkosten',
  'verlauf',
  'einstellungen',
] as const;
export type Route = (typeof ROUTES)[number];

const listeners = new Set<() => void>();

function parseHash(hash: string): Route {
  const value = hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(value) ? (value as Route) : 'erfassen';
}

export function getRoute(): Route {
  if (typeof window === 'undefined') return 'erfassen';
  return parseHash(window.location.hash);
}

export function navigate(route: Route): void {
  const target = `#/${route}`;
  if (window.location.hash === target) return;
  window.location.hash = target;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    for (const listener of listeners) listener();
  });
  window.addEventListener('popstate', () => {
    for (const listener of listeners) listener();
  });
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute, () => 'erfassen' as Route);
}
