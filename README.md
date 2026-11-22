# ps5gamer

A phone app (PWA) for tracking PS5 games: library, reviews, a 3D front/back case viewer, and chapter-by-chapter guides with progress ticks.

## Use it
Enable GitHub Pages (Settings > Pages > Deploy from branch > `main` / root), open the URL in Safari on iPhone, then Share > Add to Home Screen.

## Add a guide
1. Create `guides/<slug>/guide.json` listing chapters (`id`, `title`, `file`).
2. Add one markdown file per chapter, plus `tips.md` for hints and cheat codes.
3. Add `{ "slug": "<slug>", "title": "Game Title" }` to `guides/index.json`.

See `guides/example-game` for a template. General tips live in `tips/general.md`.

Your library, reviews and progress are stored on the phone. Use Backup in the app to export them.
