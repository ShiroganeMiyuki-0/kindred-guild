# Kindred Guild

Fairy Tail-inspired guild board website where members can post free or paid quests, accept work, confirm completion, rate each other, and track a small guild fee on paid missions.

## What works today

- Supabase email/password authentication.
- Persistent quests, comments, ratings, strikes, and Fairy Coin ledger rows through Supabase tables.
- Free quests and paid UPI quests with a visible 10% guild-fee calculation.
- Quest images through a Supabase Storage bucket named `quest-images`.
- A basic PWA manifest so the browser install button has a valid manifest file.

## Production/business readiness

This code can become a real deployed MVP, but it is **not yet a fully safe profit-making marketplace**. Before charging real users, prioritize these changes:

1. **Use a proper payment flow.** UPI IDs and manual confirmation are fine for a prototype, but platform revenue needs verifiable payment collection, fee splitting, refunds, and dispute handling through a payment provider or escrow-like backend.
2. **Move business rules to a backend.** The current fee percentage, admin email, strike logic, and Fairy Coin accounting are browser-side. A real marketplace should enforce these rules with server-side functions, database constraints, and audit logs.
3. **Tighten Supabase security.** The included `supabase-schema.sql` now has improved RLS policies, but it still allows authenticated users to mint "system" Fairy Coins (ledger rows where `from_user` is null). In a real production app, this logic MUST be moved to a secure backend (Supabase Edge Functions or a Node.js server) to prevent users from manipulating their balances via the browser console.
4. **Add identity, trust, and moderation.** Paid work needs user profiles, KYC/verification if required in your region, dispute workflows, abuse reporting, admin review screens, and clear terms/privacy pages.
5. **Add conversion features.** To become profitable, add landing-page copy for a specific niche, featured quests, paid boosts, subscriptions for power users, invoice/receipt emails, and analytics for funnel tracking.

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase-schema.sql`.
3. Create a public Storage bucket named `quest-images`.
4. Enable email/password authentication in Supabase Auth.
5. Replace `SUPABASE_URL` and `SUPABASE_KEY` in `app.js` with your own project's public anon settings.

> Important: the anon key is public by design, but your database must be protected by row-level security policies.

## Deploy on GitHub Pages

### 1) Push your code to GitHub

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

### 2) Enable GitHub Pages

1. Open your repository on GitHub.
2. Go to **Settings** → **Pages**.
3. In **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
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
