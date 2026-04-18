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
