# Supabase/Vercel PR and Quest Detail Troubleshooting

## What caused the `quest-detail.html?id=null` failure

The browser screenshot shows the live Vercel URL loading:

```text
/quest-detail.html?id=null
```

The quest detail page then sends Supabase REST filters such as:

```text
?id=eq.null
?quest_id=eq.null
```

Because `quests.id` and `quest_comments.quest_id` are UUID fields, Postgres cannot parse the string `null` as a UUID and Supabase returns HTTP 400. Community reports for similar Supabase/Postgres errors describe the same root cause: a UUID filter receives an empty, `null`, `NaN`, or otherwise invalid string instead of a real UUID.

## Code-side fix included in this branch

- `quest-board.js` now stores the accepted quest ID before closing the modal. Closing the modal resets `selectedQuestId`, which is why the redirect became `id=null`.
- `quest_detail_controller.js` now validates the `id` query parameter before making Supabase queries, so bad links do not trigger UUID 400 errors.

## If Vercel still shows the old behavior after merge

1. Confirm the PR branch includes the latest committed files.
2. In Vercel, open the project deployment page and redeploy the latest commit from the target branch.
3. Hard-refresh the site or clear browser cache, because this app serves plain static `.js` files that may be cached by the browser/CDN.
4. Open a quest from the Quest Board and verify the URL contains a real UUID, for example:

```text
quest-detail.html?id=00000000-0000-4000-8000-000000000000
```

Do not manually open `quest-detail.html?id=null`.

## If comments still fail after the URL is fixed

Run this in Supabase SQL Editor to verify the foreign key name used by `quest_detail_controller.js`:

```sql
select
  tc.constraint_name,
  kcu.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and kcu.table_name = 'quest_comments';
```

The code expects this relationship:

```text
quest_comments.user_id -> user_profiles.user_id
constraint name: quest_comments_user_id_fkey
```

If your Supabase database has a different constraint name, update the select relationship in `quest_detail_controller.js` or recreate the constraint with the expected name.

## If GitHub/Vercel PR creation does not happen

This code change cannot directly create GitHub pull requests from inside the deployed web app. If your PR is not being created in GitHub/Vercel:

1. Push this branch to GitHub.
2. Open GitHub and create the pull request against the deployment branch.
3. Check Vercel's Git Integration settings for the repository.
4. Ensure Vercel has permission to create preview deployments for pull requests from this repository/organization.
5. If the PR comes from a fork, check Vercel's fork protection and environment variable exposure settings.

This file is intentionally separate so you can copy/paste the Supabase/Vercel checklist without changing runtime app behavior.
