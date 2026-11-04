# Dodatne lokacije (add-on): Stripe in n8n

Pro paket vključuje 3 lokacije. Dodatne lokacije so količinski dodatek
(kot dodatni člani ekipe): 9,90 € / mesec na lokacijo, samo Pro, največ 7 dodatnih.

## 1. Stripe (Tim)

1. Product: **Dodatna lokacija**, cena **9,90 € / mesec**, recurring, per unit (quantity), enaka valuta kot ostali paketi.
2. Skopiraj `price_...` ID.
3. Vercel → Environment Variables: `STRIPE_LOCATION_PRICE_ID=price_...` (Production), nato redeploy.
   Brez te spremenljivke nakup vrne `not_configured` (503).

## 2. n8n: `addon-purchase` (nova veja `addon_type = 'locations'`)

Next pokliče webhook s telesom:

```json
{
  "company_id": "<uuid podjetja>",
  "addon_type": "locations",
  "stripe_subscription_id": "sub_...",
  "subscription_db_id": "<company_subscriptions.id>",
  "stripe_price_id": "price_...",
  "quantity": 2,
  "existing_stripe_item_id": "si_... ali null"
}
```

Veja naredi isto kot za `employees`:

- `existing_stripe_item_id` je null → ustvari subscription item (`price`, `quantity`, `proration_behavior: create_prorations`).
- sicer → posodobi `quantity` obstoječega itema.
- Vrne `{ "success": true, "stripe_item_id": "si_..." }`.

Zapis v bazo (`company_location_limits`: `extra_locations = quantity`,
`stripe_subscription_item_id`, `cancel_at_period_end = false`) naredi tudi Next,
zato n8n tega ni nujno pisati. Če ga piše, je rezultat enak.

## 3. n8n: `addon-cancel` (veja `addon_type = 'locations'`)

Telo: `company_id`, `addon_type: 'locations'`, ter `stripe_subscription_item_id` /
`stripe_subscription_id` kot pri `employees`. Preklic je **ob koncu obračunskega
obdobja** (ne takoj): item dobi `quantity` 0 ali se odstrani ob `current_period_end`,
`cancel_at_period_end = true` v `company_location_limits`.
Next prej preveri, da aktivnih lokacij ni več kot v paketu (`locations_in_use`, 409).

Ko obdobje poteče (Stripe webhook / obstoječi workflow za dodatke):
`company_location_limits.extra_locations = 0`.

## 4. Pravila v aplikaciji

- Samo lastnik lahko kupi, spremeni ali prekliče.
- Zmanjšanje ali preklic je mogoč le, če je aktivnih lokacij ≤ novi omejitvi.
  Če jih je več, uporabnik najprej izbere, katere obdrži (Nastavitve → Lokacije),
  ostale se arhivirajo (nič se ne izbriše).
- Prehod Pro → Plus: aktivne lokacije nad omejitvijo ostanejo, dokler lastnik
  ne izbere, katere obdrži; nove lokacije in obnavljanje so blokirani (DB sprožilec).
- Omejitev: `jp_max_lokacij(company)` = `plans.max_locations` + `extra_locations`.
