/** IDs kommen aus der Web-Crypto-API; kein zusaetzliches Paket dafuer. */
export function newId(): string {
  return crypto.randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString();
}
