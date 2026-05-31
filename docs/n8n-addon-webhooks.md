# n8n Addon Webhook Specifications

## New webhook: `addon-purchase`

**URL:** `https://tikej.app.n8n.cloud/webhook/addon-purchase`  
**Method:** POST

### Workflow logic

```
Webhook receive
    ↓
Switch on addon_type: 'sms' | 'email' | 'employees'
    ↓
[Branch: sms or email]
    IF existing_stripe_item_id is not null/empty:
        → Stripe: DELETE /v1/subscription_items/{existing_stripe_item_id}
           body: { prorate: true }
    → Stripe: POST /v1/subscription_items
       body: {
         subscription: stripe_subscription_id,
         price: stripe_price_id,
         proration_behavior: 'create_prorations'
       }
    → On success: Supabase update company_subscriptions
       SET sms_addon_monthly = addon_quantity   (or email_addon_monthly for email)
           sms_addon_stripe_item_id = new_item.id
           sms_addon_cancel_at_period_end = false
       WHERE id = subscription_db_id
    → Return: { success: true, stripe_item_id: 'si_xxx' }

[Branch: employees]
    IF existing_stripe_item_id is not null/empty:
        → Stripe: POST /v1/subscription_items/{existing_stripe_item_id}
           body: { quantity: quantity }
    ELSE:
        → Stripe: POST /v1/subscription_items
           body: {
             subscription: stripe_subscription_id,
             price: stripe_price_id,
             quantity: quantity,
             proration_behavior: 'create_prorations'
           }
    → Supabase: update company_user_limits
       SET extra_users = quantity,
           max_users = included_users + quantity,
           stripe_subscription_item_id = item.id,
           cancel_at_period_end = false
       WHERE company_id = company_id
    → Return: { success: true }
```

### SMS/Email payload

```json
{
  "company_id": "uuid",
  "addon_type": "sms",
  "stripe_subscription_id": "sub_xxx",
  "subscription_db_id": "uuid",
  "package_key": "sms-100",
  "stripe_price_id": "price_xxx",
  "addon_quantity": 100,
  "existing_stripe_item_id": "si_xxx or null"
}
```

### Employees payload

```json
{
  "company_id": "uuid",
  "addon_type": "employees",
  "stripe_subscription_id": "sub_xxx",
  "subscription_db_id": "uuid",
  "stripe_price_id": "price_xxx",
  "quantity": 3,
  "existing_stripe_item_id": "si_xxx or null"
}
```

---

## New webhook: `addon-cancel`

**URL:** `https://tikej.app.n8n.cloud/webhook/addon-cancel`  
**Method:** POST

### Workflow logic

```
Webhook receive { company_id, addon_type, stripe_subscription_item_id, subscription_db_id }
    ↓
Stripe: POST /v1/subscription_items/{stripe_subscription_item_id}
   body: { cancel_at_period_end: true }
   Note: schedules cancellation at period end, not immediate
    ↓
[If SMS]: Supabase update company_subscriptions
   SET sms_addon_cancel_at_period_end = true WHERE id = subscription_db_id
[If email]: SET email_addon_cancel_at_period_end = true
[If employees]: Supabase update company_user_limits
   SET cancel_at_period_end = true WHERE company_id = company_id
    ↓
Return: { success: true }
```

### Payload

```json
{
  "company_id": "uuid",
  "addon_type": "sms",
  "stripe_subscription_item_id": "si_xxx",
  "subscription_db_id": "uuid"
}
```

---

## Update existing Stripe webhook (invoice.paid)

When processing `invoice.paid`, check invoice line items:
- If `price.id` matches any SMS addon price ID → update `company_subscriptions.sms_addon_monthly`
- If `price.id` matches any email addon price ID → update `email_addon_monthly`
- If `price.id` matches employee addon price ID → update `company_user_limits.extra_users` and `max_users`

When addon `cancel_at_period_end` triggers (item deleted at period end):
Handle `customer.subscription.updated` event, detect removed items by diffing subscription items list.
- SMS item removed: SET `sms_addon_monthly = 0`, `sms_addon_stripe_item_id = NULL`, `sms_addon_cancel_at_period_end = false`
- Same pattern for email and employees

---

## Update existing quota check workflow

Update the Supabase query node to include addon columns:

```sql
SELECT
  p.sms_quota_monthly,
  p.email_quota_monthly,
  p.sms_enabled,
  p.email_enabled,
  cs.sms_quota_override,
  cs.email_quota_override,
  COALESCE(cs.sms_addon_monthly, 0)   AS sms_addon_monthly,
  COALESCE(cs.email_addon_monthly, 0) AS email_addon_monthly,
  cs.sms_blocked,
  cs.email_blocked
FROM company_subscriptions cs
JOIN plans p ON p.id = cs.plan_id
WHERE cs.company_id = '{{ $json.company_id }}'
  AND cs.status = 'active'
```

Add a Function node after the Supabase read:

```javascript
const d = $input.first().json

const smsTotalQuota = d.sms_quota_override !== null
  ? d.sms_quota_override
  : (d.sms_quota_monthly + d.sms_addon_monthly)

const emailTotalQuota = d.email_quota_override !== null
  ? d.email_quota_override
  : (d.email_quota_monthly + d.email_addon_monthly)

return [{
  json: {
    ...d,
    sms_total_quota:   smsTotalQuota,
    email_total_quota: emailTotalQuota,
  }
}]
```

The downstream IF node should compare against `sms_total_quota` / `email_total_quota` instead of `sms_quota_monthly`.

---

## 80% Usage Notification

Add a scheduled trigger (every hour) that:
1. Queries companies where `sent_count / total_quota >= 0.80` for the current period
2. Checks if notification already sent this period (use a `sms_80_notif_sent_at` column on usage tables or a simple flag)
3. If not yet notified, sends email to company owner:
   - Subject: "Porabili ste 80% mesečne SMS kvote"
   - Body: current usage, remaining, link to `/nastavitve/addoni`
