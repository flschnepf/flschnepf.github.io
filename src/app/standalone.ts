/**
 * iOS meldet den Home-Bildschirm-Modus ueber ein eigenes, nicht standardisiertes
 * Feld an `navigator`; alle anderen ueber die Media Query.
 */
interface IosNavigator extends Navigator {
  standalone?: boolean;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return (navigator as IosNavigator).standalone === true;
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const agent = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(agent) ||
    // iPadOS meldet sich seit Version 13 als Mac mit Touch-Unterstuetzung.
    (agent.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return iOS && !/CriOS|FxiOS|EdgiOS/.test(agent);
}
