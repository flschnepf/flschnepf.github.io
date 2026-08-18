import type { ImportMode } from '../../backup/importBackup';
import { formatTimestamp } from '../../lib/dates';
import type { PendingImport } from './BackupPanel';

interface Props {
  pending: PendingImport;
  mode: ImportMode;
  busy: boolean;
  onMode: (mode: ImportMode) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Vorschau vor dem Schreiben: Der Import ist der einzige Weg, mit dem sich der
 * gesamte Bestand mit einem Tap überschreiben lässt — also erst zeigen, was
 * passiert, dann bestätigen lassen.
 */
export function ImportConfirm({
  pending,
  mode,
  busy,
  onMode,
  onCancel,
  onConfirm,
}: Props) {
  const { parsed, preview } = pending;

  return (
    <div style={{ marginTop: 14 }}>
      <h2>Import prüfen</h2>
      <p className="muted">
        Datei vom {formatTimestamp(parsed.data.exportedAt)}, Schema-Version{' '}
        {parsed.sourceVersion}
        {parsed.migrated ? ` (migriert auf ${parsed.data.schemaVersion})` : ''}.
      </p>

      {parsed.problems.length > 0 && (
        <ul className="error" style={{ paddingLeft: 18 }}>
          {parsed.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      <table className="previewTable">
        <thead>
          <tr>
            <th scope="col">Tabelle</th>
            <th scope="col">Datei</th>
            <th scope="col">vorhanden</th>
            <th scope="col">neu</th>
            <th scope="col">ersetzt</th>
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row) => (
            <tr key={row.table}>
              <td>{row.label}</td>
              <td className="num">{row.incoming}</td>
              <td className="num">{row.existing}</td>
              <td className="num">{mode === 'replace' ? row.incoming : row.added}</td>
              <td className="num">{mode === 'replace' ? row.existing : row.overwritten}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="modeChoice" style={{ marginTop: 10 }}>
        <label>
          <input
            type="radio"
            name="import-mode"
            checked={mode === 'merge'}
            onChange={() => onMode('merge')}
          />
          <span>
            <strong>Zusammenführen</strong>
            <br />
            <span className="muted">
              Datensätze mit gleicher ID werden durch die Datei ersetzt, alles
              andere bleibt erhalten.
            </span>
          </span>
        </label>
        <label>
          <input
            type="radio"
            name="import-mode"
            checked={mode === 'replace'}
            onChange={() => onMode('replace')}
          />
          <span>
            <strong>Ersetzen</strong>
            <br />
            <span className="muted">
              Alle {preview.totalExisting} vorhandenen Datensätze werden gelöscht
              und durch {preview.totalIncoming} aus der Datei ersetzt.
            </span>
          </span>
        </label>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className="btn btnPrimary" disabled={busy} onClick={onConfirm}>
          Import ausführen
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
