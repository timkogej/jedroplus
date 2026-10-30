// lib/billing/addons.ts
//
// Add-on packages and prices shown on Nastavitve → Dodatki.
// Keep in sync with the Stripe prices and with app/api/addons/purchase/route.ts.

export interface QuotaPackage {
  key: string;
  quantity: number;
  /** €/month */
  priceMonthly: number;
  badge?: string;
}

export const SMS_PACKAGES_LIST: QuotaPackage[] = [
  { key: 'sms-50', quantity: 50, priceMonthly: 4 },
  { key: 'sms-100', quantity: 100, priceMonthly: 8 },
  { key: 'sms-200', quantity: 200, priceMonthly: 16 },
  { key: 'sms-500', quantity: 500, priceMonthly: 35, badge: '-12%' },
  { key: 'sms-1000', quantity: 1000, priceMonthly: 65, badge: '-19%' },
];

export const EMAIL_PACKAGES_LIST: QuotaPackage[] = [
  { key: 'email-500', quantity: 500, priceMonthly: 4 },
  { key: 'email-1000', quantity: 1000, priceMonthly: 7 },
  { key: 'email-2500', quantity: 2500, priceMonthly: 15 },
  { key: 'email-5000', quantity: 5000, priceMonthly: 25 },
];

/** €/month for one extra app login. */
export const SEAT_PRICE_EUR = 6;
export const MAX_EXTRA_SEATS = 20;

/** €/month for a custom SMS sender name. */
export const SENDER_ID_PRICE_EUR = 4.9;
