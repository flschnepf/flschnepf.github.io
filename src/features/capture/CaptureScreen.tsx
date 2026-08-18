import { useState } from 'react';
import { navigate } from '../../app/router';
import { needsBackupReminder } from '../../backup/status';
import { listCategoriesByUsage } from '../../db/categories';
import { dueEntries, listRules } from '../../db/recurringRules';
import { getAllSettings } from '../../db/settings';
import { createTransaction, deleteTransaction } from '../../db/transactions';
import type { Category, RecurringRule } from '../../db/types';
import { useLiveQuery } from '../../db/useLiveQuery';
import { todayISO, addMonthsToDate } from '../../lib/dates';
import { parseAmountToCents } from '../../lib/money';
import { useToast } from '../../ui/Toast';
import { Numpad } from './Numpad';

const NO_CATEGORIES: Category[] = [];
const NO_RULES: RecurringRule[] = [];

export function CaptureScreen() {
  const showToast = useToast();
  const categories = useLiveQuery(() => listCategoriesByUsage(), [], NO_CATEGORIES);
  const settings = useLiveQuery(() => getAllSettings(), [], null);
  const rules = useLiveQuery(() => listRules(), [], NO_RULES);

  const [amount, setAmount] = useState('');
  const [isRefund, setIsRefund] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Keine Vorauswahl: Gespeichert wird erst, wenn eine Kategorie bewusst
  // angetippt wurde — sonst landen Buchungen stillschweigend in der ersten.
  const activeCategoryId = categoryId;
  const cents = parseAmountToCents(amount);
  const hasAmount = cents !== null && cents !== 0;
  const canSave = hasAmount && activeCategoryId !== null;
  const showBackupReminder = settings !== null && needsBackupReminder(settings.lastExportAt);
  const dueCount = dueEntries(rules).length;

  async function handleSave() {
    if (cents === null || cents === 0) {
      setError('Bitte einen Betrag eingeben.');
      return;
    }
    if (!activeCategoryId) {
      setError('Bitte eine Kategorie wählen.');
      return;
    }
    setError(null);

    const created = await createTransaction({
      date,
      amountCents: isRefund ? -cents : cents,
      categoryId: activeCategoryId,
      note,
      source: 'manual',
    });

    // Kein Screenwechsel: nur Betrag und Notiz zurücksetzen, Kategorie bleibt.
    setAmount('');
    setNote('');
    setIsRefund(false);

    showToast({
      message: 'Gespeichert.',
      action: {
        label: 'Rückgängig',
        onAction: () => deleteTransaction(created.id),
      },
    });
  }

  return (
    <div className="capture">
      {showBackupReminder && (
        <div className="banner">
          <span>
            {settings?.lastExportAt
              ? 'Letzte Sicherung ist über 14 Tage her.'
              : 'Noch keine Sicherung erstellt.'}
          </span>
          <button
            type="button"
            className="btn btnSmall"
            onClick={() => navigate('einstellungen')}
          >
            Sichern
          </button>
        </div>
      )}

      {dueCount > 0 && (
        <div className="banner">
          <span>
            {dueCount} {dueCount === 1 ? 'Fixkosten-Buchung ist' : 'Fixkosten-Buchungen sind'}{' '}
            fällig.
          </span>
          <button
            type="button"
            className="btn btnSmall"
            onClick={() => navigate('fixkosten')}
          >
            Ansehen
          </button>
        </div>
      )}

      <div className={`amountDisplay num${isRefund ? ' refund' : ''}`}>
        <button
          type="button"
          className="amountSign btnGhost btn btnSmall"
          aria-pressed={isRefund}
          onClick={() => setIsRefund((value) => !value)}
        >
          {isRefund ? 'Erstattung' : 'Ausgabe'}
        </button>
        <span>
          {isRefund ? '−' : ''}
          {amount === '' ? '0,00' : amount}
        </span>
        <span>€</span>
      </div>

      <div className="chips" role="group" aria-label="Kategorie">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className="chip"
            aria-pressed={category.id === activeCategoryId}
            style={category.id === activeCategoryId ? { color: category.color } : undefined}
            onClick={() => setCategoryId(category.id)}
          >
            <span className="dot" style={{ background: category.color }} />
            <span style={{ color: 'var(--text)' }}>{category.name}</span>
          </button>
        ))}
      </div>

      {hasAmount && activeCategoryId === null && (
        <p className="muted" role="status">
          Noch eine Kategorie wählen.
        </p>
      )}

      {/* Der freie Platz sammelt sich oberhalb dieser Gruppe: Datum, Notiz und
          Numpad bleiben so zusammen in Daumenreichweite. */}
      <div className="captureDetails">
        <div className="row">
          <input
            className="input"
            type="date"
            value={date}
            max={addMonthsToDate(todayISO(), 12)}
            aria-label="Datum"
            onChange={(event) => setDate(event.target.value || todayISO())}
          />
          {date !== todayISO() && (
            <button type="button" className="btn btnSmall" onClick={() => setDate(todayISO())}>
              Heute
            </button>
          )}
        </div>

        <input
          className="input"
          type="text"
          inputMode="text"
          placeholder="Notiz (optional)"
          aria-label="Notiz"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        {error && <p className="error">{error}</p>}

        <Numpad value={amount} onChange={setAmount} />

        <div className="saveRow">
          <button
            type="button"
            className="btn btnPrimary"
            disabled={!canSave}
            onClick={handleSave}
          >
            Speichern
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setAmount('');
              setNote('');
              setError(null);
            }}
          >
            Leeren
          </button>
        </div>
      </div>
    </div>
  );
}
