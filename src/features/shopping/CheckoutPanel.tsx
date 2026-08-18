import { useState } from 'react';
import { itemLabel } from '../../db/shopping';
import { finishShopping, undoShopping } from '../../db/shoppingCheckout';
import type { Category, ShoppingItem } from '../../db/types';
import { formatDayLong, todayISO } from '../../lib/dates';
import { parseAmountToCents } from '../../lib/money';
import { useToast } from '../../ui/Toast';
import { Numpad } from '../capture/Numpad';

interface Props {
  checkedItems: ShoppingItem[];
  categories: Category[];
  onClose: () => void;
}

/** Vorbelegung laut Spezifikation. */
const DEFAULT_CATEGORY_NAME = 'Lebensmittel';

export function defaultCategoryId(categories: Category[]): string | null {
  const preferred = categories.find(
    (category) => !category.archived && category.name === DEFAULT_CATEGORY_NAME,
  );
  return preferred?.id ?? categories.find((category) => !category.archived)?.id ?? null;
}

/**
 * Ein einziger Dialog für den ganzen Bon: Summe, Händler, Kategorie. Bewusst
 * keine Einzelpreise je Artikel — das hält die App im Alltag benutzbar.
 */
export function CheckoutPanel({ checkedItems, categories, onClose }: Props) {
  const showToast = useToast();
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState(() => defaultCategoryId(categories) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cents = parseAmountToCents(amount);
  const canBook = cents !== null && cents !== 0 && categoryId !== '';

  async function handleBook() {
    if (cents === null || cents === 0) {
      setError('Bitte die Bon-Summe eingeben.');
      return;
    }
    if (categoryId === '') {
      setError('Bitte eine Kategorie wählen.');
      return;
    }
    setBusy(true);
    try {
      const result = await finishShopping({
        date: todayISO(),
        amountCents: cents,
        categoryId,
        merchant,
      });
      onClose();
      showToast({
        message: `Einkauf gebucht: ${checkedItems.length} Artikel.`,
        action: {
          label: 'Rückgängig',
          onAction: () => undoShopping(result),
        },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="rowBetween">
        <h2>Einkauf abschließen</h2>
        <button type="button" className="btn btnSmall" onClick={onClose}>
          Zurück
        </button>
      </div>

      <p className="muted">
        {checkedItems.length === 0
          ? 'Keine Artikel abgehakt — es wird nur die Buchung angelegt.'
          : checkedItems.map(itemLabel).join(', ')}
      </p>

      <div className="amountDisplay num">
        <span className="amountSign">Bon-Summe</span>
        <span>{amount === '' ? '0,00' : amount}</span>
        <span>€</span>
      </div>

      <Numpad value={amount} onChange={setAmount} />

      <div className="stack" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="checkout-merchant">Händler</label>
          <input
            id="checkout-merchant"
            className="input"
            type="text"
            placeholder="optional"
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="checkout-category">Kategorie</label>
          <select
            id="checkout-category"
            className="select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {categories
              .filter((category) => !category.archived)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="row">
          <button
            type="button"
            className="btn btnPrimary"
            disabled={!canBook || busy}
            onClick={handleBook}
          >
            Buchen
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Abbrechen
          </button>
        </div>

        <p className="faint">Wird auf {formatDayLong(todayISO())} gebucht.</p>
      </div>
    </div>
  );
}
