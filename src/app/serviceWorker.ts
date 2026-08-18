import { registerSW } from 'virtual:pwa-register';
import { setOfflineReady, setUpdateAvailable } from './updatePrompt';

/** Einmal pro Stunde nach einer neuen Fassung sehen. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Eine Home-Bildschirm-App wird selten neu geladen. Deshalb wird nicht nur beim
 * Start nach Updates gesehen, sondern auch, wenn die App wieder in den
 * Vordergrund kommt — sonst bliebe ein Update wochenlang unbemerkt.
 */
export function setupServiceWorker(): void {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      setUpdateAvailable(() => updateSW(true));
    },
    onOfflineReady() {
      setOfflineReady();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        if (document.visibilityState === 'visible') void registration.update();
      };
      setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', check);
    },
  });
}
