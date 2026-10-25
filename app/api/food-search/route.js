import { NextResponse } from 'next/server'
import { guardAiRequest, tooLarge, tooLargeResponse, aiErrorResponse, validImage } from '../../../lib/serverGuard'

export const runtime = 'edge'

const TEXT_MODEL = 'openai/gpt-oss-120b'
// gpt-oss is text-only; photos need Groq's vision model
const VISION_MODEL = 'qwen/qwen3.8-27b'

// Food search for the one-step "What did you eat?" sheet.
// Text: a single food → a few likely matches; a whole meal → its separate items.
// Photo (food or nutrition label) → its items.
export async function POST(request) {
  if (tooLarge(request, 7_000_000)) return tooLargeResponse()
  const guard = await guardAiRequest(request)
  if (guard.response) return guard.response
  try {
    const { query, image, metrics } = await request.json()
    const q = String(query || '').trim().slice(0, 300)
    if (image && !validImage(image)) return tooLargeResponse()
    const hasImage = !!image
    if (!hasImage && q.length < 2) return NextResponse.json({ results: [], meal: null })

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return aiErrorResponse(500)
    }

    const metricList = (Array.isArray(metrics) && metrics.length > 0 ? metrics.map(m => ({ key: String(m?.key || '').slice(0, 40), name: String(m?.name || '').slice(0, 40), unit: String(m?.unit || '').slice(0, 10) })).filter(m => m.key) : [
      { key: 'calories', name: 'Calories', unit: '' },
      { key: 'protein', name: 'Protein', unit: 'g' },
    ]).slice(0, 20)
    const keys = Object.fromEntries(metricList.map(m => [String(m.key), 0]))
    const described = metricList.map(m => `${m.key} = ${m.name}${m.unit ? ` (${m.unit})` : ''}`).join('; ')
    const item = `{"name":"...","serving":"...","servings":1,"values":${JSON.stringify(keys)}}`

    const rules = `You are a precise nutrition database (USDA values for generic foods, official published data for brands and restaurants).
Values are for ONE serving, for these metrics: ${described}.
Each serving has a household measure and weight, e.g. "1 cup (170 g)", "1 slice", "12 pieces (30 g)".
"servings" is how many of that serving the person had (default 1; e.g. "3 eggs" with serving "1 large egg" → servings 3).
"Added sugar" means sugar added during processing, not natural sugar. Never inflate values.
Reply with JSON only, no prose, no markdown.`

    const system = hasImage
      ? `${rules}
The image is either a photo of food or a nutrition facts label.
- Nutrition label: return one item using the label's exact per-serving values and serving size.
- Food photo: identify each separate food and estimate a realistic portion.
${q ? `The person adds: "${q}". Use it to correct names or amounts.` : ''}
Format: {"results":[],"meal":{"items":[${item}]}}`
      : `${rules}
If the text names ONE food, return the 4 most likely matches, most common first (generic before brands; include the brand or restaurant version when one is named), and "meal": null.
If the text describes SEVERAL foods eaten together (e.g. "2 eggs, toast with butter and a coffee"), return each food as its own item in "meal" with the amount described, and "results": [].
Format: {"results":[${item}],"meal":null} or {"results":[],"meal":{"items":[${item}]}}`

    const userContent = hasImage
      ? [{ type: 'text', text: q || 'What is this? Give the nutrition.' }, { type: 'image_url', image_url: { url: image } }]
      : q

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: hasImage ? VISION_MODEL : TEXT_MODEL,
          messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
          temperature: 0.1,
          max_tokens: 2000
        }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const data = await response.json()
      if (!response.ok) {
        console.error('Groq food search error:', data?.error?.message || response.status)
        return aiErrorResponse(response.status === 429 ? 429 : 502)
      }

      // Some models think out loud first; keep only the JSON object
      const content = String(data.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '')
      const start = content.indexOf('{')
      const end = content.lastIndexOf('}')
      if (start < 0 || end < start) return NextResponse.json({ results: [], meal: null })
      const parsed = JSON.parse(content.slice(start, end + 1))

      const clean = (r) => ({
        name: String(r?.name || '').slice(0, 80),
        serving: String(r?.serving || '1 serving').slice(0, 40),
        servings: Number(r?.servings) > 0 ? Math.min(50, Math.round(Number(r.servings) * 4) / 4) : 1,
        values: Object.fromEntries(metricList.map(m => {
          const v = Number(r?.values?.[m.key])
          return [m.key, Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0]
        }))
      })
      const results = (parsed.results || []).slice(0, 4).map(clean).filter(r => r.name)
      const items = (parsed.meal?.items || []).slice(0, 12).map(clean).filter(r => r.name)

      return NextResponse.json({ results, meal: items.length ? { items } : null })
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        return NextResponse.json({ error: 'That took too long. Try again.' }, { status: 408 })
      }
      throw err
    }
  } catch (error) {
    console.error('Food search error:', error?.message)
    return NextResponse.json({ error: 'Could not search right now.' }, { status: 500 })
  }
}
