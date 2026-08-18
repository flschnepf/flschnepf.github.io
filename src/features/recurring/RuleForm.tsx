import { useMemo, useState } from 'react';
import { createRule, updateRule } from '../../db/recurringRules';
import type { Category, RecurringInterval, RecurringRule } from '../../db/types';
import { formatDayShort, todayISO } from '../../lib/dates';
import { centsToInput, parseAmountToCents } from '../../lib/money';
import { dueDates, INTERVAL_LABELS } from '../../lib/recurrence';

interface Props {
  rule?: RecurringRule;
  categories: Category[];
  onDone: () => void;
}

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

export function RuleForm({ rule, categories, onDone }: Props) {
  const [name, setName] = useState(rule?.name ?? '');
  const [amount, setAmount] = useState(rule ? centsToInput(rule.amountCents) : '');
  const [categoryId, setCategoryId] = useState(
    rule?.categoryId ?? categories.find((category) => category.kind === 'fix')?.id ?? '',
  );
  const [interval, setInterval] = useState<RecurringInterval>(rule?.interval ?? 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(rule?.dayOfMonth ?? 1);
  const [startDate, setStartDate] = useState(rule?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(rule?.endDate ?? '');
  const [autoPost, setAutoPost] = useState(rule?.autoPost ?? false);
  const [error, setError] = useState<string | null>(null);

  const cents = parseAmountToCents(amount);

  /**
   * Zeigt vor dem Speichern, was ein zurückdatierter Start auslöst — sonst
   * erscheinen beim nächsten Öffnen überraschend zwölf Nachbuchungen.
   */
  const pending = useMemo(() => {
    if (!startDate) return [];
    const preview: RecurringRule = {
      id: rule?.id ?? 'preview',
      name,
      categoryId,
      amountCents: cents ?? 0,
      interval,
      dayOfMonth,
      startDate,
      autoPost,
      active: true,
    };
    if (endDate) preview.endDate = endDate;
    if (rule?.lastPostedDate) preview.lastPostedDate = rule.lastPostedDate;
    return dueDates(preview, todayISO());
  }, [rule, name, categoryId, cents, interval, dayOfMonth, startDate, endDate, autoPost]);

  async function handleSubmit() {
    if (name.trim() === '') {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    if (cents === null || cents === 0) {
      setError('Bitte einen Betrag eingeben.');
      return;
    }
    if (categoryId === '') {
      setError('Bitte eine Kategorie wählen.');
      return;
    }
    if (endDate && endDate < startDate) {
      setError('Das Enddatum liegt vor dem Startdatum.');
      return;
    }

    const payload = {
      name,
      categoryId,
      amountCents: cents,
      interval,
      dayOfMonth,
      startDate,
      endDate: endDate || undefined,
      autoPost,
    };
    if (rule) await updateRule(rule.id, payload);
    else await createRule(payload);
    onDone();
  }

  return (
    <div className="card">
      <div className="rowBetween">
        <h2>{rule ? 'Regel bearbeiten' : 'Neue Regel'}</h2>
        <button type="button" className="btn btnSmall" onClick={onDone}>
          Zurück
        </button>
      </div>

      <div className="stack">
        <div className="field">
          <label htmlFor="rule-name">Name</label>
          <input
            id="rule-name"
            className="input"
            type="text"
            placeholder="z. B. Miete"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="rule-amount">Betrag</label>
          <input
            id="rule-amount"
            className="input num"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="rule-category">Kategorie</label>
          <select
            id="rule-category"
            className="select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">— wählen —</option>
            {categories
              .filter((category) => !category.archived)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>

        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="rule-interval">Rhythmus</label>
            <select
              id="rule-interval"
              className="select"
              value={interval}
              onChange={(event) => setInterval(event.target.value as RecurringInterval)}
            >
              {(Object.keys(INTERVAL_LABELS) as RecurringInterval[]).map((key) => (
                <option key={key} value={key}>
                  {INTERVAL_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ width: 110 }}>
            <label htmlFor="rule-day">Am</label>
            <select
              id="rule-day"
              className="select num"
              value={dayOfMonth}
              onChange={(event) => setDayOfMonth(Number(event.target.value))}
            >
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}.
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="rule-start">Ab</label>
            <input
              id="rule-start"
              className="input"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value || todayISO())}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="rule-end">Bis (optional)</label>
            <input
              id="rule-end"
              className="input"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>

        <label className="row">
          <input
            type="checkbox"
            checked={autoPost}
            onChange={(event) => setAutoPost(event.target.checked)}
          />
          <span>
            Automatisch buchen
            <br />
            <span className="faint">
              Sonst erscheint die Buchung hier zur Bestätigung.
            </span>
          </span>
        </label>

        {pending.length > 0 && (
          <p className="muted">
            Fällig ab sofort: {pending.length}{' '}
            {pending.length === 1 ? 'Buchung' : 'Buchungen'} ({formatDayShort(pending[0]!)}
            {pending.length > 1 ? ` – ${formatDayShort(pending[pending.length - 1]!)}` : ''})
          </p>
        )}

        {error && <p className="error">{error}</p>}

        <div className="row">
          <button type="button" className="btn btnPrimary" onClick={handleSubmit}>
            Speichern
          </button>
          <button type="button" className="btn" onClick={onDone}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
