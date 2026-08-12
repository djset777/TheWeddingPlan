# The Wedding Plan

The command center for 7·7·27.

## What lives here

**`index.html`** — the arrival page. Countdown, portals into the two halves.

**`brief/`** — The Brief. Vision content in six chapters:
- The Look, The Flora, The Attire, The Ceremony, The Evening, The Experience.

**`dashboard/`** — The Dashboard. Operational views:
- Countdown, stats tiles, recent changes feed, plus sub-pages for The Plans (tasks), The Wedding Party, and The Day (hour-by-hour timeline).

**`assets/`** — everything shared.
- `css/base.css` — palette, typography, resets. Design tokens live at the top.
- `css/site.css` — layout, nav, cards, moment-zone bars.
- `js/countdown.js` — the 7·7·27 countdown. Reads its target from a `data-countdown` attribute in HTML.
- `js/api.js` — fetch wrapper for the Apps Script JSON API. Currently uses mock data (`USE_MOCK: true`) until the Apps Script endpoint is deployed.
- `js/main.js` — nav active-state and dashboard hydration.

## Locked design system

**Palette:** Teal `#01605F` · Forest Green `#014421` · Deep Navy `#003153` · Gold `#D4AF37` · Abyss `#0C343D` · Linen `#F2EDE6`.

**Typography:** Cormorant SC (small caps — organizes) + Cormorant Garamond (body + italic — breathes). Loaded from Google Fonts.

**Moment-zone bars:** Gold = traditions & meaning · Teal = the setting · Forest = the shape of the day.

## Wiring the API

When the Apps Script Web App is deployed:

1. Open `assets/js/api.js`.
2. Paste the deployment URL into `CONFIG.API_URL`.
3. Set `CONFIG.USE_MOCK` to `false`.

Everything downstream reads from `window.TWP.api.get(path)`.

## Deployed at

`https://djset777.github.io/TheWeddingPlan/` (once GitHub Pages is enabled from Settings → Pages).
