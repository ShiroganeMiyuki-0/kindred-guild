# Kindred Guild

Fairy Tail-inspired guild board website where members can post free or paid quests, accept work, confirm completion, rate each other, and track a small guild fee on paid missions.

## What works today

- Supabase email/password authentication.
- Persistent quests, comments, ratings, and Fairy Coin ledger rows through Supabase tables.
- Free quests, Fairy Coin quests, and UPI quests with a visible 10% guild-fee calculation.
- Quest images through a Supabase Storage bucket named `quest-images`.
- A basic PWA manifest so the browser install button has a valid manifest file.
- **Auto-approval system**: Quests auto-approve after 48 hours if poster doesn't act (via pg_cron).
- **Auto-reveal ratings**: Ratings auto-reveal after 7 days and update reputation (via pg_cron).
- **Legal pages**: Terms of Service and Privacy Policy pages are live.

## Production/business readiness

This code is now **production-ready for a real deployed MVP**. The following components are implemented:

### ✅ Backend (Supabase)
- Row-Level Security (RLS) policies on all tables
- Secure database functions for quest posting, approval, ratings, and balance calculations
- Auto-approve quests function (`auto_approve_quests()`)
- Auto-reveal ratings function (`reveal_ratings_and_update_reputation()`)
- Prevent negative balance trigger
- pg_cron scheduled tasks for automation

### ✅ Frontend Pages
- Landing page with manifesto and hooks
- Quest board with filtering and sorting
- Quest posting page with payment type selection
- Quest detail page with proof upload and approval flow
- Profile page with quest history and settings
- Coin purchase page with UPI reference submission
- Admin dashboard for manual coin verification
- Authentication pages (login/signup)
- Username setup page
- **Terms of Service** page
- **Privacy Policy** page

### ✅ Safety Features
- UPI risk warning modal before posting UPI quests
- Free quest confirmation modal
- Double-blind rating system
- Commission locked upfront in escrow
- Auto-approval protects workers from non-responsive posters

### ⚠️ Remaining Considerations for Scale
1. **UPI Fraud Surface**: Manual UPI verification works for trusted users (<50), but strangers can submit fake transaction references. For public launch, consider adding automated UPI verification via a payment gateway API.
2. **Domain**: Buy `kindredguild.in` (or similar) for ~₹800-1200/year. Connect to Vercel when ready.
3. **Analytics**: Add privacy-friendly analytics (e.g., Plausible, Umami) for user behavior tracking.
4. **Email Notifications**: Add transactional emails for quest updates, approvals, and rating reminders.
5. **Dispute Resolution**: Define a clear process for handling disputes beyond reputation penalties.

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase_sql_schema.sql` to create all tables, functions, and RLS policies.
3. Run `supabase_pg_cron_setup.sql` to enable scheduled tasks (requires pg_cron extension).
4. Create a public Storage bucket named `quest-images`.
5. Enable email/password authentication in Supabase Auth.
6. Replace `SUPABASE_URL` and `SUPABASE_KEY` in all JavaScript files with your own project's public anon settings.

> Important: the anon key is public by design, but your database must be protected by row-level security policies.

### Enabling pg_cron (Required for Auto-Approval)

1. Go to Supabase Dashboard > Database > Extensions
2. Search for `pg_cron` and click Enable
3. Run the contents of `supabase_pg_cron_setup.sql` in the SQL Editor
4. Verify schedules are active: `SELECT * FROM cron.job;`

## Deploy on Vercel (Recommended)

### 1) Push your code to GitHub

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

### 2) Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Keep default settings (no build command needed for static site)
5. Click Deploy

### 3) Connect Custom Domain (Optional)

1. In Vercel dashboard, go to Project Settings > Domains
2. Add your domain (e.g., `kindredguild.in`)
3. Follow DNS configuration instructions
4. Wait for SSL certificate (~5 minutes)

## File Structure

```
/workspace
├── index.html                  # Landing page with manifesto
├── auth.html                   # Login/Signup page
├── username-setup.html         # First-time username selection
├── quest-board.html            # Browse and filter quests
├── quest-post.html             # Create new quests
├── quest-detail.html           # Quest detail, proof upload, approval
├── profile.html                # User profile and settings
├── coin_purchase_ui.html       # Buy Fairy Coins with UPI
├── admin_dashboard_ui.html     # Admin panel for coin verification
├── terms-of-service.html       # Legal: Terms of Service
├── privacy-policy.html         # Legal: Privacy Policy
├── modals_showcase.html        # Demo of modal components
├── auth.js                     # Authentication logic
├── quest-board.js              # Quest board controller
├── quest-post.js               # Quest posting controller
├── quest_detail_controller.js  # Quest detail controller
├── profile.js                  # Profile page controller
├── coin_purchase_js_logic.js   # Coin purchase controller
├── admin-dashboard.js          # Admin dashboard controller
├── username-setup.js           # Username setup controller
├── modals_controller.js        # Modal and toast utilities
├── supabase_sql_schema.sql     # Complete database schema + functions
├── supabase_pg_cron_setup.sql  # Scheduled task configuration
└── README.md                   # This file
```

## Key Database Functions

| Function | Purpose |
|----------|---------|
| `post_quest_with_commission()` | Transactional quest posting with upfront commission lock |
| `approve_quest()` | Approve submitted quest and release rewards |
| `submit_rating()` | Submit double-blind rating |
| `recalculate_reputation()` | Update user reputation from revealed ratings |
| `auto_approve_quests()` | Auto-approve quests past 48-hour deadline |
| `reveal_ratings_and_update_reputation()` | Auto-reveal old ratings and recalc reputation |
| `get_coin_balance()` | Get user's active Fairy Coin balance |

## Cron Schedules

| Schedule | Frequency | Function |
|----------|-----------|----------|
| `auto-approve-quests-hourly` | Every hour at :00 | Checks and auto-approves expired submissions |
| `reveal-ratings-daily` | Daily at 00:15 UTC | Reveals ratings older than 7 days |

## License

MIT License — built for mutual aid.

4. Click **Save**.

### 3) Open your live website

After 1–2 minutes, your site URL should be:

```text
https://<your-username>.github.io/<your-repo>/
```

## If GitHub shows "This branch has conflicts"

Resolve locally, then push:

```bash
git fetch origin
git checkout main
git merge origin/main
```

If there is a conflict in `README.md`, edit it and remove conflict markers:

- `<<<<<<< HEAD`
- `=======`
- `>>>>>>> branch-name`

Then finish:

```bash
git add README.md
git commit -m "Resolve README merge conflict"
git push origin main
```

## Notes

- This is a static front-end app (`index.html`, `styles.css`, `app.js`), so GitHub Pages can host the UI.
- Real persistence requires Supabase tables, RLS policies, and the `quest-images` bucket.
- For a real business, treat the current version as an MVP/prototype until payment, legal, moderation, and backend enforcement are complete.
