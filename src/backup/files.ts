/**
 * Datei-Ausgabe: auf iOS ueber das Teilen-Menue (Dateien-App, Mail, ...),
 * sonst als klassischer Download. Beides rein lokal, kein Upload.
 */
export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

export async function saveTextFile(
  filename: string,
  content: string,
  mime: string,
): Promise<SaveResult> {
  const file = new File([content], filename, { type: mime });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Teilen nicht moeglich (z. B. Desktop-Safari): auf Download zurueckfallen.
    }
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Erst nach dem Klick freigeben, sonst bricht der Download in Safari ab.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export function readTextFile(file: File): Promise<string> {
  return file.text();
}
