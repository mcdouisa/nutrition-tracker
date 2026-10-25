# Status

Where Lytz stands right now, so any assistant can pick up the work. Update this at the end of every piece of work: move finished items to "Live", add anything new to "Open".

_Last updated: 2026-10-25_

## Live (on `main`, deployed to production)
- **Redesign across the whole app:** shared theme and tab bar; Today screen with tracker rows that fill like progress bars, animated water card, "Eaten before" chips.
- **One-step food logging:** "What did you eat?" bar → search one food or type a whole meal → pick → adjust servings (stepper, no cap) and per-serving label values → add. Every metric updates together; Undo toast after.
- **Barcode scan and photo** go straight into the food sheet. Photos use Groq's vision model (`qwen/qwen3.8-27b`).
- **Goals:** one overview with every target editable in place; Habits, Nutrients, Water, Saved meals, Feedback and App settings restyled; "Start fresh" offers Clear today and Redo setup.
- **Project rules:** `AGENTS.md` (locked rules), `docs/`, Claude Code guards in `.claude/`.

## Ready to ship (branch `trust-and-safety`, waiting for the owner)
- **Trustworthy numbers:** decimals kept in totals and manual entries; setting a total is logged as the difference, so log, Undo and totals agree; Firestore keeps an on-device copy so offline edits survive.
- **Goal guardrails:** calories under 500 block Save; under 1,200 / over 5,000 calories, over 400 g protein, and water under 16 oz / over 300 oz warn.
- **Forgiving streaks:** only days with real logging count; one missed day in any 7 is forgiven.
- **CSV export:** Reports → Export → "Download all days (CSV)", built on the device.

## Needs checking by the owner on a real phone
- Real AI food search and whole-meal splitting (only tested with stand-in results locally; the Groq key exists only on Vercel).
- Real photo reading of food and nutrition labels with the new vision model.

## Open
- **From the review-research plan, not started:** (4) meals logged as separate foods that can be removed one by one, "Eaten before" synced across devices (new Firestore field, L1.4), subtract-an-ingredient; (5) label AI vs label/barcode numbers, remember AI answers so the same search gives the same numbers, "Fix this" on logged foods. Later: "What should I eat for the rest of today?" (AI cost, L6.1) and a 3-question setup.
- **Offline caveat:** editing a past day you haven't opened before needs a connection the first time (the day isn't cached yet).
- **App Store (plan agreed, not started):** wrap the web app with Capacitor. First: in-app account deletion (required by Apple) and a privacy policy page. Then native camera/barcode, push reminders, optionally Apple Health. Needs an Apple Developer account ($99/yr).
- **Bug:** on the workout logging screen a rep range like "6-8" shows as "68". Existing bug, not caused by the redesign.
- **"Eaten before"** is stored per device (`lytz-recent-foods` in localStorage), so phone and computer keep separate lists. Syncing it would need a new Firestore field (ask first, rule L1.4).
- **Vercel previews** are behind Vercel login (Deployment Protection). The owner chose to leave it on for now.
- **Admin page** (`app/admin`) still uses its own old light theme. Internal only.
- A long-standing local change to `package-lock.json` is uncommitted in the owner's checkout. Leave it alone unless asked.

## How to pick up
1. Read `AGENTS.md`, then the rest of `docs/`.
2. `git switch main && git pull`, then create a branch for your task.
3. Run locally: `NEXT_PUBLIC_FIREBASE_API_KEY='' npx next dev -p 3123` (see `docs/testing.md` for sample data).
4. Ship only when the owner says so: fast-forward `main` and `staging`, push, confirm the Vercel production deploy.
