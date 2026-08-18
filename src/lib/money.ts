/**
 * Geldbetraege sind ausnahmslos ganzzahlige Cent-Werte. Kein Float, nirgends.
 * Positiv = Ausgabe, negativ = Erstattung/Gutschrift.
 */

/** Obergrenze, damit Parsefehler nicht in unsichere Integer laufen. */
const MAX_CENTS = 100_000_000_00; // 100 Mio. Euro

/** Tausendertrenner muessen sauber in Dreiergruppen stehen. */
const GROUPED_BY_DOT = /^[0-9]{1,3}(\.[0-9]{3})+$/;
const GROUPED_BY_COMMA = /^[0-9]{1,3}(,[0-9]{3})+$/;
/** Waehrungszeichen nur am Rand entfernen, nicht mitten im Betrag. */
const CURRENCY = /^(€|EUR)|(€|EUR)$/gi;

/**
 * Parst eine Nutzereingabe in Cent.
 *
 * Akzeptiert Komma und Punkt als Dezimaltrenner, Tausenderpunkte und
 * Vorzeichen. Regeln bei Mehrdeutigkeit:
 * - Kommen Komma und Punkt vor, ist das letzte Zeichen der Dezimaltrenner.
 * - Ein einzelner Punkt mit genau drei Nachkommastellen ("1.234") ist im
 *   deutschen Kontext ein Tausenderpunkt, sonst ein Dezimalpunkt ("1.5").
 * - Mehr als zwei Nachkommastellen werden kaufmaennisch auf Cent gerundet.
 *
 * @returns Cent-Betrag oder null, wenn die Eingabe kein gueltiger Betrag ist.
 */
export function parseAmountToCents(raw: string): number | null {
  if (typeof raw !== 'string') return null;

  let s = raw.replace(/[\s\u00a0\u202f]/g, '').replace(CURRENCY, '');
  if (s === '') return null;

  let sign = 1;
  if (s.startsWith('-') || s.startsWith('\u2212')) {
    sign = -1;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (s === '' || !/^[0-9.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  let decimalSep = '';
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    decimalSep = ',';
  } else if (lastDot >= 0) {
    const dotCount = s.length - s.replace(/\./g, '').length;
    const digitsAfterDot = s.length - lastDot - 1;
    decimalSep = dotCount === 1 && digitsAfterDot !== 3 ? '.' : '';
  }

  let intPart = s;
  let fracPart = '';
  if (decimalSep !== '') {
    const cut = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, cut);
    fracPart = s.slice(cut + 1);
  }

  if (!/^[0-9]*$/.test(fracPart)) return null;

  // Ohne Dezimaltrenner ist der vorhandene Trenner der Gruppentrenner.
  const groupSep =
    decimalSep === ',' ? '.' : decimalSep === '.' ? ',' : intPart.includes('.') ? '.' : ',';
  if (intPart.includes(groupSep)) {
    const grouped = groupSep === '.' ? GROUPED_BY_DOT : GROUPED_BY_COMMA;
    if (!grouped.test(intPart)) return null;
    intPart = intPart.split(groupSep).join('');
  }
  if (!/^[0-9]*$/.test(intPart)) return null;
  if (intPart === '' && fracPart === '') return null;

  const euros = intPart === '' ? 0 : Number(intPart);
  let cents = euros * 100 + Number(fracPart.slice(0, 2).padEnd(2, '0'));
  if (fracPart.length > 2 && Number(fracPart[2]) >= 5) cents += 1;

  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null;
  return sign * cents;
}

const currencyFormat = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

const plainFormat = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeEuroFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

/** "12,34 €" — fuer die Anzeige. */
export function formatCents(cents: number): string {
  return currencyFormat.format(cents / 100);
}

/** "12,34" — ohne Waehrungszeichen, z. B. fuer CSV und Eingabefelder. */
export function formatCentsPlain(cents: number): string {
  return plainFormat.format(cents / 100);
}

/** Ganze Euro fuer Diagrammachsen: "1.234 EUR". */
export function formatCentsCompact(cents: number): string {
  return `${wholeEuroFormat.format(Math.round(cents / 100))} €`;
}

/** Rohform fuer das Numpad: "12,34", ohne Gruppierung. */
export function centsToInput(cents: number): string {
  const abs = Math.abs(cents);
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

export function isExpense(cents: number): boolean {
  return cents >= 0;
}
