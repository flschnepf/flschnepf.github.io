import { useRef, useState } from 'react';
import { transactionsToCsv } from '../../backup/csv';
import {
  backupFilename,
  buildBackup,
  csvFilename,
  markExported,
  serializeBackup,
} from '../../backup/exportBackup';
import { saveTextFile } from '../../backup/files';
import {
  applyImport,
  previewImport,
  type ImportMode,
  type ImportPreview,
} from '../../backup/importBackup';
import { BackupError, parseBackup, type ParsedBackup } from '../../backup/migrate';
import { daysSinceExport } from '../../backup/status';
import { listCategories } from '../../db/categories';
import { queryTransactions } from '../../db/transactions';
import { formatTimestamp } from '../../lib/dates';
import { useToast } from '../../ui/Toast';
import { ImportConfirm } from './ImportConfirm';

export interface PendingImport {
  parsed: ParsedBackup;
  preview: ImportPreview;
}

export function BackupPanel({ lastExportAt }: { lastExportAt: string | null }) {
  const showToast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');

  const days = daysSinceExport(lastExportAt);

  async function handleJsonExport() {
    setBusy(true);
    setError(null);
    try {
      const backup = await buildBackup();
      const result = await saveTextFile(
        backupFilename(),
        serializeBackup(backup),
        'application/json',
      );
      if (result !== 'cancelled') {
        await markExported();
        showToast({ message: 'Voll-Export erstellt.' });
      }
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleCsvExport() {
    setBusy(true);
    setError(null);
    try {
      const [transactions, categories] = await Promise.all([
        queryTransactions(),
        listCategories(),
      ]);
      await saveTextFile(
        csvFilename(),
        transactionsToCsv(transactions, categories),
        'text/csv',
      );
      showToast({ message: 'CSV erstellt.' });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChosen(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setPending(null);
    try {
      const text = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new BackupError('Die Datei ist kein gültiges JSON.');
      }
      const parsed = parseBackup(raw);
      const preview = await previewImport(parsed.data);
      setPending({ parsed, preview });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleConfirmImport() {
    if (!pending) return;
    setBusy(true);
    try {
      await applyImport(pending.parsed.data, mode);
      setPending(null);
      showToast({
        message: mode === 'replace' ? 'Datenbestand ersetzt.' : 'Daten zusammengeführt.',
      });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Sicherung</h2>

      <dl className="defList">
        <dt>Letzter Voll-Export</dt>
        <dd className="num">{lastExportAt ? formatTimestamp(lastExportAt) : 'noch nie'}</dd>
        <dt>Alter</dt>
        <dd className="num">{days === null ? '—' : `${days} Tage`}</dd>
      </dl>

      <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={busy}
          onClick={handleJsonExport}
        >
          Voll-Export (JSON)
        </button>
        <button type="button" className="btn" disabled={busy} onClick={handleCsvExport}>
          Buchungen als CSV
        </button>
      </div>

      <p className="faint" style={{ marginTop: 8 }}>
        Der JSON-Export enthält alle Tabellen und ist die einzige vollständige
        Sicherung. CSV dient nur der Weiterverarbeitung und lässt sich nicht
        importieren.
      </p>

      <div style={{ marginTop: 14 }}>
        <label className="btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
          Backup-Datei wählen
          <input
            ref={fileInput}
            className="srOnly"
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(event) => void handleFileChosen(event.target.files?.[0])}
          />
        </label>
      </div>

      {error && (
        <p className="errorBox" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}

      {pending && (
        <ImportConfirm
          pending={pending}
          mode={mode}
          busy={busy}
          onMode={setMode}
          onCancel={() => setPending(null)}
          onConfirm={handleConfirmImport}
        />
      )}
    </section>
  );
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unbekannter Fehler.';
}
