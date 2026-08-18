import { daysBetween } from '../lib/dates';

/** Ab so vielen Tagen ohne Voll-Export blendet der Startscreen das Banner ein. */
export const BACKUP_WARN_DAYS = 14;

export function daysSinceExport(
  lastExportAt: string | null,
  now: Date = new Date(),
): number | null {
  if (!lastExportAt) return null;
  const exported = new Date(lastExportAt);
  if (Number.isNaN(exported.getTime())) return null;
  return Math.max(0, daysBetween(exported, now));
}

export function needsBackupReminder(
  lastExportAt: string | null,
  now: Date = new Date(),
): boolean {
  const days = daysSinceExport(lastExportAt, now);
  return days === null || days >= BACKUP_WARN_DAYS;
}
