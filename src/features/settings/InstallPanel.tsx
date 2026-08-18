import { isIosSafari, isStandalone } from '../../app/standalone';

/**
 * Ohne Installation auf dem Home-Bildschirm fehlt der App das Wichtigste:
 * eigener Speicher, der nicht mit den Safari-Daten weggeräumt wird. Deshalb
 * steht hier, ob sie installiert ist — und wenn nicht, wie das geht.
 */
export function InstallPanel() {
  const standalone = isStandalone();
  const iosSafari = isIosSafari();

  return (
    <section className="card">
      <h2>Installation</h2>
      <dl className="defList">
        <dt>Modus</dt>
        <dd>{standalone ? 'Home-Bildschirm-App' : 'im Browser-Tab'}</dd>
        <dt>Offline-Betrieb</dt>
        <dd>{'serviceWorker' in navigator ? 'eingerichtet' : 'nicht verfügbar'}</dd>
      </dl>

      {!standalone && (
        <div style={{ marginTop: 10 }}>
          <p className="muted">
            {iosSafari
              ? 'Teilen-Symbol antippen, dann „Zum Home-Bildschirm“. Danach startet die App ohne Browser-Leiste und bekommt eigenen Speicherplatz.'
              : 'Über das Browser-Menü als App installieren. Danach startet sie in einem eigenen Fenster.'}
          </p>
          <p className="faint">
            Im Browser-Tab funktioniert alles genauso — nur räumt der Browser den
            Speicher eher weg. Sicherungen bleiben also wichtig.
          </p>
        </div>
      )}
    </section>
  );
}
