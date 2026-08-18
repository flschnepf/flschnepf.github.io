import type { KostenDB } from './db';
import { db as defaultDb } from './db';

/**
 * Key-Value-Einstellungen. Typisiert ueber eine feste Schluesselliste, damit
 * kein `any` durch die App wandert.
 */
export interface SettingsShape {
  currency: 'EUR';
  /** Zeitstempel des letzten Voll-Exports (ISO) oder null. */
  lastExportAt: string | null;
  onboardingDone: boolean;
  /** Ergebnis von `navigator.storage.persist()`. */
  persistGranted: boolean | null;
}

export const DEFAULT_SETTINGS: SettingsShape = {
  currency: 'EUR',
  lastExportAt: null,
  onboardingDone: false,
  persistGranted: null,
};

export async function getSetting<K extends keyof SettingsShape>(
  key: K,
  database: KostenDB = defaultDb,
): Promise<SettingsShape[K]> {
  const row = await database.settings.get(key);
  if (!row) return DEFAULT_SETTINGS[key];
  return row.value as SettingsShape[K];
}

export async function setSetting<K extends keyof SettingsShape>(
  key: K,
  value: SettingsShape[K],
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.settings.put({ key, value });
}

export async function getAllSettings(
  database: KostenDB = defaultDb,
): Promise<SettingsShape> {
  const rows = await database.settings.toArray();
  const result = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in result) {
      (result as Record<string, unknown>)[row.key] = row.value;
    }
  }
  return result;
}
