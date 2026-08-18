import { useMemo, useState } from 'react';
import { listCategories, categoryMap } from '../../db/categories';
import {
  deleteRule,
  dueEntries,
  postAllDue,
  postDue,
  setRuleActive,
  skipDue,
  type DueEntry,
} from '../../db/recurringRules';
import { listRules } from '../../db/recurringRules';
import type { Category, RecurringRule } from '../../db/types';
import { useLiveQuery } from '../../db/useLiveQuery';
import { formatDayShort, formatDayLong, todayISO } from '../../lib/dates';
import { formatCents } from '../../lib/money';
import { INTERVAL_LABELS, nextDueDate } from '../../lib/recurrence';
import { useToast } from '../../ui/Toast';
import { RuleForm } from './RuleForm';

const NO_RULES: RecurringRule[] = [];
const NO_CATEGORIES: Category[] = [];

export function RecurringScreen() {
  const showToast = useToast();
  const rules = useLiveQuery(() => listRules(), [], NO_RULES);
  const categories = useLiveQuery(() => listCategories(), [], NO_CATEGORIES);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => categoryMap(categories), [categories]);
  const today = todayISO();
  const due = useMemo(() => dueEntries(rules, today), [rules, today]);

  if (adding || editing) {
    return (
      <RuleForm
        {...(editing ? { rule: editing } : {})}
        categories={categories}
        onDone={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
    );
  }

  async function handlePost(entry: DueEntry) {
    setBusy(true);
    try {
      await postDue(entry);
      showToast({ message: `${entry.rule.name} gebucht.` });
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip(entry: DueEntry) {
    setBusy(true);
    try {
      await skipDue(entry);
      showToast({ message: `${entry.rule.name} übersprungen.` });
    } finally {
      setBusy(false);
    }
  }

  async function handlePostAll() {
    setBusy(true);
    try {
      const posted = await postAllDue(due);
      showToast({
        message: `${posted} ${posted === 1 ? 'Buchung' : 'Buchungen'} angelegt.`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {due.length > 0 && (
        <section className="card">
          <div className="rowBetween">
            <h2>Fällig</h2>
            <button
              type="button"
              className="btn btnSmall btnPrimary"
              disabled={busy}
              onClick={handlePostAll}
            >
              Alle buchen
            </button>
          </div>

          <ul className="dueList">
            {due.map((entry) => (
              <li key={`${entry.rule.id}-${entry.date}`}>
                <div className="dueMain">
                  <span className="dot" style={{ background: byId.get(entry.rule.categoryId)?.color ?? 'var(--text-faint)' }} />
                  <span>
                    <strong>{entry.rule.name}</strong>
                    <br />
                    <span className="faint num">{formatDayLong(entry.date)}</span>
                  </span>
                  <span className="txAmount num">{formatCents(entry.rule.amountCents)}</span>
                </div>
                <div className="row">
                  <button
                    type="button"
                    className="btn btnSmall btnPrimary"
                    disabled={busy}
                    onClick={() => void handlePost(entry)}
                  >
                    Buchen
                  </button>
                  <button
                    type="button"
                    className="btn btnSmall"
                    disabled={busy}
                    onClick={() => void handleSkip(entry)}
                  >
                    Überspringen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="rowBetween">
          <h2>Regeln</h2>
          <button type="button" className="btn btnSmall" onClick={() => setAdding(true)}>
            Neu
          </button>
        </div>

        {rules.length === 0 && (
          <p className="empty">
            Noch keine Fixkosten hinterlegt. Miete, Strom, Versicherungen — einmal
            eintragen, danach buchen sie sich selbst.
          </p>
        )}

        {rules.map((rule) => {
          const next = nextDueDate(rule, today);
          return (
            <div key={rule.id} className={`ruleRow${rule.active ? '' : ' archived'}`}>
              <span
                className="dot"
                style={{ background: byId.get(rule.categoryId)?.color ?? 'var(--text-faint)' }}
              />
              <span className="ruleMain">
                <span className="txTitle">{rule.name}</span>
                <span className="txMeta">
                  {INTERVAL_LABELS[rule.interval]}, am {rule.dayOfMonth}.
                  {rule.autoPost ? ' · automatisch' : ''}
                  {rule.active
                    ? next
                      ? ` · nächste ${formatDayShort(next)}`
                      : ' · ausgelaufen'
                    : ' · inaktiv'}
                </span>
              </span>
              <span className="txAmount num">{formatCents(rule.amountCents)}</span>
              <span className="row ruleActions">
                <button
                  type="button"
                  className="btn btnSmall btnGhost"
                  onClick={() => setEditing(rule)}
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  className="btn btnSmall btnGhost"
                  onClick={() => void setRuleActive(rule.id, !rule.active)}
                >
                  {rule.active ? 'Pausieren' : 'Aktivieren'}
                </button>
                {confirmDelete === rule.id ? (
                  <>
                    <button
                      type="button"
                      className="btn btnSmall btnDanger"
                      onClick={() => {
                        setConfirmDelete(null);
                        void deleteRule(rule.id);
                      }}
                    >
                      Wirklich löschen
                    </button>
                    <button
                      type="button"
                      className="btn btnSmall btnGhost"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btnSmall btnGhost"
                    onClick={() => setConfirmDelete(rule.id)}
                  >
                    Löschen
                  </button>
                )}
              </span>
            </div>
          );
        })}

        <p className="faint" style={{ marginTop: 10 }}>
          Bereits gebuchte Perioden bleiben gebucht: Jede Regel merkt sich ihren
          letzten Termin und legt ihn nie zweimal an.
        </p>
      </section>
    </>
  );
}
