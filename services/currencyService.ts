export const currencyRates: Record<string, { rate: number; symbol: string }> = {
  UGX: { rate: 1, symbol: 'UGX' },
  KES: { rate: 0.035, symbol: 'KES' },
  NGN: { rate: 0.42, symbol: 'NGN' },
  USD: { rate: 0.00027, symbol: '$' },
  EUR: { rate: 0.00025, symbol: '€' }
};

export function convertPrice(amount: number, fromCurrency = 'UGX', toCurrency = 'UGX'): { amount: number; formatted: string } {
  const from = currencyRates[fromCurrency]?.rate ?? 1;
  const to = currencyRates[toCurrency]?.rate ?? 1;
  const inUgx = amount / from;
  const converted = inUgx * to;
  const symbol = currencyRates[toCurrency]?.symbol ?? toCurrency;
  return {
    amount: converted,
    formatted: `${symbol} ${Math.round(converted).toLocaleString()}`
  };
}
