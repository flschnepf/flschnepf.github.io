import { useMemo } from 'react';
import type { Category, Transaction } from '../../db/types';
import {
  buildIndex,
  lastMonths,
  type AnalyticsIndex,
} from '../../lib/analytics';
import { formatDayShort, formatMonthLabel, monthKeyOf, type MonthKey } from '../../lib/dates';
import { formatCents } from '../../lib/money';
import { ChartCanvas } from './ChartCanvas';
import { categoryTrendConfig } from './chartConfigs';
import { chartTheme } from './chartSetup';
import { useThemeVersion } from './useThemeVersion';

interface Props {
  category: Category;
  month: MonthKey;
  index: AnalyticsIndex;
  transactions: Transaction[];
  onClose: () => void;
}

const TREND_MONTHS = 12;

/**
 * Zeitreihe einer Kategorie plus die Einzelbuchungen des gewählten Monats —
 * der Weg von "wo ist das Geld hin" zu "welche Buchung war das".
 */
export function CategoryDrilldown({
  category,
  month,
  index,
  transactions,
  onClose,
}: Props) {
  const themeVersion = useThemeVersion();
  const months = useMemo(() => lastMonths(month, TREND_MONTHS), [month]);

  const values = useMemo(
    () => months.map((key) => index.byCategory.get(key)?.get(category.id) ?? 0),
    [months, index, category.id],
  );

  const config = useMemo(
    () => categoryTrendConfig(months, values, category.color, category.name, chartTheme()),
    // themeVersion erzwingt den Neuaufbau bei Wechsel des Farbschemas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [months, values, category.color, category.name, themeVersion],
  );

  const rows = useMemo(
    () =>
      transactions
        .filter(
          (item) => item.categoryId === category.id && monthKeyOf(item.date) === month,
        )
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [transactions, category.id, month],
  );

  const monthTotal = rows.reduce((sum, item) => sum + item.amountCents, 0);
  const yearTotal = values.reduce((sum, value) => sum + value, 0);

  return (
    <section className="card">
      <div className="rowBetween">
        <h2>
          <span className="dot" style={{ background: category.color }} /> {category.name}
        </h2>
        <button type="button" className="btn btnSmall" onClick={onClose}>
          Zurück
        </button>
      </div>

      <dl className="defList">
        <dt>{formatMonthLabel(month)}</dt>
        <dd className="num">{formatCents(monthTotal)}</dd>
        <dt>Zwölf Monate</dt>
        <dd className="num">{formatCents(yearTotal)}</dd>
      </dl>

      <ChartCanvas
        config={config}
        label={`Ausgaben für ${category.name} in den letzten zwölf Monaten`}
        height={200}
      />

      <h2 style={{ marginTop: 14 }}>Buchungen im {formatMonthLabel(month)}</h2>
      {rows.length === 0 ? (
        <p className="empty">In diesem Monat keine Buchungen in dieser Kategorie.</p>
      ) : (
        <ul className="txList">
          {rows.map((item) => (
            <li key={item.id}>
              <div className="txRow">
                <span className="dot" style={{ background: category.color }} />
                <span className="txMain">
                  <span className="txTitle">
                    {item.merchant ?? item.note ?? category.name}
                  </span>
                  <span className="txMeta num">{formatDayShort(item.date)}</span>
                </span>
                <span className={`txAmount num${item.amountCents < 0 ? ' refund' : ''}`}>
                  {formatCents(item.amountCents)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Nur für Tests/Fallback: Index aus einer Buchungsliste. */
export { buildIndex };
