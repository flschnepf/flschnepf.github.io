import { getSetting, setSetting } from '../db/settings';

/**
 * Bittet einmalig um dauerhaften Speicher. Ohne das raeumt der Browser
 * IndexedDB unter Umstaenden auf — der wahrscheinlichste Totalverlust.
 */
export async function ensurePersistence(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    await setSetting('persistGranted', null);
    return null;
  }

  const already = await navigator.storage.persisted();
  if (already) {
    await setSetting('persistGranted', true);
    return true;
  }

  const stored = await getSetting('persistGranted');
  // Nur einmal fragen; Safari beantwortet wiederholte Anfragen ohnehin gleich.
  if (stored === false) return false;

  const granted = navigator.storage.persist ? await navigator.storage.persist() : false;
  await setSetting('persistGranted', granted);
  return granted;
}

export async function requestPersistenceAgain(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return null;
  const granted = await navigator.storage.persist();
  await setSetting('persistGranted', granted);
  return granted;
}

export interface StorageEstimateInfo {
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function storageEstimate(): Promise<StorageEstimateInfo> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { usageBytes: null, quotaBytes: null };
  }
  const estimate = await navigator.storage.estimate();
  return {
    usageBytes: estimate.usage ?? null,
    quotaBytes: estimate.quota ?? null,
  };
}
