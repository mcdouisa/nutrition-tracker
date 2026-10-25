# Status

Where Lytz stands right now, so any assistant can pick up the work. Update this at the end of every piece of work: move finished items to "Live", add anything new to "Open".

_Last updated: 2026-10-25 (security & legal hardening)_

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

## Ready to ship (branch `quick-wins`, waiting for the owner)
- **A. Where numbers come from:** search results, the food sheet, meal rows and logged entries say "AI estimate", "AI estimate from photo", "From barcode" or "Your numbers" (after edits). Entries store an optional `source` field.
- **B. Same search, same numbers:** food-search answers are remembered on the device for 30 days (`lytz-food-search-cache`, max 150), keyed by the search text and tracked metrics. Fewer AI calls too.
- **C. Meals stay itemized:** a meal logs one entry per food (optional `logId` / `mealId` fields); each can be removed from Entries; the toast's Undo removes the whole meal. Single foods also log this way.
- **D. Rep ranges:** "6-8" is no longer turned into 68 reps (which was also written back into the program and could trigger false "add weight" suggestions). Ranges show as the hint; only typed reps are logged.

## Ready to ship (branch `security-hardening`, waiting for the owner)
**Blockers before shipping:** set `LEGAL.contactEmail` in `lib/legal.js`; deploy `firestore.rules` in Firebase (before or together with the app).
- Firestore rules: nobody can make themselves admin; group codes create-once; membership changes only by yourself; join flow fixed; feedback readable/deletable by its author.
- Sign-out waits for offline changes, then wipes all Lytz data and the on-device database copy; leftover device data is only copied into an account after asking.
- AI routes require a signed-in (non-anonymous) account (jose), 60/hour and 300/day per person per server instance, server-built prompts, size caps, generic errors.
- Security headers (no framing, nosniff, referrer, permissions, HSTS); one sign-in error message; reset doesn't reveal accounts; Open Food Facts credit.
- Delete account and data (App settings), or delete device data without an account.
- Terms, Privacy Policy, Consumer Health Data Notice (`/terms`, `/privacy`, `/health-data`); consent screen with 13+ age confirmation for everyone, existing users included (`legalAcceptedVersion` on the profile; bump `LEGAL.version` to ask again); "not medical advice" notes.
- Dependencies: `npm audit fix` (next 16.4.3). Remaining advisory: server-only gRPC inside firebase (fix would be a downgrade).

## Owner to-do (outside the code)
- Firebase console → `userProfiles`: check nobody unexpected has `isAdmin: true` (the old rules let anyone set it).
- Groq console: set a monthly spend cap.
- Firebase Auth settings: turn on email enumeration protection; set a password policy (8+ characters).
- Have a lawyer review the legal pages, especially the Washington health-data notice.

## Needs checking by the owner on a real phone
- Real AI food search and whole-meal splitting (only tested with stand-in results locally; the Groq key exists only on Vercel).
- Real photo reading of food and nutrition labels with the new vision model.

## Open
- **From the review-research plan, not started:** (4) "Eaten before" synced across devices (new Firestore field, L1.4), subtract-an-ingredient; (5) "Fix this" on logged foods (L1.1). Later: "What should I eat for the rest of today?" (AI cost, L6.1) and a 3-question setup.
- **Offline caveat:** editing a past day you haven't opened before needs a connection the first time (the day isn't cached yet).
- **App Store (plan agreed, not started):** wrap the web app with Capacitor. First: in-app account deletion (required by Apple) and a privacy policy page. Then native camera/barcode, push reminders, optionally Apple Health. Needs an Apple Developer account ($99/yr).
- **Old "68" reps:** programs logged before fix D may already have "68" saved where "6-8" was. Can't be told apart from a real 68 automatically; the owner can fix those in the program editor.
- **"Eaten before"** is stored per device (`lytz-recent-foods` in localStorage), so phone and computer keep separate lists. Syncing it would need a new Firestore field (ask first, rule L1.4).
- **Vercel previews** are behind Vercel login (Deployment Protection). The owner chose to leave it on for now.
- **Admin page** (`app/admin`) still uses its own old light theme. Internal only.
- A long-standing local change to `package-lock.json` is uncommitted in the owner's checkout. Leave it alone unless asked.

## How to pick up
1. Read `AGENTS.md`, then the rest of `docs/`.
2. `git switch main && git pull`, then create a branch for your task.
3. Run locally: `NEXT_PUBLIC_FIREBASE_API_KEY='' npx next dev -p 3123` (see `docs/testing.md` for sample data).
4. Ship only when the owner says so: fast-forward `main` and `staging`, push, confirm the Vercel production deploy.
