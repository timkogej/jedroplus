export function calculateFinalPrice(
  originalPrice: number,
  tipPopusta: 'percentage' | 'fixed',
  vrednost: number
): { finalPrice: number; discountAmount: number; popustTypeLabel: '%' | 'valuta' } {
  if (tipPopusta === 'percentage') {
    const discountAmount = (originalPrice * vrednost) / 100;
    return {
      finalPrice: Math.max(0, originalPrice - discountAmount),
      discountAmount,
      popustTypeLabel: '%',
    };
  } else {
    return {
      finalPrice: Math.max(0, originalPrice - vrednost),
      discountAmount: vrednost,
      popustTypeLabel: 'valuta',
    };
  }
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}

export function formatCurrency(amount: number, valuta: string = 'EUR'): string {
  return `${amount.toFixed(2)} ${valuta}`;
}

export const DAYS_SL = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'];
export const DAYS_FULL_SL = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota'];
