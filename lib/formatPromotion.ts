export function formatCurrency(amount: string | number | null | undefined, valuta?: string | null): string {
  if (amount == null || amount === '') return '-';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '-';
  const currency = valuta || 'EUR';
  try {
    return new Intl.NumberFormat('sl-SI', { style: 'currency', currency }).format(num);
  } catch {
    return `${num.toFixed(2)} ${currency}`;
  }
}

export function formatDiscount(
  popust: string | number | null | undefined,
  popustType: string | null | undefined,
  valuta?: string | null
): string {
  if (popust == null || popust === '') return '-';
  const num = typeof popust === 'string' ? parseFloat(popust) : popust;
  if (isNaN(num)) return '-';
  if (popustType === '%' || popustType === 'percent') return `${num}%`;
  return formatCurrency(num, valuta);
}

export function getPromotionBadgeConfig(tip: string | null | undefined): {
  label: string;
  bgColor: string;
  icon: 'Tag' | 'Clock' | 'Plus';
} | null {
  if (!tip) return null;
  const configs = {
    popust: { label: 'Popust', bgColor: '#6D5EF7', icon: 'Tag' as const },
    happy_hour: { label: 'Happy Hour', bgColor: '#F59E0B', icon: 'Clock' as const },
    add_on: { label: 'Add-on', bgColor: '#3B82F6', icon: 'Plus' as const },
  };
  return configs[tip as keyof typeof configs] || null;
}

export function computeAddOnOriginalPrice(
  finalCena: string | null | undefined,
  popust: string | null | undefined,
  popustTip: string | null | undefined
): number | null {
  if (!finalCena) return null;
  const final = parseFloat(finalCena);
  if (isNaN(final)) return null;
  if (!popust) return final;
  const discount = parseFloat(popust);
  if (isNaN(discount) || discount <= 0) return final;
  if (popustTip === '%') {
    const ratio = 1 - discount / 100;
    if (ratio <= 0) return null;
    return final / ratio;
  }
  return final + discount;
}
