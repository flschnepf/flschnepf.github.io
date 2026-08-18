import { useState } from 'react';
import {
  createCategory,
  setCategoryArchived,
  updateCategory,
} from '../../db/categories';
import type { Category, CategoryKind } from '../../db/types';

const DEFAULT_COLOR = '#4a90a4';

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const visible = categories.filter((category) => showArchived || !category.archived);

  return (
    <section className="card">
      <div className="rowBetween">
        <h2>Kategorien</h2>
        <button
          type="button"
          className="btn btnSmall"
          onClick={() => {
            setAdding((value) => !value);
            setEditingId(null);
          }}
        >
          {adding ? 'Abbrechen' : 'Neu'}
        </button>
      </div>

      {adding && <CategoryForm onDone={() => setAdding(false)} />}

      {visible.map((category) =>
        editingId === category.id ? (
          <CategoryForm
            key={category.id}
            category={category}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <div
            key={category.id}
            className={`catRow${category.archived ? ' archived' : ''}`}
          >
            <span className="dot" style={{ background: category.color }} />
            <span>
              {category.name}
              <span className="faint"> · {category.kind}</span>
            </span>
            <span className="faint num">{category.usageCount}×</span>
            <span className="row">
              <button
                type="button"
                className="btn btnSmall btnGhost"
                onClick={() => {
                  setEditingId(category.id);
                  setAdding(false);
                }}
              >
                Bearbeiten
              </button>
              <button
                type="button"
                className="btn btnSmall btnGhost"
                onClick={() => void setCategoryArchived(category.id, !category.archived)}
              >
                {category.archived ? 'Aktivieren' : 'Archivieren'}
              </button>
            </span>
          </div>
        ),
      )}

      <label className="row faint" style={{ marginTop: 10 }}>
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
        />
        Archivierte anzeigen
      </label>

      <p className="faint">
        Kategorien werden nie gelöscht, nur archiviert — sonst verlieren
        historische Buchungen ihren Bezug.
      </p>
    </section>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category?: Category;
  onDone: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? DEFAULT_COLOR);
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? 'variabel');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (name.trim() === '') {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    if (category) {
      await updateCategory(category.id, { name, color, kind });
    } else {
      await createCategory({ name, color, kind });
    }
    onDone();
  }

  return (
    <div className="stack" style={{ padding: '8px 0' }}>
      <input
        className="input"
        type="text"
        placeholder="Name"
        aria-label="Name der Kategorie"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="row">
        <input
          type="color"
          aria-label="Farbe"
          value={color}
          style={{ width: 52, height: 44 }}
          onChange={(event) => setColor(event.target.value)}
        />
        <select
          className="select"
          aria-label="Art"
          value={kind}
          onChange={(event) => setKind(event.target.value as CategoryKind)}
        >
          <option value="variabel">variabel</option>
          <option value="fix">fix</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="button" className="btn btnPrimary btnSmall" onClick={handleSubmit}>
          Speichern
        </button>
        <button type="button" className="btn btnSmall" onClick={onDone}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
