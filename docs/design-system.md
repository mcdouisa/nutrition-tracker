# Design system

Lytz should feel clean, calm and quick: one quiet palette, big readable numbers, and color only where it means something. The Today screen is the reference; every other screen should look like it belongs next to it.

## Tokens (always from `lib/theme.js`)
| Token | Dark | Use |
|---|---|---|
| `bg` | `#0B0C0E` | Page background |
| `card` | `#15171A` | Cards, rows |
| `card2` | `#1D2024` | Fields, buttons and chips inside cards |
| `border` | `#25282D` | 1px dividers between rows |
| `text` | `#F2F3F5` | Main text; selected pills |
| `soft` | `#B4B8BF` | Secondary text, labels |
| `muted` | `#8B9098` | Hints, units, section labels |
| `faint` | `#5A5F66` | Empty markers only (not readable text) |
| `DONE` | `#B8F06A` | Goal reached; the single main action on a screen. Text on it is `#0B0C0E`. |
| `OVER` | `#FF6B3D` | Over a limit; destructive actions |
| `WATER` | `#2E7BD6` | Water only |
| `hues` | 6 calm colors | Telling metrics and categories apart, by position |

Light mode has matching tokens in `LIGHT`. New screens use the tokens, so they get both modes.

## Type
- Geist (body and numbers), Geist Mono only for timers. Tabular figures.
- Sizes: big numbers 24–52px weight 500; titles 18–22px weight 500; body 15–16px; labels and hints 13px.
- Sentence case everywhere: "Add a habit", "Daily targets". Never ALL CAPS, never wide letter-spacing.

## Layout and parts
- **Screen:** sticky `PageHeader` (title, optional back, right-side actions) + content (max 600px, 16px side padding) + `AppTabBar`. Leave `TAB_BAR_SPACE` at the bottom.
- **Section:** a 13px `muted` label, then a card.
- **Card:** `card` color, 18px radius, no border, no shadow. Rows inside are split by a 1px `border` line.
- **Tracker row:** the row itself fills like a progress bar (`color + '24'` fill, 2px solid edge), dot + label + big number + short status ("920 left", "Done", "12 g over").
- **Choices:** pill buttons; selected = `text` background with `bg` text.
- **Numbers to edit:** small right-aligned fields (`card2`, 10px radius, select-all on focus, decimal keypad).
- **Buttons:** one `DONE` primary per screen; secondary = `card`/`card2`; add-another = dashed `border` outline. Icon buttons are 44×44.
- **Sheets:** slide up from the bottom, 24px top radius, drag handle, close button top right, primary action pinned at the bottom.
- **Feedback:** after a change, a toast with Undo; destructive actions ask first.

## Never
- Gradients, glows, colored or glowing shadows, glass effects.
- Emoji in the interface (people's own names for things are fine).
- Decorative color, tinted card borders, icons sitting in colored boxes.
- Fake data or placeholder copy in shipped screens.
- Tiny ▲▼ controls, or tap targets under 44px.

## Accessibility
- Real `<button>`, `<input>`, `<label>`, `<a>`; never click handlers on divs.
- `aria-label` on icon-only buttons; `aria-pressed` on toggles and pills; `role="dialog"` on sheets.
- Text contrast 4.5:1 (3:1 for 24px+). `faint` is never used for readable text.
- Animations respect `prefers-reduced-motion`.
