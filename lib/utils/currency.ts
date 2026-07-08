const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  JPY: '¥',
  CNY: '¥',
  PLN: 'zł',
  CZK: 'Kč',
  HRK: 'kn',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  HUF: 'Ft',
  RON: 'lei',
  BGN: 'лв',
  CAD: '$',
  AUD: '$',
};

// Currencies whose symbol is conventionally written before the amount
const PREFIX_CURRENCIES = new Set(['USD', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD']);

export function formatServicePrice(amount: number, currencyCode?: string | null): string {
  const code = (currencyCode || 'EUR').trim().toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] || code;
  const value = amount.toFixed(2);
  return PREFIX_CURRENCIES.has(code) ? `${symbol}${value}` : `${value}${symbol}`;
}
