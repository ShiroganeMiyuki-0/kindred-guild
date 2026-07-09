# Kindred Guild

**Help your community, earn trust.**

A community task board where people post jobs and others help them out. Free or paid. Protected by escrow and reputation.

## What It Does

- **Post tasks** — describe what you need, set a reward (or make it free)
- **Accept tasks** — browse the board, find something you can help with
- **Protected payments** — coins are locked in escrow until work is approved
- **Build reputation** — every completed task builds your trust score
- **Undo mistakes** — edit, cancel, or restore tasks within a grace window

## How It Works

1. **Post** — Describe your task. Set payment type (Fairy Coins, UPI, or Free). Coins lock in escrow.
2. **Match** — A community member accepts your task. They message you, share updates, submit proof.
3. **Complete** — Review the work. Approve to release payment. Both sides rate each other.

## Payment Types

| Type | How It Works | Protection |
|------|-------------|------------|
| 🪙 Fairy Coins | Internal currency, locked in escrow | Full escrow protection |
| ₹ UPI Direct | Pay worker directly via UPI | 10% coin deposit + reputation |
| 🎁 Free | Community goodwill tasks | No payment involved |

## Trust & Safety

- **Escrow protection** — coins are held until work is verified
- **Double-blind ratings** — both sides rate after completion, hidden until both submit
- **Auto-approval** — if poster doesn't respond in 48 hours, task auto-approves
- **Dispute resolution** — both sides can file and resolve disputes
- **Reversible actions** — edit, cancel, or undo within a grace window

## Tech Stack

- **Frontend** — Static HTML/CSS/JS (no framework, no build step)
- **Backend** — Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Hosting** — Vercel (static site deployment)
- **Payments** — Fairy Coins (internal) + UPI (external)

## Setup

1. Clone the repo
2. Create a Supabase project
3. Run `supabase_sql_schema.sql` in the SQL editor
4. Run `supabase_pg_cron_setup.sql` for scheduled tasks
5. Create a public storage bucket named `quest-images`
6. Enable email auth in Supabase
7. Replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `js/supabase-client.js`
8. Deploy to Vercel

## File Structure

```
├── index.html              # Landing page
├── auth.html               # Login/signup
├── username-setup.html     # First-time username
├── quest-board.html        # Browse tasks
├── quest-post.html         # Create tasks
├── quest-detail.html       # Task workspace
├── quest-edit.html         # Edit tasks
├── worker-post.html        # Worker availability
├── profile.html            # User profile
├── fairy-wishes.html       # Community wishes
├── undo-history.html       # Action history
├── donation.html           # Support the guild
├── coin_purchase_ui.html   # Buy coins
├── trust-and-safety.html   # Trust charter
├── terms-of-service.html   # Terms
├── privacy-policy.html     # Privacy
├── css/globals.css         # Shared styles
├── js/supabase-client.js   # Shared Supabase client
├── site-nav.js             # Global navigation
├── onboarding.js           # Walkthrough
├── modals_controller.js    # Modal system
├── modals_stylesheet.css   # Modal styles
└── docs/                   # Documentation
```

## License

© 2026 Kindred Guild — ShiroganeMiyuki-0. All Rights Reserved.

This is proprietary software. Unauthorized copying, redistribution, modification, or hosting of this software is strictly prohibited. See [LICENSE](LICENSE) for full terms.

For licensing inquiries: https://github.com/ShiroganeMiyuki-0
