# Testing a change

Every change is checked before asking to ship. There's no automated test suite yet, so checks are: a clean build, then using the app.

## 1. Build
```bash
npx next build
```
It must compile with no errors.

## 2. Run locally without Firebase
```bash
NEXT_PUBLIC_FIREBASE_API_KEY='' npx next dev -p 3123
```
Open http://localhost:3123 in the browser pane at phone size (375×812, dark).

## 3. Seed sample data
In the page console, set `skip-auth`, `checklist-items`, `nutrition-metrics`, `water-buttons`, `water-goal`, `custom-meals`, and today's `nutrition-data` (`date` = `new Date().toDateString()`), then reload. Set `yesterday-prompt-shown` or dismiss the prompt.
Note: today's `nutrition-data` overrides the settings lists. If habits or nutrients don't show, remove it and reload.
For Reports, also seed `nutrition-history` with past days.

## 4. AI without the key
The Groq key only exists on Vercel. Locally, stub `window.fetch` for `/api/food-search` (and `/api/chat`) to return realistic results, and test the screens around them. Say clearly that the real AI wasn't exercised, and have the owner try it once it's live.

## 5. What to check
- Do the thing the change is for, start to finish, as a first-time user would.
- Undo it, and confirm the numbers go back.
- Check past-day view if the change touches logging.
- Check light mode if the change touches colors.
- No console errors.
- Clean up: clear test localStorage, stop the dev server, reset the viewport.

## 6. After shipping
Confirm the Vercel production deploy for the pushed commit reports success.
