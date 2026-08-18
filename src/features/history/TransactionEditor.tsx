import { useState } from 'react';
import { deleteTransaction, updateTransaction } from '../../db/transactions';
import type { Category, Transaction } from '../../db/types';
import { formatTimestamp } from '../../lib/dates';
import { centsToInput, parseAmountToCents } from '../../lib/money';
import { useToast } from '../../ui/Toast';

interface Props {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
}

const SOURCE_LABELS: Record<Transaction['source'], string> = {
  manual: 'manuell erfasst',
  recurring: 'aus Fixkosten-Regel',
  shopping: 'aus Einkauf',
};

/**
 * Bearbeiten läuft als eigener Screen statt als Modal — im Standalone-Modus
 * gibt es keinen Browser-Zurück-Button, gestapelte Dialoge wären eine Sackgasse.
 */
export function TransactionEditor({ transaction, categories, onClose }: Props) {
  const showToast = useToast();
  const [amount, setAmount] = useState(centsToInput(transaction.amountCents));
  const [isRefund, setIsRefund] = useState(transaction.amountCents < 0);
  const [date, setDate] = useState(transaction.date);
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [merchant, setMerchant] = useState(transaction.merchant ?? '');
  const [note, setNote] = useState(transaction.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents === 0) {
      setError('Bitte einen gültigen Betrag eingeben.');
      return;
    }
    await updateTransaction(transaction.id, {
      date,
      amountCents: isRefund ? -Math.abs(cents) : Math.abs(cents),
      categoryId,
      merchant,
      note,
    });
    showToast({ message: 'Änderung gespeichert.' });
    onClose();
  }

  async function handleDelete() {
    const snapshot = transaction;
    await deleteTransaction(snapshot.id);
    showToast({ message: 'Buchung gelöscht.' });
    onClose();
  }

  return (
    <div className="card">
      <div className="rowBetween">
        <h2>Buchung bearbeiten</h2>
        <button type="button" className="btn btnSmall" onClick={onClose}>
          Zurück
        </button>
      </div>

      <div className="stack">
        <div className="field">
          <label htmlFor="edit-amount">Betrag</label>
          <input
            id="edit-amount"
            className="input num"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btnSmall"
          aria-pressed={isRefund}
          onClick={() => setIsRefund((value) => !value)}
        >
          {isRefund ? 'Erstattung' : 'Ausgabe'}
        </button>

        <div className="field">
          <label htmlFor="edit-date">Datum</label>
          <input
            id="edit-date"
            className="input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value || transaction.date)}
          />
        </div>

        <div className="field">
          <label htmlFor="edit-category">Kategorie</label>
          <select
            id="edit-category"
            className="select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.archived ? ' (archiviert)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="edit-merchant">Händler</label>
          <input
            id="edit-merchant"
            className="input"
            type="text"
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="edit-note">Notiz</label>
          <input
            id="edit-note"
            className="input"
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="row">
          <button type="button" className="btn btnPrimary" onClick={handleSave}>
            Speichern
          </button>
          {!confirmDelete ? (
            <button
              type="button"
              className="btn btnDanger"
              onClick={() => setConfirmDelete(true)}
            >
              Löschen
            </button>
          ) : (
            <>
              <button type="button" className="btn btnDanger" onClick={handleDelete}>
                Wirklich löschen
              </button>
              <button
                type="button"
                className="btn btnGhost btnSmall"
                onClick={() => setConfirmDelete(false)}
              >
                Abbrechen
              </button>
            </>
          )}
        </div>

        <p className="faint">
          {SOURCE_LABELS[transaction.source]} · erfasst{' '}
          {formatTimestamp(transaction.createdAt)}
          {transaction.updatedAt !== transaction.createdAt
            ? ` · geändert ${formatTimestamp(transaction.updatedAt)}`
            : ''}
        </p>
      </div>
    </div>
  );
}
