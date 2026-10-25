# Architecture

## Stack
- **Next.js 16 (App Router), React 19.** Client components with inline styles; no CSS framework.
- **Hosting:** Vercel. `main` deploys to production; every pushed branch gets a preview (behind Vercel login).
- **Data and accounts:** Firebase Auth (email/password) and Firestore. Without an account, data lives in `localStorage` (`skip-auth`).
- **AI:** Groq, called only from server routes in `app/api/*` so the key stays on the server.

## Where things live
| Path | What it is |
|---|---|
| `app/page.js` | Today screen: habits, water card, nutrition rows, weight, "Eaten before", the food log bar, and the Goals sheet with its section editors. Large file; change surgically. |
| `app/components/FoodLogSheet.js` | One-step food logging: search, whole-meal, barcode, photo, servings stepper, editable label values. |
| `app/components/AppChrome.js` | Shared bottom tab bar (`AppTabBar`) and page header (`PageHeader`). |
| `app/components/Onboarding.js` | First-run setup; also used for "Redo setup". |
| `app/ai-chat-modal.js` | AI chat (describe / photo / voice) and the `BarcodeScanner` (Open Food Facts lookup). |
| `app/reports/page.js` | Daily / weekly / monthly / workout reports. |
| `app/workout/*` | Train: programs, day detail, live logging, community discover. |
| `app/groups/page.js` | Groups and challenges (admin-only for now). |
| `app/admin/page.js` | Internal admin dashboard; its own light theme, not part of the app design. |
| `app/api/food-search` | Food search, whole-meal split, and photo reading → items with per-serving values for the person's metrics. |
| `app/api/chat` | AI chat replies with `NUTRITION_DATA` estimates. |
| `app/api/transcribe` | Voice to text (Whisper). |
| `app/api/workout-ai` | AI program builder. |
| `lib/theme.js` | Design tokens: `DARK`, `LIGHT`, `DONE`, `OVER`, `WATER`, `C`, `font`, `FONT`. |
| `lib/dataSync.js` | All Firestore reads/writes for days, history, settings, profiles, feedback, notifications, weight. |
| `lib/workoutSync.js` | Workout programs and sessions (localStorage + Firestore). |
| `lib/groupSync.js` | Groups and challenges. |
| `lib/icons.js` | Stroke SVG icon set. Use these, or inline stroke SVG; never emoji. |
| `firestore.rules` | Security rules. |

## Data model (don't reshape)
- **Settings** (per person): `checklistItems`, `nutritionMetrics` (`key`, `name`, `unit`, `goal`, `goalType` = `min`/`max`/`range`, `goalMax`), `waterButtons`, `waterGoal`, `meals` (10 slots, `null` = empty), `eveningCutoff`.
- **A day:** `checklistItems` (with `checked` / `count`), `nutritionMetrics` (with `value`), `water`, `waterHistory`, `nutritionHistory`.
- **`nutritionHistory` entry types** (all must keep working): `{ metricIndex, value }` single add; `{ estimates, name?, score? }` food / AI / meal; `manual_named` / `manual_unnamed` custom entry.
- **Device-only:** `lytz-recent-foods` ("Eaten before"), `lytz-darkMode`, `lytz-isAdmin` (session).

## AI models (Groq)
- Text: `openai/gpt-oss-120b`.
- Images: `qwen/qwen3.8-27b`. gpt-oss is text-only; sending it images is what broke the camera in July 2026.
- Groq retires models. Check https://console.groq.com/docs before changing one, and record the change in `docs/decisions.md`.
