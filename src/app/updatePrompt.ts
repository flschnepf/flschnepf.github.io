import { useSyncExternalStore } from 'react';

/**
 * Zustand rund um den Service Worker. Updates werden nicht still eingespielt:
 * Der neue Stand wartet, bis der Nutzer neu lädt (Spezifikation §11).
 */
let updateAvailable = false;
let offlineReady = false;
let applyUpdate: (() => void) | null = null;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setUpdateAvailable(apply: () => void): void {
  updateAvailable = true;
  applyUpdate = apply;
  emit();
}

export function setOfflineReady(): void {
  offlineReady = true;
  emit();
}

/**
 * Schickt SKIP_WAITING an den wartenden Worker und laedt neu. Der Neustart darf
 * nicht davon abhaengen, dass workbox ein `controlling`-Ereignis liefert: Hat
 * der neue Worker die Kontrolle schon uebernommen, kommt keins mehr — und der
 * Knopf bliebe wirkungslos. Ein Neuladen zu viel kostet nichts, ein fehlendes
 * laesst den Nutzer auf einem alten Stand sitzen.
 */
export function reloadWithUpdate(): void {
  applyUpdate?.();
  window.setTimeout(() => window.location.reload(), 700);
}

export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => updateAvailable,
    () => false,
  );
}

export function useOfflineReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => offlineReady,
    () => false,
  );
}
