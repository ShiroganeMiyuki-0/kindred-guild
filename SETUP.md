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
| Coin Purchase | ✅ Working | UPI payment flow |
| PWA | ✅ Working | Installable as app |
| Admin Dashboard | ✅ Working | Manage quests, users, guild |
| Terms Agreement | ✅ Working | First-visit modal |
| Action History/Undo | ✅ Working | Grace window undo |
