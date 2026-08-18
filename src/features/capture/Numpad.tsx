/**
 * Eigenes Numpad statt `input type="number"`: kein Scroll-Wegspringen, kein
 * Zoom, immer die richtigen Tasten. Der Wert bleibt ein String und wird erst
 * beim Speichern über `parseAmountToCents` in Cent verwandelt.
 */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0'] as const;

const MAX_INT_DIGITS = 7;

export function applyNumpadKey(value: string, key: string): string {
  if (key === 'back') return value.slice(0, -1);

  if (key === ',') {
    if (value.includes(',')) return value;
    return value === '' ? '0,' : `${value},`;
  }

  const [integer = '', fraction] = value.split(',');
  if (fraction !== undefined) {
    if (fraction.length >= 2) return value;
    return `${integer},${fraction}${key}`;
  }
  if (integer === '0') return key;
  if (integer.length >= MAX_INT_DIGITS) return value;
  return `${integer}${key}`;
}

interface NumpadProps {
  value: string;
  onChange: (next: string) => void;
}

export function Numpad({ value, onChange }: NumpadProps) {
  return (
    <div className="numpad">
      {KEYS.map((key) => (
        <button key={key} type="button" onClick={() => onChange(applyNumpadKey(value, key))}>
          {key}
        </button>
      ))}
      <button
        type="button"
        aria-label="Letzte Ziffer löschen"
        onClick={() => onChange(applyNumpadKey(value, 'back'))}
      >
        ⌫
      </button>
    </div>
  );
}
