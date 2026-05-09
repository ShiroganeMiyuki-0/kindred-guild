# Kindred Guild

Fairy Tail-inspired guild board website where users can:

- Join and post quests/jobs/tasks.
- Set missions as free (`$0`) or paid.
- Accept and complete posted quests.
- Apply a guild fee percentage for paid missions so the platform owner earns revenue.

## Run it on GitHub (no local setup)

You can host this project for free with **GitHub Pages**.

### 1) Push this repo to GitHub

If you have not pushed yet:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin work
```

> Replace `<your-username>` and `<your-repo>` with your actual GitHub values.

### 2) Turn on GitHub Pages

1. Open your repository on GitHub.
2. Go to **Settings** → **Pages**.
3. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `work` (or `main` if you merge there)
   - **Folder**: `/ (root)`
4. Click **Save**.

### 3) Open your live site

After ~1–2 minutes, GitHub will publish your site at:

```text
https://<your-username>.github.io/<your-repo>/
```

## Notes

- This is a static front-end app (`index.html`, `styles.css`, `app.js`), so GitHub Pages works out of the box.
- Current data is in-memory only (refreshing the page resets quests).
