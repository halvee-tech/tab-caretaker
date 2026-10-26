# Chrome Web Store assets

Upload these files in the Chrome Web Store Developer Dashboard:

- `icon-128.png`: store icon, 128×128 PNG.
- `screenshots/01-duplicate-guard.png`: duplicate detection and cleanup, 1280×800.
- `screenshots/02-tab-groups.png`: grouped and ungrouped side-panel view, 1280×800.
- `screenshots/03-local-archive.png`: local archive and restore, 1280×800.
- `screenshots/04-adaptive-theme.png`: light and dark theme support, 1280×800.
- `promo-small-440x280.png`: optional small promotional tile.
- `promo-marquee-1400x560.png`: optional marquee promotional image.

The screenshots use real extension captures from `.impeccable/review/` inside a branded browser frame. Re-render them whenever the product UI materially changes.

## Reproducing the PNGs

Serve the repository root over HTTP so `source/render.html` can resolve `design/icon-source.svg` and the captures in `.impeccable/review/`:

```sh
python3 -m http.server 4173
```

Capture the full viewport at the exact size shown below, with browser chrome omitted:

| Output | URL | Viewport |
| --- | --- | --- |
| `screenshots/01-duplicate-guard.png` | `http://127.0.0.1:4173/store-assets/source/render.html?scene=duplicate` | 1280×800 |
| `screenshots/02-tab-groups.png` | `http://127.0.0.1:4173/store-assets/source/render.html?scene=groups` | 1280×800 |
| `screenshots/03-local-archive.png` | `http://127.0.0.1:4173/store-assets/source/render.html?scene=archive` | 1280×800 |
| `screenshots/04-adaptive-theme.png` | `http://127.0.0.1:4173/store-assets/source/render.html?scene=themes` | 1280×800 |
| `promo-small-440x280.png` | `http://127.0.0.1:4173/store-assets/source/render.html?scene=promo-small` | 440×280 |
| `promo-marquee-1400x560.png` | `http://127.0.0.1:4173/store-assets/source/render.html?scene=promo-marquee` | 1400×560 |

Create the padded store icon from the shipped 128px icon while preserving transparency:

```sh
ffmpeg -i public/icon/128.png \
  -vf 'scale=96:96:flags=lanczos,pad=128:128:16:16:color=black@0' \
  -frames:v 1 store-assets/icon-128.png
```

The `?scene=icon` route remains available as a visual preview. Keep transparency enabled for `icon-128.png`; the screenshot and promotional outputs use opaque backgrounds.
