# Contributing

## Every change

1. Edit the source in `src/` (never edit `dist/` by hand).
2. Add an entry to **[CHANGELOG.md](CHANGELOG.md)** under the next version, in the same commit: what changed and why, in plain words.
3. Run `python3 build.py`, which regenerates `dist/Flipbook-Studio.html`. Commit that file too.

## Compatibility

Never break older data: fields are additive only, and old shapes are upgraded in `exporter.normalize()` / `app.loadDraft()`. See *Compatibility rules* in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). `tests/compat.mjs` must pass.

## Before a release

```bash
npm test          # build + end-to-end tests in Chromium, Firefox, WebKit
npm run scan      # no personal paths, secrets, or emails anywhere in the repo or its history
```

Then bump the version in CHANGELOG.md, tag it, and attach `dist/Flipbook-Studio.html` to a GitHub release named `vX.Y.Z`. The README download link always points to the latest release.

## Where things live

See the *Project layout* section in the [README](README.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
