import { NextResponse } from 'next/server'
import { guardAiRequest, tooLarge, tooLargeResponse, aiErrorResponse, validImage } from '../../../lib/serverGuard'

// Configure for edge runtime for faster cold starts on mobile PWAs
export const runtime = 'edge'

const TEXT_MODEL = 'openai/gpt-oss-120b'
// gpt-oss is text-only, so photos go to Groq's vision model
const VISION_MODEL = 'qwen/qwen3.8-27b'

// The AI's instructions are built here on the server. Callers send only their
// own words, a photo, their metric names and recent messages, never a prompt.
function nutritionPrompt(metrics, hasImage) {
  const list = metrics.length ? metrics : [
    { key: 'calories', name: 'calories', unit: '' }, { key: 'protein', name: 'protein', unit: 'g' },
    { key: 'carbs', name: 'carbs', unit: 'g' }, { key: 'fat', name: 'fat', unit: 'g' },
  ]
  const metricsInfo = list.map(m => `${m.name} (${m.unit})`).join(', ')
  const metricsKeys = Object.fromEntries(list.map(m => [m.key, 0]))

  const base = `You are a precise nutrition database assistant. The user is tracking these metrics: ${metricsInfo}.

ACCURACY IS YOUR TOP PRIORITY. Use real nutritional data from official sources (USDA, restaurant websites, food labels). Do not guess or extrapolate wildly.

Rules:
- For branded/restaurant foods (McDonald's, Chick-fil-A, Starbucks, etc.), use their OFFICIAL published nutrition data. Example: Chick-fil-A 12-ct nuggets = 380 cal, so 10 = ~317 cal.
- For generic foods, use USDA database values as your reference.
- Scale linearly from known serving sizes. If a 12-count is X calories, a 10-count is (10/12 * X) calories.
- NEVER inflate calorie estimates. When uncertain, estimate conservatively (lower end).
- Calculate for the EXACT quantity described, not a default serving size.
- Only help with food, nutrition, hydration and healthy habits. Politely decline anything else.
- You are not a doctor. Don't give medical advice; suggest seeing a professional for medical, allergy or eating-disorder concerns.`

  const image = hasImage ? `

When analyzing a food photo:
- If it's a nutrition facts label, read the exact values directly from the label. Use the serving size shown unless the user specifies otherwise.
- If it's a photo of food, identify what you see and estimate a typical portion. If the user specified a quantity or amount in their message, use that instead.
- Describe briefly what you identified so the user can confirm it's correct.` : ''

  return `${base}${image}

When the user describes or shows a meal or food, provide:
1. A brief response with your source or reasoning (e.g. "Based on Chick-fil-A's official data..." or "I can see this is a nutrition label showing...")
2. Your accurate estimates for the EXACT amount described or shown

Always end your response with these two lines:
NUTRITION_DATA: ${JSON.stringify(metricsKeys)}
FOOD_SCORE: {"score": 0, "grade": "?", "label": "?", "reason": "?"}

For NUTRITION_DATA, replace 0s with accurate values for the EXACT amount described.
For FOOD_SCORE: score 0-100 based on nutrient density, processing level, fiber, sugar, sodium, protein quality, and fat quality.
Grades: A (85-100), B (70-84), C (55-69), D (40-54), F (0-39)
Labels: "Excellent" (A), "Good" (B), "Fair" (C), "Poor" (D), "Avoid" (F)
Reason: 5-7 words max — the single most important factor.`
}

const BARCODE_PROMPT = 'You are a barcode reader. When shown an image, find the barcode and return ONLY its numeric digits — nothing else. No spaces, no explanation. If no barcode is visible, return NONE.'

const cleanMetrics = (metrics) => (Array.isArray(metrics) ? metrics : []).slice(0, 20).map(m => ({
  key: String(m?.key || '').slice(0, 40),
  name: String(m?.name || '').slice(0, 40),
  unit: String(m?.unit || '').slice(0, 10),
})).filter(m => m.key)

const cleanHistory = (history) => (Array.isArray(history) ? history : []).slice(-6)
  .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
  .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))

export async function POST(request) {
  if (tooLarge(request, 7_000_000)) return tooLargeResponse()
  const guard = await guardAiRequest(request)
  if (guard.response) return guard.response

  try {
    const body = await request.json()
    const task = body.task === 'barcode' ? 'barcode' : 'nutrition'
    const text = String(body.text || '').slice(0, 1000)
    const image = body.image
    if (image && !validImage(image)) return tooLargeResponse()
    if (task === 'barcode' && !image) return NextResponse.json({ error: 'No photo provided.' }, { status: 400 })
    if (task === 'nutrition' && !text.trim() && !image) return NextResponse.json({ error: 'Nothing to analyze.' }, { status: 400 })

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return aiErrorResponse(500)

    let messages
    if (task === 'barcode') {
      messages = [
        { role: 'system', content: BARCODE_PROMPT },
        { role: 'user', content: [
          { type: 'text', text: 'Read the barcode number from this image. Return ONLY the digits.' },
          { type: 'image_url', image_url: { url: image } },
        ] },
      ]
    } else {
      const userContent = image
        ? [{ type: 'text', text: text.trim() || 'Analyze this food and estimate its nutrition.' }, { type: 'image_url', image_url: { url: image } }]
        : text
      messages = [
        { role: 'system', content: nutritionPrompt(cleanMetrics(body.metrics), !!image) },
        ...cleanHistory(body.history),
        { role: 'user', content: userContent },
      ]
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: image ? VISION_MODEL : TEXT_MODEL,
          messages,
          temperature: 0.1,
          max_tokens: task === 'barcode' ? 100 : 1200
        }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const data = await response.json()
      if (!response.ok) {
        console.error('Groq API error:', data?.error?.message || response.status)
        return aiErrorResponse(response.status === 429 ? 429 : 502)
      }
      // Strip any visible reasoning some models prepend
      const content = String(data.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      return NextResponse.json({ content })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({ error: 'That took too long. Please try again.' }, { status: 408 })
      }
      throw fetchError
    }
  } catch (error) {
    console.error('Chat API error:', error?.message)
    return aiErrorResponse(500)
  }
}
