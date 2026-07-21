# Kindred Guild — Setup Guide

## DM System Setup (Required)

The Direct Messaging feature requires database tables. Run this SQL in your Supabase dashboard:

### Steps:
1. Go to https://supabase.com/dashboard → select your project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/dm_system.sql`
5. Paste and click **Run**

This creates:
- `dm_conversations` — stores chat conversations
- `dm_participants` — who's in each conversation
- `dm_messages` — the messages themselves
- RPC functions: `get_or_create_dm`, `send_dm_message`, `get_my_conversations`
- Row Level Security policies (users can only see their own chats)
- Realtime subscription for live message delivery

### Verify it worked:
Run this in SQL Editor:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('dm_conversations', 'dm_participants', 'dm_messages');
```
Should return 3 rows.

---

## Email Notifications Setup (Optional)

The email notification system uses a Supabase Edge Function + Resend API.

### Steps:
1. Sign up at https://resend.com and get your API key
2. In Supabase Dashboard → Edge Functions → deploy `send-email`:
   ```bash
   supabase functions deploy send-email
   ```
3. Set the Resend API key:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
   ```
4. Verify your domain at Resend and update `FROM_EMAIL` in `supabase/functions/send-email/index.ts`

Without this, the app works fine — just no email notifications.

---

## Environment Variables

Make sure these are set in your Supabase project:
- `SUPABASE_URL` — your project URL
- `SUPABASE_ANON_KEY` — your public anon key (in `js/supabase-client.js`)
- `SUPABASE_SERVICE_ROLE_KEY` — used by edge functions only (never in client code)

---

## What's Built

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (magic link) | ✅ Working | No password needed |
| Quest Board | ✅ Working | Post, accept, approve, dispute |
| Escrow | ✅ Working | Coins locked until approval |
| Fairy Wishes | ✅ Working | Vote and back wishes |
| Guild Hall Chat | ✅ Working | Real-time channels |
| Direct Messages | ⚠️ Needs SQL | Run dm_system.sql |
| Leaderboard | ✅ Working | Guildmaster separated |
| Worker Posts | ✅ Working | Post availability |
| Notifications | ✅ Working | In-app notifications |
| Email Notifications | ⚠️ Needs deploy | Deploy edge function |
| Referral System | ✅ Working | Share codes, track referrals |
| Coin Purchase (UPI) | ✅ Working | Indian users, manual verify |
| Coin Purchase (PayPal) | ⚠️ Needs setup | International, manual verify |
| PWA | ✅ Working | Installable as app |
| Admin Dashboard | ✅ Working | Manage quests, users, guild |
| Terms Agreement | ✅ Working | First-visit modal |
| Action History/Undo | ✅ Working | Grace window undo |

---

## PayPal International Payments (Optional)

Adds a PayPal Smart-Buttons flow alongside the existing UPI flow so international users can buy Fairy Coins with cards / PayPal balance / local payment methods.

### 1. Run the SQL migration
Supabase Dashboard → SQL Editor → paste the contents of `migration_paypal_support.sql` → Run. This adds:
- `payment_method` column (defaults to `'upi'`, so existing UPI rows are untouched)
- PayPal-only columns: `paypal_order_id`, `paypal_capture_id`, `paypal_payer_email`, `foreign_currency`, `foreign_amount`
- Partial unique indexes so UPI refs and PayPal capture ids can't collide

### 2. Create a PayPal app
1. Sign in at https://developer.paypal.com/dashboard/
2. Go to **Apps & Credentials** → switch to **Sandbox** (for testing) or **Live** (for production)
3. Click **Create App** → name it "Kindred Guild" → copy the **Client ID** and **Secret**

### 3. Deploy the edge functions
```bash
supabase functions deploy create-paypal-order
supabase functions deploy capture-paypal-order
```

### 4. Set the secrets
```bash
supabase secrets set PAYPAL_CLIENT_ID=your_sandbox_client_id
supabase secrets set PAYPAL_CLIENT_SECRET=your_sandbox_secret
supabase secrets set PAYPAL_ENV=sandbox            # or "live" for production
supabase secrets set SITE_ORIGIN=https://kindredguild.org
```

For production later, repeat with the Live client id/secret and `PAYPAL_ENV=live`.

### 5. Paste the PayPal Client ID into the frontend
PayPal client IDs are PUBLIC, so it's safe to ship in JS.

**Option A — Edit `js/supabase-client.js`** (recommended for production):
Replace the empty string on this line:
```js
window.PAYPAL_CLIENT_ID = ''; // <-- paste your PayPal sandbox client id here
```

**Option B — Use a `<meta>` tag** (no source edit needed):
Add this to the `<head>` of `coin_purchase_ui.html` (or any page that uses PayPal):
```html
<meta name="paypal-client-id" content="YOUR_SANDBOX_OR_LIVE_CLIENT_ID">
```

**Option C — Use `localStorage`** (great for staging / quick QA without redeploying):
```js
// In the browser console on kindredguild.org:
localStorage.setItem('kg_paypal_client_id', 'YOUR_CLIENT_ID');
```

**Option D — URL parameter** (one-shot testing only — never ship a link with this):
```
https://kindredguild.org/coin_purchase_ui.html?region=paypal&paypal_client_id=YOUR_CLIENT_ID
```

The runtime resolver tries these in order: URL param → localStorage → `<meta>` tag → hardcoded value. First non-empty match wins. All four accept only `[A-Za-z0-9_-]{20,}` so a malformed value can't accidentally become the client id.

### 6. Tune the USD prices (optional)
Open `coin_purchase_js_logic.js` and edit the `BASE_USD_PRICES` map. Default base prices:
- 100 FC = $1.20
- 200 FC = $2.40
- 500 FC = $6.00
- 1000 FC = $12.00

These are the BASE values (the fair USD equivalent of the coins). The amount the international user is **actually charged** is computed at runtime by `computeChargeUsd()` so that, after PayPal's 4.4% + $0.30 processing fee, you keep a 10% platform margin on top of the base. Example for 100 FC:
- Base: $1.20
- PayPal fee: ~$0.38
- Platform margin (10%): ~$0.12
- **User pays: ~$1.70** (this is what shows on the PayPal button)
- You receive: ~$1.32 (= base + margin)

If you change `BASE_USD_PRICES`, **also update the matching `BASE_USD_PRICES` map in `supabase/functions/create-paypal-order/index.ts`** — the server recomputes the charge from its own copy and ignores the client-supplied `amount_usd` to prevent users from paying $0.50 for 1000 FC.

To change the fee assumptions (PayPal rate, platform margin), edit `PAYPAL_FEE_PERCENT`, `PAYPAL_FIXED_FEE_USD`, and `PLATFORM_PROFIT_MARGIN` in BOTH `coin_purchase_js_logic.js` AND the create-paypal-order edge function.

### 7. Test the flow
1. Visit https://www.sandbox.paypal.com/ and create a sandbox buyer account
2. Open `coin_purchase_ui.html?region=paypal` in your app
3. Click the gold PayPal button → log in with the sandbox buyer → complete payment
4. The purchase should appear in the **Admin Dashboard → Coin Purchases** tab with a blue **PayPal** badge
5. Approve it → coins land in the user's `fairy_ledger` (same flow as UPI)

### Notes
- **Manual admin approval is reused** for PayPal, just like UPI. The capture happens on the server, but coins don't credit until you click Approve in the admin dashboard. This keeps the workflow consistent across both payment methods.
- **No webhooks yet.** If a user's network drops between PayPal capture and our insert, the row may be missing — the capture edge function is idempotent and will return `already_logged: true` on retries, so worst case the user reopens the page and we re-attempt the insert (which will succeed thanks to the partial unique index on `paypal_capture_id`).
- **Minimum charge:** PayPal requires at least $0.50 USD per transaction. The smallest package is $1.20 so this is fine.
