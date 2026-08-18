import { useRef, useState, type FormEvent } from 'react';
import { listActiveCategories } from '../../db/categories';
import {
  addShoppingItem,
  deleteShoppingItem,
  listShoppingItems,
  listStapleSuggestions,
  removeFromList,
  setStaple,
  toggleShoppingItem,
} from '../../db/shopping';
import type { Category, ShoppingItem } from '../../db/types';
import { useLiveQuery } from '../../db/useLiveQuery';
import { CheckoutPanel } from './CheckoutPanel';
import { ShoppingRow } from './ShoppingRow';

const NO_ITEMS: ShoppingItem[] = [];
const NO_CATEGORIES: Category[] = [];

export function ShoppingScreen() {
  const items = useLiveQuery(() => listShoppingItems(), [], NO_ITEMS);
  const suggestions = useLiveQuery(() => listStapleSuggestions(), [], NO_ITEMS);
  const categories = useLiveQuery(() => listActiveCategories(), [], NO_CATEGORIES);

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [checkout, setCheckout] = useState(false);
  const [tidySuggestions, setTidySuggestions] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  const checkedItems = items.filter((item) => item.done);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    await addShoppingItem({ name, quantity });
    setName('');
    setQuantity('');
    // Enter fügt hinzu und behält den Fokus — für das Tippen mehrerer Artikel.
    nameInput.current?.focus();
  }

  if (checkout) {
    return (
      <CheckoutPanel
        checkedItems={checkedItems}
        categories={categories}
        onClose={() => setCheckout(false)}
      />
    );
  }

  return (
    <>
      <form className="addRow" onSubmit={handleAdd}>
        <input
          className="input"
          type="text"
          inputMode="text"
          placeholder="Menge"
          aria-label="Menge"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
        <input
          ref={nameInput}
          className="input"
          type="text"
          placeholder="Artikel hinzufügen"
          aria-label="Artikel"
          enterKeyHint="done"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="btn btnPrimary" disabled={name.trim() === ''}>
          +
        </button>
      </form>

      {suggestions.length > 0 && (
        <section className="suggestions">
          <div className="rowBetween">
            <h2 className="faint">Vorrat</h2>
            <button
              type="button"
              className="btn btnSmall btnGhost"
              onClick={() => setTidySuggestions((value) => !value)}
            >
              {tidySuggestions ? 'Fertig' : 'Aufräumen'}
            </button>
          </div>
          <div className="chips">
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip${tidySuggestions ? ' chipDanger' : ''}`}
                onClick={() =>
                  void (tidySuggestions
                    ? deleteShoppingItem(item.id)
                    : addShoppingItem({ name: item.name }))
                }
              >
                {tidySuggestions ? `× ${item.name}` : item.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <p className="empty">
          Die Liste ist leer. Artikel oben eintragen — mit ☆ markierte bleiben als
          Vorrat erhalten.
        </p>
      ) : (
        <ul className="shopList">
          {items.map((item) => (
            <ShoppingRow
              key={item.id}
              item={item}
              onToggle={() => void toggleShoppingItem(item.id)}
              onRemove={() => void removeFromList(item.id)}
              onToggleStaple={() => void setStaple(item.id, !item.isStaple)}
            />
          ))}
        </ul>
      )}

      <div className="checkoutBar">
        <span className="muted">
          {checkedItems.length} von {items.length} abgehakt
        </span>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={checkedItems.length === 0}
          onClick={() => setCheckout(true)}
        >
          Einkauf abschließen
        </button>
      </div>
    </>
  );
}
