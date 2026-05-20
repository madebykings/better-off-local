# Better Off Local — Brand Assets

This directory is the **single source of truth** for deployed brand assets.

The `scripts/copy-brand-assets.js` script copies the contents of this directory into:
- `apps/retailer-portal/public/brand/`
- `apps/admin/public/brand/`
- `apps/mobile/assets/images/` (PNG files only)

Run the script whenever assets are updated:
```
node scripts/copy-brand-assets.js
```

## Required files

### Web (SVG)
| File | Usage |
|------|-------|
| `logo-horizontal-light.svg` | Logo on light backgrounds (white/grey) |
| `logo-horizontal-dark.svg` | Logo on dark/coloured backgrounds |
| `logo-icon-light.svg` | Square/icon-only logo on light backgrounds |
| `logo-icon-dark.svg` | Square/icon-only logo on dark backgrounds |
| `favicon.ico` | Browser tab icon |
| `icon-192.png` | PWA manifest icon (192×192) |
| `icon-512.png` | PWA manifest icon (512×512) |

### Flutter (PNG — must include 2x and 3x densities)
| Base file | 2x | 3x |
|-----------|----|----|
| `logo-horizontal-light.png` | `logo-horizontal-light@2x.png` | `logo-horizontal-light@3x.png` |
| `logo-horizontal-dark.png` | `logo-horizontal-dark@2x.png` | `logo-horizontal-dark@3x.png` |
| `logo-icon-light.png` | `logo-icon-light@2x.png` | `logo-icon-light@3x.png` |
| `logo-icon-dark.png` | `logo-icon-dark@2x.png` | `logo-icon-dark@3x.png` |

### App icon / splash (PNG)
| File | Usage |
|------|-------|
| `app-icon-1024.png` | Source for iOS/Android app icon generation |
| `splash-background.png` | Native splash screen background |

## Source artwork
Raw / editable source files live in `design-reference/brand/` and are **never deployed directly**.
Export finished assets from there into this directory.

## TODOs
- TODO: automate app icon generation from `app-icon-1024.png` (flutter_launcher_icons)
- TODO: automate PWA manifest generation from `icon-192.png` and `icon-512.png`
- TODO: automate social sharing image generation (Open Graph, Twitter Card)
