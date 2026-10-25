import { NextResponse } from 'next/server'
import { guardAiRequest, tooLarge, tooLargeResponse, aiErrorResponse } from '../../../lib/serverGuard'

export const runtime = 'edge'

const SYSTEM = `You are a workout program builder. When given a description of a workout plan, output ONLY valid JSON — no markdown, no explanation, no code fences. Use exactly this structure:
{
  "name": "Program Name",
  "description": "Brief description",
  "days": [
    {
      "name": "Day Name",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": [
            {"type": "working", "reps": "8-10", "weight": "", "rest": "90"}
          ]
        }
      ]
    }
  ]
}
Rules: type is "working", "drop", or "amrap". reps is a string like "8-10" or "5". weight is lbs as a string or empty. rest is seconds as a string. Output ONLY the raw JSON object.`

export async function POST(request) {
  if (tooLarge(request, 20_000)) return tooLargeResponse()
  const guard = await guardAiRequest(request)
  if (guard.response) return guard.response
  try {
    const body = await request.json()
    const prompt = String(body.prompt || '').slice(0, 2000)
    if (!prompt.trim()) return NextResponse.json({ error: 'Describe the program you want.' }, { status: 400 })
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return aiErrorResponse(500)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 3000,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const data = await response.json()
    if (!response.ok) {
      console.error('Groq workout error:', data?.error?.message || response.status)
      return aiErrorResponse(response.status === 429 ? 429 : 502)
    }
    const text = data.choices?.[0]?.message?.content || ''

    // Strip any accidental markdown fences
    const cleaned = text.replace(/^```[a-z]*\n?/,'').replace(/\n?```$/,'').trim()
    try {
      const program = JSON.parse(cleaned)
      return NextResponse.json({ program })
    } catch {
      return NextResponse.json({ error: "The AI's program came back garbled. Try describing it again." }, { status: 422 })
    }
  } catch (e) {
    console.error('Workout AI error:', e?.message)
    return aiErrorResponse(500)
  }
}
