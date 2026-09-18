# Mathematical Thinking — Course Site

A puzzle-driven companion to the Mathematical Thinking book.
Built with [Astro](https://astro.build/), MDX, React (for interactive
games), and Tailwind. Math via KaTeX.

## Local development

```bash
npm install
npm run dev     # dev server at http://localhost:4321
npm run build   # produce static site in dist/
npm run preview # preview the built site
```

## Adding content

- **New sub-page in an existing chapter:** drop an `.mdx` file in
  `src/pages/<chapter>/`. Frontmatter fields: `title`, `order`,
  `chapter`, `chapterTitle`, `blurb` (optional). Use `layout:
  ../../layouts/Chapter.astro`.
- **New chapter:** create `src/pages/<chapter>/index.astro` (the hub)
  and add an entry to the `chapters` array in `src/pages/index.astro`.
- **New interactive component:** add a React file under
  `src/components/games/`, import into an `.mdx` page, and render
  with `client:visible` (or `client:load` if it must hydrate
  immediately).

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which
builds and publishes to GitHub Pages. Site will live at
`https://zacaffeinemachine.github.io/mathematical-thinking/`.

In the GitHub repo settings, ensure **Pages → Source** is set to
**GitHub Actions**.

### When a push fails with 403

The push credential is a GitHub token with an expiry date. The one in
use now was made on 2026-08-30 and lapses on **2026-11-28**. When it
does, `git push` fails like this, without prompting for anything:

```
remote: Permission to zacaffeinemachine/mathematical-thinking.git denied to zacaffeinemachine.
fatal: ... The requested URL returned error: 403
```

The absence of a username prompt is the tell. Git is reusing the dead
token saved by `credential.helper=store` rather than asking for a new
one. The fix is three steps:

1. Generate a replacement at https://github.com/settings/tokens with
   the `repo` permission ticked.
2. Throw away the saved dead one:
   `printf 'protocol=https\nhost=github.com\n\n' | git credential reject`
3. `git push`. It now asks. Username `zacaffeinemachine`, and paste the
   token as the password.

Step 2 is the one that is easy to miss. Skip it and step 3 fails again
with the same 403.

To stop this recurring, switch the remote to SSH, which never expires:
`git remote set-url origin git@github.com:zacaffeinemachine/mathematical-thinking.git`
after adding `~/.ssh/id_ed25519.pub` at https://github.com/settings/keys.
