# Stripe Addon Products

Create the following products in the **live** Stripe dashboard before the addon system goes live.
All products use `recurring` billing with `monthly` interval.

## SMS Addons

| Key | Name | Price | Env var |
|-----|------|-------|---------|
| `sms-50`   | Jedro+ SMS 50   | €6.00/month  | `STRIPE_SMS_50_PRICE_ID`   |
| `sms-100`  | Jedro+ SMS 100  | €11.00/month | `STRIPE_SMS_100_PRICE_ID`  |
| `sms-200`  | Jedro+ SMS 200  | €20.00/month | `STRIPE_SMS_200_PRICE_ID`  |
| `sms-500`  | Jedro+ SMS 500  | €45.00/month | `STRIPE_SMS_500_PRICE_ID`  |
| `sms-1000` | Jedro+ SMS 1000 | €80.00/month | `STRIPE_SMS_1000_PRICE_ID` |

## Email Addons

| Key | Name | Price | Env var |
|-----|------|-------|---------|
| `email-500`  | Jedro+ Email 500  | €4.00/month  | `STRIPE_EMAIL_500_PRICE_ID`  |
| `email-1000` | Jedro+ Email 1000 | €7.00/month  | `STRIPE_EMAIL_1000_PRICE_ID` |
| `email-2500` | Jedro+ Email 2500 | €15.00/month | `STRIPE_EMAIL_2500_PRICE_ID` |
| `email-5000` | Jedro+ Email 5000 | €25.00/month | `STRIPE_EMAIL_5000_PRICE_ID` |

## Employee Addon

| Key | Name | Price | Env var |
|-----|------|-------|---------|
| `employee-addon` | Jedro+ Zaposleni | €6.00/month per unit | `STRIPE_EMPLOYEE_PRICE_ID` |

Set this product as **"per unit"** pricing in Stripe (metered pricing is NOT needed — just quantity-based).

## .env.local entries

```
STRIPE_SMS_50_PRICE_ID=price_xxx
STRIPE_SMS_100_PRICE_ID=price_xxx
STRIPE_SMS_200_PRICE_ID=price_xxx
STRIPE_SMS_500_PRICE_ID=price_xxx
STRIPE_SMS_1000_PRICE_ID=price_xxx
STRIPE_EMAIL_500_PRICE_ID=price_xxx
STRIPE_EMAIL_1000_PRICE_ID=price_xxx
STRIPE_EMAIL_2500_PRICE_ID=price_xxx
STRIPE_EMAIL_5000_PRICE_ID=price_xxx
STRIPE_EMPLOYEE_PRICE_ID=price_xxx
```

Replace each `price_xxx` with the actual Stripe price ID after creating the products.
