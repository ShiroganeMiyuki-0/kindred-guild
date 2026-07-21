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
   supabase functions deploy send-email --project-ref owpyqeubmfvtuqjaxauo
   ```
3. Set the Resend API key:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx --project-ref owpyqeubmfvtuqjaxauo
   ```
4. Verify your domain at Resend (https://resend.com/emails → Domains tab) — must verify `kindredguild.org` so the `FROM_EMAIL` (`notifications@kindredguild.org`) is allowed to send.

Without this, the app works fine — just no email notifications.

---

## Auto-Approve Cron (Optional but recommended)

Auto-approves quests after the 48-hour proof window, and reveals blinded ratings after 7 days.

```bash
supabase functions deploy auto-approve-cron --project-ref owpyqeubmfvtuqjaxauo
```

Then schedule it via Supabase pg_cron (see `supabase_pg_cron_setup.sql` for the SQL).

---

## Environment Variables

Make sure these are set in your Supabase project:
- `SUPABASE_URL` — your project URL (auto-set by Supabase)
- `SUPABASE_ANON_KEY` — your public anon key (auto-set, also hardcoded in `js/supabase-client.js`)
- `SUPABASE_SERVICE_ROLE_KEY` — used by edge functions only (auto-set, never in client code)

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
| Email Notifications | ⚠️ Needs deploy | Deploy send-email + RESEND_API_KEY |
| Referral System | ✅ Working | Share codes, track referrals |
| Coin Purchase (UPI) | ✅ Working | Indian users, manual verify |
| Coin Purchase (PayPal) | ✅ Manual flow | International, PayPal.me QR + manual verify |
| PWA | ✅ Working | Installable as app |
| Admin Dashboard | ✅ Working | Manage quests, users, guild |
| Terms Agreement | ✅ Working | First-visit modal |
| Action History/Undo | ✅ Working | Grace window undo |

---

## PayPal International Payments (Manual QR Flow)

International users scan a PayPal.me QR code (or click a link), pay in their PayPal app, then click "I've Paid — Log My Purchase" — exactly like the UPI flow. Admin verifies manually in the dashboard.

### 1. Run the SQL migration (one-time)
Supabase Dashboard → SQL Editor → paste the contents of `migration_paypal_support.sql` → Run. This adds:
- `payment_method` column (defaults to `'upi'`, so existing UPI rows are untouched)
- PayPal-only columns: `paypal_order_id`, `paypal_capture_id`, `paypal_payer_email`, `foreign_currency`, `foreign_amount`

### 2. Get a PayPal.me link
1. Sign in at https://www.paypal.com/paypalme/
2. Click **Claim your PayPal.me link** (or use your existing one)
3. Pick a username (e.g. `yashwanthrangaswamy72`)
4. Your link will be `https://paypal.me/yashwanthrangaswamy72`

### 3. Paste your PayPal.me username into the frontend

Pick ONE of these four methods (Option A is best for production):

**Option A — Edit source** (recommended):
```js
// js/supabase-client.js, around line 50
window.PAYPAL_ME_USERNAME = 'your-paypal-me-username';
```

**Option B — `<meta>` tag** (no source edit):
```html
<!-- in coin_purchase_ui.html <head> -->
<meta name="paypal-me-username" content="your-paypal-me-username">
```

**Option C — `localStorage`** (great for staging / quick QA without redeploying):
```js
// In the browser console on kindredguild.org:
localStorage.setItem('kg_paypal_me_username', 'your-paypal-me-username');
```

**Option D — URL parameter** (one-shot testing only — never ship a link with this):
```
https://kindredguild.org/coin_purchase_ui.html?region=paypal&paypal_me=your-username
```

The runtime resolver tries these in order: URL param → localStorage → `<meta>` tag → hardcoded value. First non-empty match wins. All four accept only `[A-Za-z0-9_-]{3,50}` so a malformed value can't accidentally become the username.

### 4. Tune the USD prices (optional)
Open `coin_purchase_js_logic.js` and edit the `BASE_USD_PRICES` map. Default base prices:
- 100 FC = $1.20
- 200 FC = $2.40
- 500 FC = $6.00
- 1000 FC = $12.00

These are the BASE values (the fair USD equivalent of the coins). The amount the international user is **actually asked to pay** is computed at runtime by `computeChargeUsd()` so that, after PayPal's 4.4% + $0.30 processing fee, you keep a 10% platform margin on top of the base. Example for 100 FC:
- Base: $1.20
- PayPal fee: ~$0.38
- Platform margin (10%): ~$0.12
- **User pays: ~$1.70** (this is what shows on the PayPal.me link/QR)
- You receive: ~$1.32 (= base + margin)

To change the fee assumptions (PayPal rate, platform margin), edit `PAYPAL_FEE_PERCENT`, `PAYPAL_FIXED_FEE_USD`, and `PLATFORM_PROFIT_MARGIN` in `coin_purchase_js_logic.js`.

### 5. Test the flow
1. Open `coin_purchase_ui.html?region=paypal` on your site
2. The PayPal.me link + QR code should display with the correct amount pre-filled
3. Click "Open PayPal.me to Pay" (or scan the QR with your phone) → pay in PayPal
4. Click "I've Paid — Log My Purchase"
5. The purchase appears in **Admin Dashboard → Coin Purchases** with the **PayPal** badge
6. Approve it → coins land in the user's `fairy_ledger` (same flow as UPI)

### Notes
- **No PayPal SDK / API keys needed.** This is a pure manual flow — no server-side capture, no webhooks, no edge functions to deploy for PayPal. Just the PayPal.me username in the frontend.
- **Manual admin verification is reused** for PayPal, just like UPI. Coins don't credit until you click Approve in the admin dashboard.
- **Optional PayPal email / transaction ID field** lets the buyer enter their PayPal email or txn id so you can match payments faster in your PayPal dashboard.
- **The PayPal.me link uses `https://www.paypal.com/paypalme/<username>/<amount>`** (the canonical form). PayPal.me also accepts `https://paypal.me/<username>/<amount>` — both work, the first is just more reliable for mobile deep-linking.
