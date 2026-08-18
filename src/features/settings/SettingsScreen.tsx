import { useEffect, useState } from 'react';
import {
  requestPersistenceAgain,
  storageEstimate,
  type StorageEstimateInfo,
} from '../../app/persistence';
import { listCategories } from '../../db/categories';
import { db, SCHEMA_VERSION } from '../../db/db';
import { getAllSettings } from '../../db/settings';
import type { Category } from '../../db/types';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useToast } from '../../ui/Toast';
import { BackupPanel } from './BackupPanel';
import { CategoryManager } from './CategoryManager';
import { InstallPanel } from './InstallPanel';

const NO_CATEGORIES: Category[] = [];

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['kB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

export function SettingsScreen() {
  const showToast = useToast();
  const settings = useLiveQuery(() => getAllSettings(), [], null);
  const categories = useLiveQuery(() => listCategories(), [], NO_CATEGORIES);
  const counts = useLiveQuery(
    async () => ({
      transactions: await db.transactions.count(),
      categories: await db.categories.count(),
    }),
    [],
    { transactions: 0, categories: 0 },
  );
  const [estimate, setEstimate] = useState<StorageEstimateInfo>({
    usageBytes: null,
    quotaBytes: null,
  });

  useEffect(() => {
    void storageEstimate().then(setEstimate);
  }, []);

  const persistGranted = settings?.persistGranted ?? null;

  return (
    <>
      <BackupPanel lastExportAt={settings?.lastExportAt ?? null} />

      <section className="card">
        <h2>Speicher</h2>
        <dl className="defList">
          <dt>Dauerhafter Speicher</dt>
          <dd>
            {persistGranted === true
              ? 'zugesagt'
              : persistGranted === false
                ? 'nicht zugesagt'
                : 'unbekannt'}
          </dd>
          <dt>Belegt</dt>
          <dd className="num">{formatBytes(estimate.usageBytes)}</dd>
          <dt>Verfügbar</dt>
          <dd className="num">{formatBytes(estimate.quotaBytes)}</dd>
        </dl>
        {persistGranted !== true && (
          <button
            type="button"
            className="btn btnSmall"
            style={{ marginTop: 10 }}
            onClick={async () => {
              const granted = await requestPersistenceAgain();
              showToast({
                message:
                  granted === true
                    ? 'Speicher ist jetzt dauerhaft.'
                    : 'Der Browser hat die Anfrage abgelehnt.',
              });
            }}
          >
            Erneut anfragen
          </button>
        )}
        <p className="faint" style={{ marginTop: 8 }}>
          Ohne Zusage kann der Browser die Daten bei Platzmangel löschen. Das
          ersetzt keine Sicherung.
        </p>
      </section>

      <InstallPanel />

      <CategoryManager categories={categories} />

      <section className="card">
        <h2>App</h2>
        <dl className="defList">
          <dt>Schema-Version</dt>
          <dd className="num">{SCHEMA_VERSION}</dd>
          <dt>Buchungen</dt>
          <dd className="num">{counts.transactions}</dd>
          <dt>Kategorien</dt>
          <dd className="num">{counts.categories}</dd>
          <dt>Währung</dt>
          <dd>{settings?.currency ?? 'EUR'}</dd>
        </dl>
        <p className="faint" style={{ marginTop: 8 }}>
          Alle Daten liegen ausschließlich auf diesem Gerät. Kein Konto, keine
          Übertragung, keine Auswertung außerhalb der App.
        </p>
      </section>
    </>
  );
}
