# Decisions

Settled choices, so they don't get re-litigated. Newest first. Add an entry when something significant is decided.

| Date | Decision | Why |
|---|---|---|
| 2026-10-25 | Security & legal baseline: admin flag only via console/admins; AI routes need a real signed-in account with per-person limits and server-built prompts; sign-out wipes the device; in-app account deletion; Terms/Privacy/Health Data Notice with a consent screen (13+, separate health-data consent) for every user, re-asked when `LEGAL.version` changes. Support email is the owner's Gmail for now. | Security review found self-promotion to admin (could expose everyone's health logs), an open paid AI proxy, and cross-account leaks on shared devices; health-data laws (WA MHMDA, FTC HBNR, CA) and the App Store require these. |
| 2026-10-25 | Meals log one entry per food; AI search answers are cached on the device for 30 days; every food shows where its numbers came from. | User-review research: people distrust numbers that change and can't fix one item in a meal. |
| 2026-10-24 | Plan to reach the App Store by wrapping the web app with Capacitor before any native rewrite. Account deletion and a privacy policy come first. | Weeks instead of months; one codebase; Apple requires in-app account deletion. |
| 2026-10-23 | Goals opens on one overview (every target editable in place); "Start fresh" offers Clear today and Redo setup. No unlabeled Reset. | A first-time user couldn't find how to change or restart goals. |
| 2026-10-23 | Typed meals split into separate foods, reviewed and added together. Servings are a stepper with no upper limit. | User test: people type whole meals and need more than 2 servings. |
| 2026-10-23 | Photos go to `qwen/qwen3.8-27b`; text stays on `openai/gpt-oss-120b`. | gpt-oss can't read images; that broke the camera. |
| 2026-10-22 | Food logging is one step: search or scan → pick → adjust servings and label values → add. Logged foods become "Eaten before". | Adding a food one metric at a time was impractical. |
| 2026-10-21 | "+" on a nutrition row opens an any-amount field; "−" undoes the last add for that row. | Fixed steps (+100, +10) were useless in practice. |
| 2026-10-21 | One shared theme (`lib/theme.js`) and chrome (`AppChrome.js`) for every screen. Metric and category colors come from position, not saved colors. | The whole app should look like one product, including old saved data. |
| 2026-10-14 | Design direction: calm, glanceable, minimal; each tracker row is its own progress bar; animated water card. | The original felt "vibe coded" and hard to read. |
| 2026-08 | Past-day edits always write to that day. | Data-loss bugs where edits landed on the wrong day. |
