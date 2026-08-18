import { describe, expect, it } from 'vitest';
import { BACKUP_WARN_DAYS, daysSinceExport, needsBackupReminder } from './status';

const now = new Date(2026, 7, 18, 12, 0);

describe('Backup-Erinnerung', () => {
  it('zählt die Tage seit dem letzten Export', () => {
    expect(daysSinceExport(new Date(2026, 7, 18, 6, 0).toISOString(), now)).toBe(0);
    expect(daysSinceExport(new Date(2026, 7, 11, 23, 0).toISOString(), now)).toBe(7);
    expect(daysSinceExport(null, now)).toBeNull();
    expect(daysSinceExport('kein Datum', now)).toBeNull();
  });

  it('mahnt ohne Export und ab 14 Tagen', () => {
    expect(needsBackupReminder(null, now)).toBe(true);
    expect(needsBackupReminder(new Date(2026, 7, 17).toISOString(), now)).toBe(false);
    const overdue = new Date(2026, 7, 18 - BACKUP_WARN_DAYS, 12, 0);
    expect(needsBackupReminder(overdue.toISOString(), now)).toBe(true);
  });
});
