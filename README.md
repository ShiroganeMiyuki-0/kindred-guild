# Kindred Guild

Fairy Tail-inspired guild board website where users can:

- Join and post quests/jobs/tasks.
- Set missions as free (`$0`) or paid.
- Accept and complete posted quests.
- Apply a guild fee percentage for paid missions so the platform owner earns revenue.

## Deploy on GitHub Pages (no local runtime required)

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

- This is a static front-end app (`index.html`, `styles.css`, `app.js`), so GitHub Pages works out of the box.
- Current data is in-memory only (refreshing the page resets quests).
