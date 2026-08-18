import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { itemLabel } from '../../db/shopping';
import type { ShoppingItem } from '../../db/types';

/** Ab dieser Strecke gilt die Geste als Wischen und nicht als Scrollen. */
const DRAG_THRESHOLD = 12;
/** Ab hier wird der Artikel beim Loslassen entfernt. */
const REMOVE_THRESHOLD = 80;

interface Props {
  item: ShoppingItem;
  onToggle: () => void;
  onRemove: () => void;
  onToggleStaple: () => void;
}

export function ShoppingRow({ item, onToggle, onRemove, onToggleStaple }: Props) {
  const [offset, setOffset] = useState(0);
  const gesture = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const swiped = useRef(false);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, dragging: false };
    swiped.current = false;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (!start.dragging) {
      // Senkrechte Bewegung gehört dem Scrollen, nicht der Wischgeste.
      if (Math.abs(dy) > DRAG_THRESHOLD && Math.abs(dy) >= Math.abs(dx)) {
        gesture.current = null;
        return;
      }
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      start.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setOffset(Math.min(0, dx));
  }

  function handlePointerUp() {
    const start = gesture.current;
    gesture.current = null;
    if (start?.dragging) {
      swiped.current = true;
      if (offset < -REMOVE_THRESHOLD) {
        onRemove();
        return;
      }
    }
    setOffset(0);
  }

  return (
    <li className="shopItem">
      <span className="shopSwipeHint" aria-hidden="true">
        {item.isStaple ? 'In Vorschläge' : 'Löschen'}
      </span>
      <div
        className="shopRow"
        style={{
          transform: `translateX(${offset}px)`,
          transition: offset === 0 ? 'transform 140ms ease-out' : 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <button
          type="button"
          className="shopStar"
          aria-pressed={item.isStaple}
          aria-label={item.isStaple ? 'Nicht mehr als Vorrat merken' : 'Als Vorrat merken'}
          onClick={onToggleStaple}
        >
          {item.isStaple ? '★' : '☆'}
        </button>
        <button
          type="button"
          className={`shopMain${item.done ? ' done' : ''}`}
          aria-pressed={item.done}
          onClick={() => {
            if (swiped.current) return;
            onToggle();
          }}
        >
          <span className="shopCheck" aria-hidden="true">
            {item.done ? '✓' : ''}
          </span>
          <span>{itemLabel(item)}</span>
        </button>
        <button
          type="button"
          className="shopDelete"
          aria-label={`${itemLabel(item)} entfernen`}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    </li>
  );
}
