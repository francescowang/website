# Francesco Wang - Personal Website

This repository contains a static personal website with dynamic content loading for portfolio data and blog posts.

## How The Website Works

The UI shell is rendered from `index.html`, while content is loaded from JSON and Markdown files at runtime.

- `index.html`: Main single-page app (About, CV, Portfolio, Blog tabs).
- `assets/js/script.js`: Loads and renders profile/CV data from JSON.
- `assets/js/blog-posts.js`: Fetches `posts-meta.json` in a single request and renders blog cards with filtering and search.
- `assets/js/view-post.js`: Fetches post metadata from `posts-meta.json` and content from markdown, then renders the post.
- `assets/data/portfolio.json`: Source of truth for About/CV/skills content.
- `assets/data/posts-meta.json`: Single source of truth for all blog metadata (slug, title, category, date, summary, tags). One entry per post.
- `blog/posts/<folder>/*.md`: Markdown files — pure content only, no frontmatter. Content is rendered via `marked.js`. Posts are organised into topic subfolders (e.g. `kubernetes/`, `aws/`).
- `blog/view.html`: Blog post viewer shell. Loads `view-post.js` which handles fetching and rendering.

## Data Flow

1. `index.html` declares data sources via body attributes:
	 - `data-portfolio-source`
	 - `data-blog-posts-source`
	 - `data-blog-viewer-path`
2. On load, `script.js` fetches `portfolio.json` and fills CV/About placeholders.
3. `blog-posts.js` fetches `posts-meta.json` (a single JSON request), sorts by date, and renders all blog cards with tag filters and search. Each card links to:
	 - `./blog/view.html?post=<slug>`
4. `view.html` loads `view-post.js`, which:
   - Reads the `post` query param
   - Parallel-fetches `posts-meta.json` (for metadata) and `blog/posts/<slug>.md` (for content)
   - Renders the post header (title, category, date, tags) from metadata
   - Renders the post body from markdown via `marked.js`

## Run Locally

Do not open `index.html` directly from file explorer (`file://...`) because `fetch()` for JSON/Markdown will fail in most browsers.

Run a static server from the repo root:

```bash
python -m http.server 4173
```

Open:

- `http://127.0.0.1:4173/`

Stop server with `Ctrl+C`.

## Edit Portfolio Content

Update this file:

- `assets/data/portfolio.json`

Sections currently rendered from it:

- `profile.about`
- `technologies`
- `experience.work`
- `experience.certifications`
- `experience.education`
- `experience.volunteering`
- `experience.hobbies`

If you change schema keys, update `assets/js/script.js` accordingly.

## Add A New Blog Post

The fastest way is the helper script, which prompts for all required fields, creates the `.md` file in the right subfolder, inserts the metadata entry at the top of `posts-meta.json`, and opens the file in your editor:

```bash
python3 scripts/new-post.py
```

Or manually:

1. Add an entry to `assets/data/posts-meta.json`:

```json
{
  "slug": "your-post-slug",
  "folder": "aws",
  "title": "Your Post Title",
  "category": "AWS",
  "date": "2026-05-01",
  "summary": "One-line summary shown on the blog card.",
  "tags": ["AWS", "RDS"]
}
```

`folder` must match the subdirectory under `blog/posts/` (e.g. `kubernetes`, `aws`). Cards are sorted by `date` descending at runtime.

2. Create the markdown file **with only the post content** (no frontmatter):

- `blog/posts/<folder>/your-post-slug.md`

```markdown
Post body starts here—no frontmatter, no duplicate title needed.

## Section

More content...
```

3. Refresh browser at `http://127.0.0.1:4173/`.

The post card will appear in Blog with all metadata from `posts-meta.json` and open in the viewer showing the content from the `.md` file.

**To remove a post:** delete the `.md` file and remove its entry from `posts-meta.json`. Remaining posts are unaffected.

## Scripts & Hooks

| Script | Purpose |
|---|---|
| `python3 scripts/new-post.py` | Interactive helper — creates post file + metadata entry |
| `python3 scripts/validate-posts.py` | Checks every `posts-meta.json` slug has a matching `.md` file |
| `python3 scripts/check-links.py` | Checks internal `href` and `src` references in HTML files |
| `bash scripts/install-hooks.sh` | Installs git pre-commit hook — run once after cloning |

The pre-commit hook runs `validate-posts.py` automatically before every commit. Install it once:

```bash
bash scripts/install-hooks.sh
```

## CI

Two checks run on every PR and on pushes to `main` that touch posts or HTML:

1. **validate-posts** — every slug in `posts-meta.json` has a matching `.md` file
2. **check-links** — all internal `href`/`src` references in `index.html` and `blog/view.html` resolve to real files

See `.github/workflows/validate-posts.yml`.

## Common Issues

- Blog cards or CV sections not showing:
	- Ensure you are running with a local server (not `file://`).
- New post not visible:
	- Confirm an entry with the correct `slug` exists in `assets/data/posts-meta.json`.
	- Confirm the markdown file exists at `blog/posts/<slug>.md` (slug must match exactly).
- Viewer says "Error loading post":
	- Confirm the markdown file exists at `blog/posts/<slug>.md`.
	- Confirm the entry exists in `assets/data/posts-meta.json`.
	- Check browser console for network errors (e.g., 404 on the `.md` file or JSON).

## Deployment

The site is static and can be hosted on GitHub Pages or any static host.

**Important:** Ensure `.nojekyll` file is present at the repo root. GitHub Pages runs Jekyll by default, which would intercept your `.md` files and prevent them from being served raw to `fetch()` calls. The `.nojekyll` file tells GitHub Pages to skip Jekyll entirely.

No build step is required for the current setup.
